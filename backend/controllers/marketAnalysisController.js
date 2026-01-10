const { generateMarketAnalysis, generateScenarioAnalysis, generatePredictiveInsights } = require("../config/openai");
const { getAuthenticatedClient } = require("../config/supabase");
const { asyncHandler } = require("../middleware/errorHandler");

// AI Market Analysis Agent
const analyzeMarketTrends = asyncHandler(async (req, res) => {
  const { time_period = "6_months" } = req.body;

  try {
    const supabase = getAuthenticatedClient(req.accessToken);
    
    // Get user profile and historical data
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", req.user.id)
      .single();

    // Get historical earnings data
    const { data: earnings } = await supabase
      .from("earnings")
      .select("earning_date, amount, inventory_cost")
      .eq("user_id", req.user.id)
      .order("earning_date", { ascending: false })
      .limit(180); // Last 6 months

    // Get monthly summaries for trend analysis
    const { data: monthlySummaries } = await supabase
      .from("monthly_summaries")
      .select("*")
      .eq("user_id", req.user.id)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(12);

    const analysisData = {
      profile,
      earnings: earnings || [],
      monthlySummaries: monthlySummaries || [],
      business_field: profile?.business_type || 'General Business',
      time_period
    };

    const marketAnalysis = await generateMarketAnalysis(analysisData);

    res.json({
      success: true,
      data: {
        analysis: marketAnalysis,
        business_type: profile?.business_type,
        data_points: earnings?.length || 0,
        analysis_period: time_period,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("Market Analysis Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate market analysis"
    });
  }
});

// AI Scenario Analysis Agent
const analyzeBusinessScenarios = asyncHandler(async (req, res) => {
  const { scenarios, context } = req.body;

  if (!scenarios || !Array.isArray(scenarios) || scenarios.length === 0) {
    return res.status(400).json({
      success: false,
      error: "Scenarios array is required"
    });
  }

  try {
    const supabase = getAuthenticatedClient(req.accessToken);
    
    // Get comprehensive business data
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", req.user.id)
      .single();

    const { data: recentEarnings } = await supabase
      .from("earnings")
      .select("*")
      .eq("user_id", req.user.id)
      .order("earning_date", { ascending: false })
      .limit(30);

    const { data: monthlySummaries } = await supabase
      .from("monthly_summaries")
      .select("*")
      .eq("user_id", req.user.id)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(6);

    const businessData = {
      profile,
      recentEarnings: recentEarnings || [],
      monthlySummaries: monthlySummaries || [],
      scenarios,
      context: context || {}
    };

    const scenarioAnalysis = await generateScenarioAnalysis(businessData);

    res.json({
      success: true,
      data: {
        scenario_analysis: scenarioAnalysis,
        scenarios_analyzed: scenarios.length,
        business_context: {
          business_type: profile?.business_type,
          monthly_revenue: profile?.monthly_revenue,
          data_points: recentEarnings?.length || 0
        },
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("Scenario Analysis Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to analyze business scenarios"
    });
  }
});

// Predictive Market Insights
const getPredictiveInsights = asyncHandler(async (req, res) => {
  const { prediction_type = "revenue", time_horizon = "3_months" } = req.query;

  try {
    const supabase = getAuthenticatedClient(req.accessToken);
    
    // Get comprehensive historical data
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", req.user.id)
      .single();

    const { data: earnings } = await supabase
      .from("earnings")
      .select("*")
      .eq("user_id", req.user.id)
      .order("earning_date", { ascending: false })
      .limit(365); // Full year of data

    const { data: monthlySummaries } = await supabase
      .from("monthly_summaries")
      .select("*")
      .eq("user_id", req.user.id)
      .order("year", { ascending: false })
      .order("month", { ascending: false });

    const predictionData = {
      profile,
      earnings: earnings || [],
      monthlySummaries: monthlySummaries || [],
      prediction_type,
      time_horizon
    };

    const predictions = await generatePredictiveInsights(predictionData);

    res.json({
      success: true,
      data: {
        predictions,
        prediction_type,
        time_horizon,
        data_quality: {
          total_data_points: earnings?.length || 0,
          months_of_data: monthlySummaries?.length || 0,
          confidence_level: earnings?.length > 90 ? "high" : earnings?.length > 30 ? "medium" : "low"
        },
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("Predictive Insights Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate predictive insights"
    });
  }
});

module.exports = {
  analyzeMarketTrends,
  analyzeBusinessScenarios,
  getPredictiveInsights
};