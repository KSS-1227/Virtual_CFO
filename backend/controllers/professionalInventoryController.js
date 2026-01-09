// const asyncHandler = require('express-async-handler');
const { getAuthenticatedClient } = require('../config/supabase');
const smartSuggestionsService = require('../services/smartSuggestionsService');
const supplierPrioritizationService = require('../services/supplierPrioritizationService');
const seasonalDemandService = require('../services/seasonalDemandService');
const multiModalIntegrationService = require('../services/multiModalIntegrationService');
const formalLearningService = require('../services/formalLearningService');
const audioConfirmationService = require('../services/audioConfirmationService');
const notificationService = require('../services/notificationService');

// Simple async handler replacement
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Smart Suggestions API
const getSmartSuggestions = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, query, context = {} } = req.body;

    if (!type || !query) {
      return res.status(400).json({
        success: false,
        error: 'Type and query are required'
      });
    }

    // Simple fallback for testing - get existing inventory items
    const supabase = getAuthenticatedClient(req.accessToken);
    const { data: items } = await supabase
      .from('inventory_items')
      .select('product_name, category, brand')
      .eq('user_id', userId)
      .limit(50);

    // Filter items that match the query
    const existingSuggestions = (items || [])
      .filter(item => item.product_name && item.product_name.toLowerCase().includes(query.toLowerCase()))
      .map(item => ({
        text: item.product_name,
        confidence: 0.8,
        frequency: 1,
        type: 'inventory',
        source: 'existing_inventory',
        reason: `From your inventory`
      }))
      .slice(0, 3);

    // Add AI-powered complementary suggestions
    console.log('Generating AI suggestions for query:', query);
    const complementarySuggestions = await generateComplementaryProducts(query, items || []);
    console.log('AI suggestions generated:', complementarySuggestions);
    
    const allSuggestions = [...existingSuggestions, ...complementarySuggestions].slice(0, 5);

    res.json({
      success: true,
      data: {
        suggestions: allSuggestions,
        query,
        type,
        context,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Smart suggestions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get smart suggestions'
    });
  }
});

// Helper function to generate complementary products using OpenAI
async function generateComplementaryProducts(query, existingItems) {
  try {
    console.log('Attempting to generate AI suggestions...');
    const { generateCompletion } = require('../services/openai');
    
    const existingNames = existingItems.map(item => item.product_name).join(', ');
    
    const prompt = `Suggest 3 products commonly bought with "${query}". Exclude: ${existingNames}. Format: one product per line.`;

    const response = await generateCompletion(prompt, { max_tokens: 60, temperature: 0.7 });
    console.log('OpenAI response:', response);
    
    const suggestions = response.split('\n')
      .filter(line => line.trim())
      .slice(0, 3)
      .map(product => ({
        text: product.trim().replace(/^\d+\.\s*/, ''),
        confidence: 0.7,
        frequency: 1,
        type: 'complementary',
        source: 'ai_suggestion',
        reason: `AI suggests this complements "${query}"`
      }));
      
    return suggestions;
  } catch (error) {
    console.error('Error generating AI suggestions:', error);
    // Fallback suggestions
    return [
      {
        text: `${query} Case`,
        confidence: 0.6,
        frequency: 1,
        type: 'complementary',
        source: 'fallback',
        reason: 'Commonly needed accessory'
      },
      {
        text: `${query} Charger`,
        confidence: 0.6,
        frequency: 1,
        type: 'complementary',
        source: 'fallback',
        reason: 'Essential accessory'
      },
      {
        text: `${query} Stand`,
        confidence: 0.5,
        frequency: 1,
        type: 'complementary',
        source: 'fallback',
        reason: 'Useful accessory'
      }
    ];
  }
}

const recordSuggestionSelection = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, query, selectedSuggestion, context = {} } = req.body;

    await smartSuggestionsService.recordUserSelection(
      userId,
      type,
      query,
      selectedSuggestion,
      context
    );

    res.json({
      success: true,
      message: 'Selection recorded for learning'
    });
  } catch (error) {
    console.error('Error recording suggestion selection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record selection'
    });
  }
});

// Supplier Prioritization API
const getPrioritizedSuppliers = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { productName, category, context = {} } = req.query;

    const result = await supplierPrioritizationService.getPrioritizedSuppliers(
      userId,
      productName,
      category,
      context
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Supplier prioritization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get prioritized suppliers'
    });
  }
});

const createDynamicCategory = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const categoryData = req.body;

    const category = await supplierPrioritizationService.createDynamicCategory(
      userId,
      categoryData
    );

    res.json({
      success: true,
      data: category,
      message: 'Dynamic category created successfully'
    });
  } catch (error) {
    console.error('Error creating dynamic category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create dynamic category'
    });
  }
});

const recordSupplierFeedback = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { supplierId, feedback } = req.body;

    await supplierPrioritizationService.recordSupplierFeedback(
      userId,
      supplierId,
      feedback
    );

    res.json({
      success: true,
      message: 'Supplier feedback recorded'
    });
  } catch (error) {
    console.error('Error recording supplier feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record supplier feedback'
    });
  }
});

// Seasonal Demand & Reorder Intelligence API
const analyzeSeasonalPatterns = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { productName, category } = req.query;

    const analysis = await seasonalDemandService.analyzeSeasonalPatterns(
      userId,
      productName,
      category
    );

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Seasonal analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze seasonal patterns'
    });
  }
});

const getCurrentMonthRecommendations = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { productName, category } = req.query;

    const recommendations = await seasonalDemandService.getCurrentMonthRecommendations(
      userId,
      productName,
      category
    );

    res.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    console.error('Error getting current month recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recommendations'
    });
  }
});

// Multi-Modal Integration API
const processMultiModalInput = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { inputs, workflowType } = req.body;

    const result = await multiModalIntegrationService.processMultiModalInput(
      userId,
      inputs,
      workflowType
    );

    if (result.error) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Multi-modal processing error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process multi-modal input'
    });
  }
});

const continueConversationalFlow = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId, userResponse } = req.body;

    const result = await multiModalIntegrationService.continueConversationalFlow(
      userId,
      sessionId,
      userResponse
    );

    if (result.error) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Conversational flow error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to continue conversational flow'
    });
  }
});

// Formal Learning & Feedback API
const recordUserCorrection = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { originalData, correctedData, context = {} } = req.body;

    const result = await formalLearningService.recordUserCorrection(
      userId,
      originalData,
      correctedData,
      context
    );

    res.json({
      success: true,
      data: result,
      message: 'Correction recorded and learned'
    });
  } catch (error) {
    console.error('Error recording user correction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record correction'
    });
  }
});

const recordPerformanceFeedback = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { feedbackType, rating, context = {} } = req.body;

    const result = await formalLearningService.recordPerformanceFeedback(
      userId,
      feedbackType,
      rating,
      context
    );

    res.json({
      success: true,
      data: result,
      message: 'Performance feedback recorded'
    });
  } catch (error) {
    console.error('Error recording performance feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record performance feedback'
    });
  }
});

const getPersonalizedSuggestions = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { context = {} } = req.query;

    const result = await formalLearningService.getPersonalizedSuggestions(
      userId,
      context
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting personalized suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get personalized suggestions'
    });
  }
});

// Comprehensive Inventory Analysis
const getComprehensiveAnalysis = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { productName, category } = req.query;

    // Run all analyses in parallel
    const [
      seasonalAnalysis,
      supplierAnalysis,
      personalizedSuggestions
    ] = await Promise.all([
      seasonalDemandService.analyzeSeasonalPatterns(userId, productName, category),
      supplierPrioritizationService.getPrioritizedSuppliers(userId, productName, category),
      formalLearningService.getPersonalizedSuggestions(userId, { productName, category })
    ]);

    // Generate comprehensive insights
    const insights = {
      seasonal: seasonalAnalysis,
      suppliers: supplierAnalysis,
      personalized: personalizedSuggestions,
      recommendations: await generateComprehensiveRecommendations(
        seasonalAnalysis,
        supplierAnalysis,
        personalizedSuggestions
      ),
      confidence: calculateOverallConfidence([
        seasonalAnalysis.confidence || 0.5,
        supplierAnalysis.averageScore || 0.5,
        personalizedSuggestions.confidence || 0.5
      ])
    };

    res.json({
      success: true,
      data: insights,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Comprehensive analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate comprehensive analysis'
    });
  }
});

// Inventory Conversational Interface
const inventoryConversationalInterface = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { message, context = {}, sessionId } = req.body;

    // Process the conversational input
    const result = await processInventoryConversation(userId, message, context, sessionId);

    // Generate audio confirmation if requested
    if (result.requiresConfirmation && context.audioEnabled) {
      await audioConfirmationService.generateConfirmation(
        userId,
        'inventory_question',
        { message: result.response },
        context.language || 'en'
      );
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Conversational interface error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process conversational input'
    });
  }
});

// Advanced Inventory Dashboard Data
const getAdvancedDashboardData = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const supabase = getAuthenticatedClient(req.accessToken);

    // Get comprehensive dashboard data
    const [
      inventoryItems,
      recentActivity,
      performanceMetrics,
      notifications
    ] = await Promise.all([
      getInventoryOverview(supabase, userId),
      getRecentActivity(supabase, userId),
      getPerformanceMetrics(supabase, userId),
      notificationService.getActiveNotifications(userId)
    ]);

    const dashboardData = {
      overview: inventoryItems,
      recentActivity,
      performance: performanceMetrics,
      notifications,
      insights: await generateDashboardInsights(inventoryItems, performanceMetrics),
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Dashboard data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard data'
    });
  }
});

// Helper Functions
async function generateComprehensiveRecommendations(seasonal, suppliers, personalized) {
  const recommendations = [];

  // Seasonal recommendations
  if (seasonal.seasonalTrends?.peak_months?.length > 0) {
    recommendations.push({
      type: 'seasonal',
      priority: 'high',
      message: `Peak season approaching in ${seasonal.seasonalTrends.peak_months.map(p => p.month).join(', ')}`,
      action: 'increase_stock'
    });
  }

  // Supplier recommendations
  if (suppliers.topPerformer) {
    recommendations.push({
      type: 'supplier',
      priority: 'medium',
      message: `${suppliers.topPerformer.name} is your top performing supplier`,
      action: 'prioritize_orders'
    });
  }

  // Personalized recommendations
  if (personalized.personalization_level > 0.7) {
    recommendations.push({
      type: 'personalized',
      priority: 'info',
      message: 'System has learned your preferences well',
      action: 'trust_suggestions'
    });
  }

  return recommendations;
}

function calculateOverallConfidence(confidences) {
  return confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
}

async function processInventoryConversation(userId, message, context, sessionId) {
  // This would integrate with the conversational AI system
  // For now, return a structured response
  return {
    response: "I understand you want to manage your inventory. How can I help?",
    requiresConfirmation: false,
    sessionId: sessionId || `conv_${Date.now()}`,
    nextSteps: ['add_item', 'check_stock', 'analyze_trends']
  };
}

async function getInventoryOverview(supabase, userId) {
  const { data: items } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  return {
    totalItems: items?.length || 0,
    totalValue: items?.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0) || 0,
    lowStockItems: items?.filter(item => item.quantity <= item.reorder_point).length || 0,
    categories: [...new Set(items?.map(item => item.category).filter(Boolean))] || []
  };
}

async function getRecentActivity(supabase, userId) {
  const { data: activity } = await supabase
    .from('inventory_items')
    .select('name, quantity, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(10);

  return activity || [];
}

async function getPerformanceMetrics(supabase, userId) {
  // Calculate performance metrics
  const { data: items } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('user_id', userId);

  const totalValue = items?.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0) || 0;
  const avgTurnover = items?.length > 0 ? totalValue / items.length : 0;

  return {
    totalValue,
    avgTurnover,
    stockAccuracy: 0.95, // This would be calculated based on actual data
    fulfillmentRate: 0.98
  };
}

async function generateDashboardInsights(overview, performance) {
  const insights = [];

  if (overview.lowStockItems > 0) {
    insights.push({
      type: 'warning',
      message: `${overview.lowStockItems} items are running low on stock`,
      priority: 'high'
    });
  }

  if (performance.stockAccuracy < 0.9) {
    insights.push({
      type: 'improvement',
      message: 'Stock accuracy could be improved',
      priority: 'medium'
    });
  }

  return insights;
}

module.exports = {
  // Smart Suggestions
  getSmartSuggestions,
  recordSuggestionSelection,
  
  // Supplier Prioritization
  getPrioritizedSuppliers,
  createDynamicCategory,
  recordSupplierFeedback,
  
  // Seasonal Demand
  analyzeSeasonalPatterns,
  getCurrentMonthRecommendations,
  
  // Multi-Modal Integration
  processMultiModalInput,
  continueConversationalFlow,
  
  // Formal Learning
  recordUserCorrection,
  recordPerformanceFeedback,
  getPersonalizedSuggestions,
  
  // Comprehensive Features
  getComprehensiveAnalysis,
  inventoryConversationalInterface,
  getAdvancedDashboardData
};