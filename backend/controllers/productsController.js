const { getAuthenticatedClient } = require("../config/supabase");
const { generateProductAnalysis } = require("../config/openai");
const { asyncHandler } = require("../middleware/errorHandler");
const getProducts = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);
  const { category, business_type, min_price, max_price, limit = 20 } = req.query;

  let query = supabase
    .from("products")
    .select(`
      *,
      product_categories(name, icon_name, color_class)
    `)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(parseInt(limit));

  if (category) query = query.eq("category", category);
  if (business_type)
    query = query.contains("target_business_types", [business_type]);
  if (min_price) query = query.gte("price", parseFloat(min_price));
  if (max_price) query = query.lte("price", parseFloat(max_price));

  const { data, error } = await query;
  if (error) throw error;

  res.json({ success: true, data, error: null });
});

const getProduct = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);
  const { id } = req.params;

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (error) {
    return res.status(404).json({
      success: false,
      error: "Product not found",
      data: null,
    });
  }

  res.json({ success: true, data, error: null });
});

const createProduct = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_type")
    .eq("id", req.user.id)
    .single();

  if (profile?.business_type !== "Admin") {
    return res.status(403).json({
      success: false,
      error: "Admin access required",
      data: null,
    });
  }

  const { data, error } = await supabase
    .from("products")
    .insert({
      ...req.body,
      created_by: req.user.id,
    })
    .select()
    .single();

  if (error) throw error;

  res.status(201).json({ success: true, data, error: null });
});

const getRecommendations = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);
  const userId = req.user.id;

  const { data: userContext } = await supabase.rpc(
    "get_user_business_context",
    { target_user_id: userId }
  );

  if (!userContext?.business_category) {
    return res.status(400).json({
      success: false,
      error: "Complete business profile required",
      data: null,
    });
  }

  const { data: existing } = await supabase
    .from("product_recommendations")
    .select(`*, products(*)`)
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString())
    .order("compatibility_score", { ascending: false });

  if (existing?.length) {
    return res.json({
      success: true,
      data: {
        recommendations: existing,
        generated_at: existing[0].analyzed_at,
        user_context: userContext,
      },
      error: null,
    });
  }

  await generateRecommendationsForUser(userId, userContext, supabase);

  const { data: fresh } = await supabase
    .from("product_recommendations")
    .select(`*, products(*)`)
    .eq("user_id", userId)
    .order("compatibility_score", { ascending: false });

  res.json({
    success: true,
    data: {
      recommendations: fresh || [],
      generated_at: new Date().toISOString(),
      user_context: userContext,
    },
    error: null,
  });
});
const generateRecommendationsForUser = async (
  userId,
  userContext,
  supabase
) => {
  const { business_type, business_category, monthly_revenue } = userContext;

  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .contains("target_business_types", [business_type])
    .contains("target_categories", [business_category])
    .lte("min_revenue", monthly_revenue ?? 0)
    .gte("max_revenue", monthly_revenue ?? 0);

  if (error || !products?.length) return;

  for (const product of products) {
    try {
      const analysis = await generateProductAnalysis(product, userContext);

      await supabase.from("product_recommendations").upsert(
        {
          user_id: userId,
          product_id: product.id,
          compatibility_score: analysis.compatibility_score,
          business_impact_score: analysis.business_impact_score,
          analysis_summary: analysis.summary,
          potential_benefits: analysis.benefits,
          implementation_challenges: analysis.challenges,
          estimated_roi_months: analysis.roi_months,
          estimated_monthly_impact: analysis.monthly_impact,
          recommendation_type: analysis.recommendation_type,
          priority_level: analysis.priority_level,
          analyzed_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 86400000),
        },
        { onConflict: "user_id,product_id" }
      );
    } catch (err) {
      console.error("Recommendation error:", err);
    }
  }
};
const updateRecommendationInteraction = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);
  const { id } = req.params;

  const { data, error } = await supabase
    .from("product_recommendations")
    .update({
      is_viewed: req.body.is_viewed,
      is_interested: req.body.is_interested,
      user_feedback: req.body.user_feedback,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", req.user.id)
    .select()
    .single();

  if (error) throw error;

  res.json({
    success: true,
    data,
    error: null,
  });
});
const getCategories = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);

  const { data, error } = await supabase
    .from("product_categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (error) throw error;

  res.json({ success: true, data, error: null });
});

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  getRecommendations,
  updateRecommendationInteraction,
  getCategories,
};
