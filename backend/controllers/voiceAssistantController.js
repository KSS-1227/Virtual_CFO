const { generateProactiveResponse, generateBusinessAlerts, generateSpeechResponse, interpretInventoryVoiceCommand } = require("../config/openai");
const { getAuthenticatedClient } = require("../config/supabase");
const { asyncHandler } = require("../middleware/errorHandler");
const { recordStockMovement } = require("./inventoryController");

// Proactive Voice Command Processing
const processProactiveCommand = asyncHandler(async (req, res) => {
  try {
    const { command, context, timestamp } = req.body;
    const supabase = getAuthenticatedClient(req.accessToken);
    
    // Get comprehensive business context
    const businessContext = await getEnhancedBusinessContext(supabase, req.user.id);
    
    // Process command with advanced AI
    const response = await generateProactiveResponse(command, {
      ...context,
      ...businessContext,
      user_id: req.user.id,
      timestamp
    });
    
    // Log interaction for learning
    await logVoiceInteraction(supabase, {
      user_id: req.user.id,
      command,
      response: response.message,
      action: response.action,
      confidence: response.confidence,
      timestamp
    });
    
    // Execute immediate actions if needed
    if (response.immediate_action) {
      await executeImmediateAction(supabase, response.immediate_action, req.user.id);
    }
    
    res.json({
      success: true,
      data: {
        message: response.message,
        action: response.action,
        data: response.data,
        priority: response.priority,
        confidence: response.confidence,
        follow_up_suggestions: response.follow_up_suggestions
      }
    });
    
  } catch (error) {
    console.error("Proactive command processing error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process voice command"
    });
  }
});

// Generate Business Alerts
const generateAlerts = asyncHandler(async (req, res) => {
  try {
    const { business_context, alert_preferences } = req.body;
    const supabase = getAuthenticatedClient(req.accessToken);
    
    // Get real-time business metrics
    const metrics = await getRealTimeMetrics(supabase, req.user.id);
    
    // Generate intelligent alerts
    const alerts = await generateBusinessAlerts({
      metrics,
      context: business_context,
      preferences: alert_preferences,
      user_id: req.user.id
    });
    
    // Store alerts for tracking
    if (alerts.length > 0) {
      await storeBusinessAlerts(supabase, alerts, req.user.id);
    }
    
    res.json({
      success: true,
      data: {
        alerts,
        metrics_summary: metrics.summary,
        next_check: new Date(Date.now() + 3600000).toISOString() // 1 hour
      }
    });
    
  } catch (error) {
    console.error("Alert generation error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate business alerts"
    });
  }
});

// Enhanced Speech Generation
const generateSpeech = asyncHandler(async (req, res) => {
  try {
    const { text, language, emotion, voice_profile } = req.body;
    
    // Enhance text based on emotion and context
    const enhancedText = await enhanceTextForSpeech(text, emotion, language);
    
    // Generate speech with appropriate voice settings
    const audioResponse = await generateSpeechResponse(enhancedText, language, {
      emotion,
      voice_profile,
      speed: emotion === 'urgent' ? 1.1 : 0.9,
      pitch: emotion === 'positive' ? 1.1 : 1.0
    });
    
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="voice-response.mp3"');
    
    audioResponse.body.pipe(res);
    
  } catch (error) {
    console.error("Speech generation error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate speech"
    });
  }
});

// Start Business Monitoring
const startMonitoring = asyncHandler(async (req, res) => {
  try {
    const { monitoring_preferences } = req.body;
    const supabase = getAuthenticatedClient(req.accessToken);
    
    // Store monitoring preferences
    await supabase
      .from('voice_monitoring')
      .upsert({
        user_id: req.user.id,
        preferences: monitoring_preferences,
        status: 'active',
        last_check: new Date().toISOString()
      });
    
    // Initialize background monitoring (would be handled by a separate service)
    const monitoringId = await initializeBackgroundMonitoring(req.user.id, monitoring_preferences);
    
    res.json({
      success: true,
      data: {
        monitoring_id: monitoringId,
        status: 'active',
        next_check: new Date(Date.now() + 300000).toISOString(), // 5 minutes
        thresholds: monitoring_preferences
      }
    });
    
  } catch (error) {
    console.error("Monitoring initialization error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to start business monitoring"
    });
  }
});

// Inventory voice command handler
// Expects a transcribed text in req.body.transcription
const processInventoryVoice = asyncHandler(async (req, res) => {
  try {
    const { transcription } = req.body || {};
    if (!transcription || typeof transcription !== "string") {
      return res.status(400).json({
        success: false,
        error: "transcription is required",
      });
    }

    const supabase = getAuthenticatedClient(req.accessToken);
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", req.user.id)
      .single();

    // Let OpenAI interpret the command
    const command = await interpretInventoryVoiceCommand(transcription, profile || {});

    // Confidence gating: if low confidence, do NOT mutate inventory, ask for confirmation on client.
    const CONFIDENCE_THRESHOLD = 0.6;
    if (!command.product_name || command.confidence < CONFIDENCE_THRESHOLD) {
      return res.json({
        success: true,
        data: {
          command,
          movement: null,
          needs_confirmation: true,
        },
      });
    }

    // Map action to stock movement where applicable
    let movementResult = null;
    if (command.action === "stock_in" || command.action === "stock_out") {
      // Call underlying inventory controller logic programmatically
      const fakeReq = {
        ...req,
        body: {
          product_name: command.product_name,
          direction: command.action === "stock_in" ? "in" : "out",
          quantity: command.quantity || 1,
          source: "voice",
          metadata: {
            unit: command.unit,
            confidence: command.confidence,
            raw_transcription: transcription,
          },
        },
      };

      // We can't directly reuse Express res here; call the function and capture result via Promise wrapper
      movementResult = await new Promise((resolve, reject) => {
        const fakeRes = {
          status: (code) => ({
            json: (payload) => {
              if (code >= 400) reject(Object.assign(new Error(payload.error || "Inventory error"), { code }));
              else resolve(payload);
            },
          }),
          json: (payload) => resolve(payload),
        };

        recordStockMovement(fakeReq, fakeRes, reject);
      });
    }

    res.json({
      success: true,
      data: {
        command,
        movement: movementResult?.data || null,
      },
    });
  } catch (error) {
    console.error("Inventory voice command error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process inventory voice command",
    });
  }
});

// Generate Intelligent Reports
const generateReport = asyncHandler(async (req, res) => {
  try {
    const { report_type, parameters, delivery_method } = req.body;
    const supabase = getAuthenticatedClient(req.accessToken);
    
    // Get data for report
    const reportData = await getReportData(supabase, req.user.id, report_type, parameters);
    
    // Generate AI-powered report
    const report = await generateIntelligentReport(reportData, report_type, parameters);
    
    // Format for voice delivery if requested
    if (delivery_method === 'voice') {
      report.voice_summary = await generateVoiceSummary(report.content);
    }
    
    res.json({
      success: true,
      data: {
        report,
        generated_at: new Date().toISOString(),
        delivery_method
      }
    });
    
  } catch (error) {
    console.error("Report generation error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate report"
    });
  }
});

// Helper Functions
const getEnhancedBusinessContext = async (supabase, userId) => {
  try {
    const [profile, recentEarnings, monthlyData, alerts] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('earnings').select('*').eq('user_id', userId).order('earning_date', { ascending: false }).limit(30),
      supabase.from('monthly_summaries').select('*').eq('user_id', userId).order('year', { ascending: false }).order('month_number', { ascending: false }).limit(12),
      supabase.from('business_alerts').select('*').eq('user_id', userId).eq('status', 'active').limit(10)
    ]);
    
    return {
      profile: profile.data,
      recent_performance: recentEarnings.data,
      monthly_trends: monthlyData.data,
      active_alerts: alerts.data,
      business_health: calculateBusinessHealth(recentEarnings.data, monthlyData.data)
    };
  } catch (error) {
    console.error('Error getting business context:', error);
    return {};
  }
};

const getRealTimeMetrics = async (supabase, userId) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().substring(0, 7);
    
    const [todayData, monthData, trends] = await Promise.all([
      supabase.from('earnings').select('*').eq('user_id', userId).eq('earning_date', today),
      supabase.from('earnings').select('*').eq('user_id', userId).gte('earning_date', `${thisMonth}-01`),
      supabase.from('monthly_summaries').select('*').eq('user_id', userId).order('year', { ascending: false }).order('month_number', { ascending: false }).limit(3)
    ]);
    
    const todayRevenue = todayData.data?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
    const todayExpenses = todayData.data?.reduce((sum, item) => sum + (item.inventory_cost || 0), 0) || 0;
    const monthRevenue = monthData.data?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
    
    return {
      today: { revenue: todayRevenue, expenses: todayExpenses, profit: todayRevenue - todayExpenses },
      month: { revenue: monthRevenue },
      trends: trends.data,
      summary: {
        cash_flow: todayRevenue - todayExpenses,
        daily_target_progress: todayRevenue / 10000 * 100, // Assuming 10k daily target
        month_progress: new Date().getDate() / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() * 100
      }
    };
  } catch (error) {
    console.error('Error getting real-time metrics:', error);
    return { summary: {} };
  }
};

const logVoiceInteraction = async (supabase, interaction) => {
  try {
    await supabase.from('voice_interactions').insert(interaction);
  } catch (error) {
    console.error('Error logging voice interaction:', error);
  }
};

const executeImmediateAction = async (supabase, action, userId) => {
  try {
    switch (action.type) {
      case 'add_expense':
        await supabase.from('earnings').insert({
          user_id: userId,
          amount: 0,
          inventory_cost: action.data.amount,
          earning_date: new Date().toISOString().split('T')[0],
          processed_text: `Voice: ${action.data.description}`,
          doc_type: 'voice_expense'
        });
        break;
      case 'create_alert':
        await supabase.from('business_alerts').insert({
          user_id: userId,
          type: action.data.type,
          message: action.data.message,
          priority: action.data.priority,
          status: 'active'
        });
        break;
      default:
        console.log('Unknown immediate action:', action.type);
    }
  } catch (error) {
    console.error('Error executing immediate action:', error);
  }
};

const calculateBusinessHealth = (recentEarnings, monthlyData) => {
  if (!recentEarnings?.length || !monthlyData?.length) return { score: 0, status: 'insufficient_data' };
  
  const totalRevenue = recentEarnings.reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalExpenses = recentEarnings.reduce((sum, item) => sum + (item.inventory_cost || 0), 0);
  const profitMargin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0;
  
  let score = 50; // Base score
  if (profitMargin > 20) score += 30;
  else if (profitMargin > 10) score += 20;
  else if (profitMargin > 5) score += 10;
  
  return {
    score: Math.min(100, score),
    profit_margin: profitMargin,
    status: score > 80 ? 'excellent' : score > 60 ? 'good' : score > 40 ? 'average' : 'needs_attention'
  };
};

module.exports = {
  processProactiveCommand,
  generateAlerts,
  generateSpeech,
  startMonitoring,
  generateReport,
  processInventoryVoice,
};
