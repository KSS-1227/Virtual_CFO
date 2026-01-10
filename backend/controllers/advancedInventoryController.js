const { getAuthenticatedClient } = require("../config/supabase");
const { asyncHandler } = require("../middleware/errorHandler");
const { AdvancedVoiceService } = require("../services/advancedVoiceService");
const { SmartSuggestionsService } = require("../services/smartSuggestionsService");
const { MultiModalIntegrationService } = require("../services/multiModalIntegrationService");
const { InventoryBusinessIntelligenceService } = require("../services/inventoryBusinessIntelligence");
const multer = require("multer");

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and audio files are allowed'), false);
    }
  }
});

// Initialize services
const voiceService = new AdvancedVoiceService();
const suggestionsService = new SmartSuggestionsService();
const multiModalService = new MultiModalIntegrationService();
const biService = new InventoryBusinessIntelligenceService();

/**
 * POST /api/inventory/voice-command
 * Process voice commands for inventory operations
 */
const processVoiceCommand = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);
  
  if (!req.file || !req.file.mimetype.startsWith('audio/')) {
    return res.status(400).json({
      success: false,
      error: "Audio file is required"
    });
  }

  try {
    const result = await voiceService.processMixedLanguageCommand(
      req.file.buffer,
      req.user.id,
      supabase
    );

    // If clarification is needed, return clarification questions
    if (result.parsed_command.needs_clarification) {
      return res.json({
        success: true,
        needs_clarification: true,
        clarifications: result.parsed_command.clarifications_needed,
        original_command: result.parsed_command,
        transcription: result.transcription
      });
    }

    // Execute the inventory operation
    const executionResult = await executeInventoryOperation(
      result.parsed_command,
      req.user.id,
      supabase
    );

    // Generate audio confirmation
    const confirmation = await voiceService.generateAudioConfirmation(
      result.parsed_command,
      req.body.preferred_language || 'mixed',
      supabase
    );

    res.json({
      success: true,
      voice_result: result,
      execution_result: executionResult,
      audio_confirmation: confirmation.confirmation_text,
      // Note: In production, you'd stream the audio or provide a URL
      audio_available: true
    });

  } catch (error) {
    console.error("Voice command processing error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process voice command",
      details: error.message
    });
  }
});

/**
 * POST /api/inventory/voice-clarification
 * Handle clarification responses for ambiguous voice commands
 */
const handleVoiceClarification = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);
  const { original_command, clarification_responses } = req.body;

  if (!original_command || !clarification_responses) {
    return res.status(400).json({
      success: false,
      error: "Original command and clarification responses are required"
    });
  }

  try {
    const clarifiedCommand = await voiceService.handleClarificationResponse(
      req.user.id,
      original_command,
      clarification_responses,
      supabase
    );

    // Execute the clarified command
    const executionResult = await executeInventoryOperation(
      clarifiedCommand,
      req.user.id,
      supabase
    );

    res.json({
      success: true,
      clarified_command: clarifiedCommand,
      execution_result: executionResult
    });

  } catch (error) {
    console.error("Voice clarification error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process clarification",
      details: error.message
    });
  }
});

/**
 * POST /api/inventory/image-processing
 * Process images for inventory data extraction
 */
const processInventoryImage = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);
  
  if (!req.file || !req.file.mimetype.startsWith('image/')) {
    return res.status(400).json({
      success: false,
      error: "Image file is required"
    });
  }

  try {
    const result = await multiModalService.processInventoryImage(
      req.file.buffer,
      req.user.id,
      supabase
    );

    res.json({
      success: true,
      image_result: result,
      processing_time: Date.now()
    });

  } catch (error) {
    console.error("Image processing error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process image",
      details: error.message
    });
  }
});

/**
 * POST /api/inventory/multimodal
 * Process combined voice and image inputs
 */
const processMultiModalInput = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);
  
  // Expect both audio and image files
  const audioFile = req.files?.audio?.[0];
  const imageFile = req.files?.image?.[0];

  if (!audioFile || !imageFile) {
    return res.status(400).json({
      success: false,
      error: "Both audio and image files are required"
    });
  }

  try {
    const result = await multiModalService.processVoiceImageCombination(
      audioFile.buffer,
      imageFile.buffer,
      req.user.id,
      supabase
    );

    // If conflicts need resolution, return them
    if (result.merged_result.needs_clarification) {
      return res.json({
        success: true,
        needs_clarification: true,
        conflicts: result.merged_result.conflicts,
        validation_issues: result.merged_result.validation_issues,
        multimodal_result: result
      });
    }

    // Execute the merged command
    const executionResult = await executeInventoryOperation(
      result.merged_result,
      req.user.id,
      supabase
    );

    res.json({
      success: true,
      multimodal_result: result,
      execution_result: executionResult
    });

  } catch (error) {
    console.error("Multi-modal processing error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process multi-modal input",
      details: error.message
    });
  }
});

/**
 * POST /api/inventory/receipt-processing
 * Process receipts for automatic inventory updates
 */
const processReceiptForInventory = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);
  
  if (!req.file || !req.file.mimetype.startsWith('image/')) {
    return res.status(400).json({
      success: false,
      error: "Receipt image is required"
    });
  }

  try {
    const result = await multiModalService.processReceiptForInventoryUpdate(
      req.file.buffer,
      req.user.id,
      supabase
    );

    res.json({
      success: true,
      receipt_processing_result: result,
      items_processed: result.inventory_updates.length
    });

  } catch (error) {
    console.error("Receipt processing error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process receipt",
      details: error.message
    });
  }
});

/**
 * GET /api/inventory/suggestions
 * Get intelligent suggestions for products, categories, suppliers
 */
const getIntelligentSuggestions = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);
  const { type, query, context } = req.query;

  try {
    let suggestions = [];

    switch (type) {
      case 'products':
        suggestions = await suggestionsService.getProductSuggestions(
          req.user.id,
          query,
          supabase,
          parseInt(req.query.limit) || 10
        );
        break;
      
      case 'categories':
        suggestions = await suggestionsService.getCategorySuggestions(
          req.user.id,
          context, // product name
          query,
          supabase
        );
        break;
      
      case 'suppliers':
        suggestions = await suggestionsService.getSupplierSuggestions(
          req.user.id,
          query,
          supabase
        );
        break;
      
      case 'historical':
        suggestions = await suggestionsService.getHistoricalRecommendations(
          req.user.id,
          JSON.parse(context || '{}'),
          supabase
        );
        break;
      
      default:
        return res.status(400).json({
          success: false,
          error: "Invalid suggestion type. Use: products, categories, suppliers, historical"
        });
    }

    res.json({
      success: true,
      suggestions,
      type,
      query
    });

  } catch (error) {
    console.error("Suggestions error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get suggestions",
      details: error.message
    });
  }
});

/**
 * GET /api/inventory/business-insights
 * Generate comprehensive business intelligence insights
 */
const getBusinessInsights = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);

  try {
    const insights = await biService.generatePersonalizedInsights(
      req.user.id,
      supabase
    );

    res.json({
      success: true,
      insights: insights.insights,
      generated_at: insights.generated_at,
      data_period: insights.data_period
    });

  } catch (error) {
    console.error("Business insights error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate business insights",
      details: error.message
    });
  }
});

/**
 * GET /api/inventory/reorder-recommendations
 * Get AI-powered reorder recommendations
 */
const getReorderRecommendations = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);

  try {
    const recommendations = await biService.generateReorderRecommendations(
      req.user.id,
      supabase
    );

    res.json({
      success: true,
      recommendations: recommendations.recommendations,
      total_analyzed: recommendations.total_items_analyzed,
      needs_reorder: recommendations.items_needing_reorder
    });

  } catch (error) {
    console.error("Reorder recommendations error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate reorder recommendations",
      details: error.message
    });
  }
});

/**
 * GET /api/inventory/seasonal-predictions
 * Get seasonal demand predictions
 */
const getSeasonalPredictions = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);
  const { target_month } = req.query;

  if (!target_month || isNaN(parseInt(target_month))) {
    return res.status(400).json({
      success: false,
      error: "Valid target_month (1-12) is required"
    });
  }

  try {
    const predictions = await biService.predictSeasonalDemand(
      req.user.id,
      parseInt(target_month),
      supabase
    );

    res.json({
      success: true,
      predictions: predictions.predictions,
      target_month: predictions.target_month,
      confidence_threshold: predictions.confidence_threshold
    });

  } catch (error) {
    console.error("Seasonal predictions error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate seasonal predictions",
      details: error.message
    });
  }
});

/**
 * GET /api/inventory/slow-movers
 * Identify slow-moving inventory items
 */
const getSlowMovingItems = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);

  try {
    const slowMovers = await biService.identifySlowMovingInventory(
      req.user.id,
      supabase
    );

    res.json({
      success: true,
      slow_moving_items: slowMovers.slow_moving_items,
      threshold_days: slowMovers.threshold_days,
      total_analyzed: slowMovers.total_items_analyzed
    });

  } catch (error) {
    console.error("Slow movers identification error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to identify slow-moving items",
      details: error.message
    });
  }
});

/**
 * GET /api/inventory/analytics-dashboard
 * Get comprehensive analytics dashboard data
 */
const getAnalyticsDashboard = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);
  const { start_date, end_date } = req.query;

  const dateRange = {
    start: start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    end: end_date || new Date().toISOString()
  };

  try {
    const analytics = await biService.generateAnalyticsDashboard(
      req.user.id,
      dateRange,
      supabase
    );

    res.json({
      success: true,
      analytics: analytics.analytics,
      date_range: analytics.date_range,
      generated_at: analytics.generated_at
    });

  } catch (error) {
    console.error("Analytics dashboard error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate analytics dashboard",
      details: error.message
    });
  }
});

/**
 * POST /api/inventory/ai-optimization
 * Get AI-powered optimization suggestions
 */
const getAIOptimizationSuggestions = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);

  try {
    const suggestions = await biService.generateAIOptimizationSuggestions(
      req.user.id,
      supabase
    );

    res.json({
      success: true,
      ai_suggestions: suggestions.ai_suggestions,
      confidence: suggestions.confidence,
      generated_at: suggestions.generated_at
    });

  } catch (error) {
    console.error("AI optimization suggestions error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate AI optimization suggestions",
      details: error.message
    });
  }
});

/**
 * POST /api/inventory/batch-processing
 * Process batch inventory updates
 */
const processBatchInventoryUpdate = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);
  const { batch_data } = req.body;

  if (!batch_data || !Array.isArray(batch_data)) {
    return res.status(400).json({
      success: false,
      error: "batch_data array is required"
    });
  }

  try {
    const result = await multiModalService.processBatchInventoryUpdate(
      batch_data,
      req.user.id,
      supabase
    );

    res.json({
      success: true,
      batch_result: result,
      processed_items: result.processed_items,
      failed_items: result.failed_items
    });

  } catch (error) {
    console.error("Batch processing error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process batch update",
      details: error.message
    });
  }
});

/**
 * Helper function to execute inventory operations
 */
async function executeInventoryOperation(command, userId, supabase) {
  try {
    if (!command.action || !command.product_name || !command.quantity) {
      throw new Error("Incomplete command: missing action, product_name, or quantity");
    }

    // Use the existing inventory movement API
    const { data, error } = await supabase
      .from("inventory_stock_ledger")
      .insert({
        user_id: userId,
        item_id: null, // Will be resolved by existing logic
        direction: command.action === 'add' ? 'in' : 'out',
        quantity: command.quantity,
        source: command.source || 'voice',
        metadata: {
          original_command: command,
          unit: command.unit,
          confidence: command.confidence
        }
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Database operation failed: ${error.message}`);
    }

    return {
      success: true,
      operation: command.action,
      product_name: command.product_name,
      quantity: command.quantity,
      unit: command.unit,
      movement_id: data.id
    };

  } catch (error) {
    console.error("Error executing inventory operation:", error);
    return {
      success: false,
      error: error.message,
      command
    };
  }
}

// Configure multer middleware for different endpoints
const singleFileUpload = upload.single('file');
const multiFileUpload = upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'image', maxCount: 1 }
]);

module.exports = {
  processVoiceCommand: [singleFileUpload, processVoiceCommand],
  handleVoiceClarification,
  processInventoryImage: [singleFileUpload, processInventoryImage],
  processMultiModalInput: [multiFileUpload, processMultiModalInput],
  processReceiptForInventory: [singleFileUpload, processReceiptForInventory],
  getIntelligentSuggestions,
  getBusinessInsights,
  getReorderRecommendations,
  getSeasonalPredictions,
  getSlowMovingItems,
  getAnalyticsDashboard,
  getAIOptimizationSuggestions,
  processBatchInventoryUpdate
};