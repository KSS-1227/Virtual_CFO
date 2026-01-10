const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
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
} = require('../controllers/professionalInventoryController');

// Apply authentication to all routes
router.use(authenticateToken);

// ==================== SMART SUGGESTIONS API ====================
/**
 * @route POST /api/inventory/professional/suggestions
 * @desc Get smart autocomplete suggestions for inventory fields
 * @body { type: 'product_name|category|supplier|location|reorder_point', query: string, context?: object }
 */
router.post('/suggestions', getSmartSuggestions);

/**
 * @route POST /api/inventory/professional/suggestions/selection
 * @desc Record user selection for learning improvement
 * @body { type: string, query: string, selectedSuggestion: object, context?: object }
 */
router.post('/suggestions/selection', recordSuggestionSelection);

// ==================== SUPPLIER PRIORITIZATION API ====================
/**
 * @route GET /api/inventory/professional/suppliers/prioritized
 * @desc Get prioritized suppliers for a product/category
 * @query { productName?: string, category?: string, context?: object }
 */
router.get('/suppliers/prioritized', getPrioritizedSuppliers);

/**
 * @route POST /api/inventory/professional/suppliers/categories/dynamic
 * @desc Create dynamic category with auto-assignment rules
 * @body { name: string, type: string, criteria: object, autoRules: object, weights: object }
 */
router.post('/suppliers/categories/dynamic', createDynamicCategory);

/**
 * @route POST /api/inventory/professional/suppliers/feedback
 * @desc Record supplier performance feedback
 * @body { supplierId: string, feedback: { delivery: number, quality: number, communication: number, reliability: number, overall: number, comments?: string, orderReference?: string } }
 */
router.post('/suppliers/feedback', recordSupplierFeedback);

// ==================== SEASONAL DEMAND & REORDER INTELLIGENCE API ====================
/**
 * @route GET /api/inventory/professional/seasonal/analysis
 * @desc Analyze seasonal demand patterns for a product
 * @query { productName: string, category: string }
 */
router.get('/seasonal/analysis', analyzeSeasonalPatterns);

/**
 * @route GET /api/inventory/professional/seasonal/recommendations/current
 * @desc Get current month reorder recommendations
 * @query { productName: string, category: string }
 */
router.get('/seasonal/recommendations/current', getCurrentMonthRecommendations);

// ==================== MULTI-MODAL INTEGRATION API ====================
/**
 * @route POST /api/inventory/professional/multimodal/process
 * @desc Process combined image, voice, and text inputs
 * @body { inputs: { images?: array, voice?: object, text?: string }, workflowType?: string }
 */
router.post('/multimodal/process', processMultiModalInput);

/**
 * @route POST /api/inventory/professional/multimodal/conversation/continue
 * @desc Continue conversational flow for multi-modal processing
 * @body { sessionId: string, userResponse: string }
 */
router.post('/multimodal/conversation/continue', continueConversationalFlow);

// ==================== FORMAL LEARNING & FEEDBACK API ====================
/**
 * @route POST /api/inventory/professional/learning/correction
 * @desc Record user correction for system learning
 * @body { originalData: object, correctedData: object, context?: object }
 */
router.post('/learning/correction', recordUserCorrection);

/**
 * @route POST /api/inventory/professional/learning/feedback
 * @desc Record performance feedback for adaptive learning
 * @body { feedbackType: 'accuracy|relevance|completeness|timeliness|usability', rating: number, context?: object }
 */
router.post('/learning/feedback', recordPerformanceFeedback);

/**
 * @route GET /api/inventory/professional/learning/suggestions/personalized
 * @desc Get personalized suggestions based on learning patterns
 * @query { context?: object }
 */
router.get('/learning/suggestions/personalized', getPersonalizedSuggestions);

// ==================== COMPREHENSIVE ANALYSIS API ====================
/**
 * @route GET /api/inventory/professional/analysis/comprehensive
 * @desc Get comprehensive analysis combining all AI features
 * @query { productName: string, category: string }
 */
router.get('/analysis/comprehensive', getComprehensiveAnalysis);

/**
 * @route POST /api/inventory/professional/conversation
 * @desc Conversational interface for inventory management
 * @body { message: string, context?: object, sessionId?: string }
 */
router.post('/conversation', inventoryConversationalInterface);

/**
 * @route GET /api/inventory/professional/dashboard/advanced
 * @desc Get advanced dashboard data with all insights
 */
router.get('/dashboard/advanced', getAdvancedDashboardData);

// ==================== CONFLICT RESOLUTION API ====================
/**
 * @route POST /api/inventory/professional/conflicts/resolve
 * @desc Resolve data conflicts from multiple sources
 */
router.post('/conflicts/resolve', async (req, res) => {
  try {
    const userId = req.user.id;
    const { conflicts, resolutions } = req.body;
    
    // Process conflict resolutions
    const results = [];
    for (const resolution of resolutions) {
      // Apply resolution logic
      results.push({
        conflictId: resolution.conflictId,
        resolved: true,
        selectedValue: resolution.selectedValue,
        confidence: resolution.confidence || 0.8
      });
    }
    
    res.json({
      success: true,
      data: {
        resolvedConflicts: results.length,
        results
      }
    });
  } catch (error) {
    console.error('Conflict resolution error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve conflicts'
    });
  }
});

// ==================== BATCH OPERATIONS API ====================
/**
 * @route POST /api/inventory/professional/batch/suggestions
 * @desc Get suggestions for multiple items in batch
 */
router.post('/batch/suggestions', async (req, res) => {
  try {
    const userId = req.user.id;
    const { items } = req.body; // Array of { type, query, context }
    
    const smartSuggestionsService = require('../services/smartSuggestionsService');
    
    const batchResults = await Promise.all(
      items.map(async (item) => {
        const suggestions = await smartSuggestionsService.getSmartSuggestions(
          userId,
          item.type,
          item.query,
          item.context || {}
        );
        return {
          ...item,
          suggestions
        };
      })
    );
    
    res.json({
      success: true,
      data: {
        batchResults,
        totalItems: items.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Batch suggestions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process batch suggestions'
    });
  }
});

/**
 * @route POST /api/inventory/professional/batch/analysis
 * @desc Analyze multiple products for seasonal and supplier patterns
 */
router.post('/batch/analysis', async (req, res) => {
  try {
    const userId = req.user.id;
    const { products } = req.body; // Array of { productName, category }
    
    const seasonalDemandService = require('../services/seasonalDemandService');
    const supplierPrioritizationService = require('../services/supplierPrioritizationService');
    
    const batchAnalysis = await Promise.all(
      products.map(async (product) => {
        const [seasonal, suppliers] = await Promise.all([
          seasonalDemandService.analyzeSeasonalPatterns(userId, product.productName, product.category),
          supplierPrioritizationService.getPrioritizedSuppliers(userId, product.productName, product.category)
        ]);
        
        return {
          product,
          seasonal,
          suppliers,
          analysisTimestamp: new Date().toISOString()
        };
      })
    );
    
    res.json({
      success: true,
      data: {
        batchAnalysis,
        totalProducts: products.length,
        summary: {
          avgSeasonalConfidence: batchAnalysis.reduce((sum, a) => sum + (a.seasonal.confidence || 0.5), 0) / batchAnalysis.length,
          avgSupplierScore: batchAnalysis.reduce((sum, a) => sum + (a.suppliers.averageScore || 0.5), 0) / batchAnalysis.length
        }
      }
    });
  } catch (error) {
    console.error('Batch analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process batch analysis'
    });
  }
});

// ==================== LEARNING ANALYTICS API ====================
/**
 * @route GET /api/inventory/professional/learning/analytics
 * @desc Get learning analytics and improvement metrics
 */
router.get('/learning/analytics', async (req, res) => {
  try {
    const userId = req.user.id;
    const formalLearningService = require('../services/formalLearningService');
    
    const analytics = await formalLearningService.getAdaptiveUpdates(userId);
    
    res.json({
      success: true,
      data: {
        analytics,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Learning analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get learning analytics'
    });
  }
});

// ==================== PERFORMANCE OPTIMIZATION API ====================
/**
 * @route GET /api/inventory/professional/performance/metrics
 * @desc Get performance metrics and optimization suggestions
 */
router.get('/performance/metrics', async (req, res) => {
  try {
    const userId = req.user.id;
    const performanceOptimizationService = require('../services/performanceOptimizationService');
    
    const metrics = await performanceOptimizationService.getPerformanceMetrics(userId);
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Performance metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get performance metrics'
    });
  }
});

/**
 * @route POST /api/inventory/professional/performance/optimize
 * @desc Trigger performance optimization
 */
router.post('/performance/optimize', async (req, res) => {
  try {
    const userId = req.user.id;
    const { optimizationType = 'full' } = req.body;
    
    const performanceOptimizationService = require('../services/performanceOptimizationService');
    
    const result = await performanceOptimizationService.optimizePerformance(userId, optimizationType);
    
    res.json({
      success: true,
      data: result,
      message: 'Performance optimization completed'
    });
  } catch (error) {
    console.error('Performance optimization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to optimize performance'
    });
  }
});

// ==================== EXPORT/IMPORT API ====================
/**
 * @route GET /api/inventory/professional/export/learning-patterns
 * @desc Export learning patterns for backup or analysis
 */
router.get('/export/learning-patterns', async (req, res) => {
  try {
    const userId = req.user.id;
    const { getAuthenticatedClient } = require('../config/supabase');
    const supabase = getAuthenticatedClient(req.accessToken);
    
    const { data: patterns } = await supabase
      .from('inventory_learning_patterns')
      .select('*')
      .eq('user_id', userId);
    
    res.json({
      success: true,
      data: {
        patterns: patterns || [],
        exportDate: new Date().toISOString(),
        totalPatterns: patterns?.length || 0
      }
    });
  } catch (error) {
    console.error('Export learning patterns error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export learning patterns'
    });
  }
});

/**
 * @route POST /api/inventory/professional/import/learning-patterns
 * @desc Import learning patterns from backup
 */
router.post('/import/learning-patterns', async (req, res) => {
  try {
    const userId = req.user.id;
    const { patterns } = req.body;
    const { getAuthenticatedClient } = require('../config/supabase');
    const supabase = getAuthenticatedClient(req.accessToken);
    
    // Validate and import patterns
    const validPatterns = patterns.filter(p => p.pattern_type && p.pattern_data);
    const importData = validPatterns.map(p => ({
      ...p,
      user_id: userId,
      imported_at: new Date().toISOString()
    }));
    
    const { data, error } = await supabase
      .from('inventory_learning_patterns')
      .upsert(importData);
    
    if (error) throw error;
    
    res.json({
      success: true,
      data: {
        importedPatterns: validPatterns.length,
        skippedPatterns: patterns.length - validPatterns.length
      },
      message: 'Learning patterns imported successfully'
    });
  } catch (error) {
    console.error('Import learning patterns error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import learning patterns'
    });
  }
});

module.exports = router;