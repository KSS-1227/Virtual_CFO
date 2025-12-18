const { getAuthenticatedClient } = require("../config/supabase");
const { generateProductAnalysis } = require("../config/openai");
const { asyncHandler } = require("../middleware/errorHandler");

// Get all active products with filtering
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

  // Apply filters
  if (category) {
    query = query.eq("category", category);
  }

  if (business_type) {
    query = query.contains("target_business_types", [business_type]);
  }

  if (min_price) {
    query = query.gte("price", parseFloat(min_price));
  }

  if (max_price) {
    query = query.lte("price", parseFloat(max_price));
  }

  const { data: products, error } = await query;

  if (error) throw error;

  res.json({
    success: true,
    data: products,
    error: null,
  });
});

// Get product by ID
const getProduct = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);
  const { id } = req.params;

  const { data: product, error } = await supabase
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

  res.json({
    success: true,
    data: product,
    error: null,
  });
});

// Create new product (Admin only)
const createProduct = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("business_type")
    .eq("id", req.user.id)
    .single();

  if (!profile || profile.business_type !== "Admin") {
    return res.status(403).json({
      success: false,
      error: "Admin access required",
      data: null,
    });
  }

  const productData = {
    ...req.body,
    created_by: req.user.id,
  };

  const { data: product, error } = await supabase
    .from("products")
    .insert(productData)
    .select()
    .single();

  if (error) throw error;

  res.status(201).json({
    success: true,
    data: product,
    error: null,
  });
});

// Get AI-powered product recommendations for user
const getRecommendations = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);
  const userId = req.user.id;

  // Get user's business context
  const { data: userContext } = await supabase
    .rpc("get_user_business_context", { target_user_id: userId });

  if (!userContext || !userContext.business_type) {
    return res.status(400).json({
      success: false,
      error: "Complete business profile required for recommendations",
      data: null,
    });
  }

  // Get existing recommendations that haven't expired
  const { data: existingRecs } = await supabase
    .from("product_recommendations")
    .select(`
      *,
      products(*)
    `)
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString())
    .order("compatibility_score", { ascending: false });

  // If we have recent recommendations, return them
  if (existingRecs && existingRecs.length > 0) {
    return res.json({
      success: true,
      data: {
        recommendations: existingRecs,
        generated_at: existingRecs[0].analyzed_at,
        user_context: userContext,
      },
      error: null,
    });
  }

  // Generate new recommendations
  await generateRecommendationsForUser(userId, userContext, supabase);

  // Fetch the newly generated recommendations
  const { data: newRecs } = await supabase
    .from("product_recommendations")
    .select(`
      *,
      products(*)
    `)
    .eq("user_id", userId)
    .order("compatibility_score", { ascending: false });

  res.json({
    success: true,
    data: {
      recommendations: newRecs || [],
      generated_at: new Date().toISOString(),
      user_context: userContext,
    },
    error: null,
  });
});

// Generate recommendations for a user
const generateRecommendationsForUser = async (userId, userContext, supabase) => {
  // Get products that match user's business profile
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .contains("target_business_types", [userContext.business_type])
    .lte("min_revenue", userContext.monthly_revenue || 0)
    .gte("max_revenue", userContext.monthly_revenue || 0);

  if (!products || products.length === 0) return;

  // Analyze each product with AI
  for (const product of products) {
    try {
      const analysis = await generateProductAnalysis(product, userContext);
      
      // Parse AI response and create recommendation
      const recommendation = {
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
      };

      // Insert recommendation
      await supabase
        .from("product_recommendations")
        .upsert(recommendation);

    } catch (error) {
      console.error(`Error analyzing product ${product.id}:`, error);
    }
  }
};

// Update user interaction with recommendation
const updateRecommendationInteraction = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);
  const { id } = req.params;
  const { is_viewed, is_interested, user_feedback } = req.body;

  const { data: recommendation, error } = await supabase
    .from("product_recommendations")
    .update({
      is_viewed,
      is_interested,
      user_feedback,
    })
    .eq("id", id)
    .eq("user_id", req.user.id)
    .select()
    .single();

  if (error) throw error;

  res.json({
    success: true,
    data: recommendation,
    error: null,
  });
});

// Get product categories
const getCategories = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);

  const { data: categories, error } = await supabase
    .from("product_categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (error) throw error;

  res.json({
    success: true,
    data: categories,
    error: null,
  });
});

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  getRecommendations,
  updateRecommendationInteraction,
  getCategories,
};