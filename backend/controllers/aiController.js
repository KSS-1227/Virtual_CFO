const { generateFinancialAdvice, openai } = require("../config/openai");
const { getAuthenticatedClient } = require("../config/supabase");
const { asyncHandler } = require("../middleware/errorHandler");
const streamingTelemetry = require("../services/streamingTelemetry");
const { v4: uuidv4 } = require("uuid");
const graphRAG = require("../config/graphRAG");

// Helper function to store conversation history
const storeConversationHistory = async (userId, conversationId, userMessage, aiResponse, accessToken) => {
  try {
    const supabase = getAuthenticatedClient(accessToken);
    
    // Store user message
    await supabase.from("conversation_history").insert({
      user_id: userId,
      conversation_id: conversationId,
      message_type: "user",
      message_content: userMessage,
      created_at: new Date().toISOString()
    });
    
    // Store AI response
    await supabase.from("conversation_history").insert({
      user_id: userId,
      conversation_id: conversationId,
      message_type: "ai",
      message_content: aiResponse,
      created_at: new Date().toISOString()
    });
    
    console.log(`[CHAT] Conversation stored: ${conversationId}`);
  } catch (error) {
    console.error("Error storing conversation:", error);
  }
};

// AI Chat Assistant for financial advice (non-streaming)
const chatAssistant = asyncHandler(async (req, res) => {
  const { message } = req.body;

  // Validate input
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: "Message is required and must be a non-empty string",
      data: null,
    });
  }

  if (message.length > 1000) {
    return res.status(400).json({
      success: false,
      error: "Message too long. Please limit to 1000 characters",
      data: null,
    });
  }

  try {
    const userId = req.user.id;
    const conversationId = uuidv4();
    
    // Get user profile for context
    const supabase = getAuthenticatedClient(req.accessToken);
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    // Generate AI response
    const aiResponse = await generateFinancialAdvice(
      message.trim(),
      profile || {}
    );

    // Store conversation history
    await storeConversationHistory(
      userId,
      conversationId,
      message.trim(),
      aiResponse,
      req.accessToken
    );

    // Extract and store knowledge entities
    try {
      const entities = graphRAG.extractEntities(aiResponse, profile || {});
      const relationships = graphRAG.buildRelationships(entities, {
        conversation_id: conversationId,
        type: "chat_response"
      });
      
      await graphRAG.storeKnowledge(userId, entities, relationships, conversationId);
      console.log(`[KNOWLEDGE] Stored ${entities.length} entities, ${relationships.length} relationships`);
    } catch (knowledgeError) {
      console.error("Knowledge extraction error:", knowledgeError);
      // Continue without failing the chat
    }

    res.json({
      success: true,
      data: {
        message: aiResponse,
        timestamp: new Date().toISOString(),
        conversation_id: conversationId,
        context_used: {
          has_profile: !!profile,
          business_type: profile?.business_type || null,
          has_revenue_data: !!profile?.monthly_revenue,
        },
      },
      error: null,
    });
  } catch (error) {
    console.error("AI Chat Error:", error);

    // Handle specific OpenAI errors
    if (error.message.includes("API key")) {
      return res.status(500).json({
        success: false,
        error: "AI service configuration error",
        data: null,
      });
    }

    if (error.message.includes("rate limit")) {
      return res.status(429).json({
        success: false,
        error: "AI service is busy. Please try again in a moment",
        data: null,
      });
    }

    res.status(500).json({
      success: false,
      error: "AI assistant is temporarily unavailable",
      data: null,
    });
  }
});

// Get chat history (now implemented)
const getChatHistory = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, conversation_id } = req.query;
    
    const supabase = getAuthenticatedClient(req.accessToken);
    
    let query = supabase
      .from("conversation_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(parseInt(limit));
    
    if (conversation_id) {
      query = query.eq("conversation_id", conversation_id);
    }
    
    const { data: history, error } = await query;
    
    if (error) throw error;
    
    // Group by conversation for better UX
    const conversations = {};
    history?.forEach(msg => {
      if (!conversations[msg.conversation_id]) {
        conversations[msg.conversation_id] = [];
      }
      conversations[msg.conversation_id].push(msg);
    });
    
    res.json({
      success: true,
      data: {
        history: history || [],
        conversations: conversations,
        total_messages: history?.length || 0,
        message: history?.length > 0 ? "Chat history retrieved successfully" : "No chat history found"
      },
      error: null,
    });
  } catch (error) {
    console.error("Get chat history error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve chat history",
      data: null,
    });
  }
});

// Get financial insights based on user profile
const getFinancialInsights = asyncHandler(async (req, res) => {
  try {
    // Get user profile
    const supabase = getAuthenticatedClient(req.accessToken);
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", req.user.id)
      .single();

    if (!profile || !profile.monthly_revenue || !profile.monthly_expenses) {
      return res.status(400).json({
        success: false,
        error: "Complete business profile required for financial insights",
        data: null,
      });
    }

    // Generate insights prompt
    const insightsPrompt = `Provide key financial insights and recommendations for my business:
    
    Business Type: ${profile.business_type}
    Monthly Revenue: ₹${profile.monthly_revenue}
    Monthly Expenses: ₹${profile.monthly_expenses}
    Location: ${profile.location}
    
    Please provide:
    1. Financial health assessment
    2. Key performance indicators
    3. Cost optimization opportunities
    4. Revenue growth strategies
    5. Cash flow management tips`;

    const aiInsights = await generateFinancialAdvice(insightsPrompt, profile);

    res.json({
      success: true,
      data: {
        insights: aiInsights,
        metrics: {
          monthly_revenue: profile.monthly_revenue,
          monthly_expenses: profile.monthly_expenses,
          net_profit: profile.monthly_revenue - profile.monthly_expenses,
          profit_margin: (
            ((profile.monthly_revenue - profile.monthly_expenses) /
              profile.monthly_revenue) *
            100
          ).toFixed(2),
        },
        generated_at: new Date().toISOString(),
      },
      error: null,
    });
  } catch (error) {
    console.error("Financial Insights Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate financial insights",
      data: null,
    });
  }
});

// Store active streams per user for concurrency control
const activeStreams = new Map(); // Map<userId, count>
const STREAM_MAX_CONCURRENT = 3; // Max concurrent streams per user
const STREAM_TIMEOUT_MS = 5 * 60 * 1000; // 5 min timeout per stream
const TELEMETRY_THRESHOLD_MS = 500; // Alert if first token > 500ms

// Helper: Estimate token cost (rough approximation)
const estimateTokenCost = (inputTokens, outputTokens, model = "gpt-4o-mini") => {
  const pricing = {
    "gpt-4o-mini": { input: 0.00015, output: 0.0006 }, // per token
    "gpt-4": { input: 0.00003, output: 0.00006 },
  };
  const rates = pricing[model] || pricing["gpt-4o-mini"];
  return (inputTokens * rates.input + outputTokens * rates.output).toFixed(6);
};

// Helper: Increment active stream count
const incrementActiveStream = (userId) => {
  const count = (activeStreams.get(userId) || 0) + 1;
  activeStreams.set(userId, count);
  return count;
};

// Helper: Decrement active stream count
const decrementActiveStream = (userId) => {
  const count = Math.max(0, (activeStreams.get(userId) || 1) - 1);
  if (count === 0) {
    activeStreams.delete(userId);
  } else {
    activeStreams.set(userId, count);
  }
};

// AI Streaming Chat Assistant with SSE
const streamChatAssistant = asyncHandler(async (req, res) => {
  const { prompt, model = "gpt-4o-mini", options = {} } = req.body;
  const userId = req.user.id;
  const conversationId = uuidv4(); // Add conversation ID
  const streamId = `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  let fullAIResponse = ""; // Store complete response
  const telemetry = {
    streamId,
    userId,
    model,
    startTime: Date.now(),
    firstTokenTime: null,
    tokenCount: 0,
    abortedByClient: false,
    errorOccurred: false
  };

  // Validate input
  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: "Prompt is required and must be a non-empty string"
    });
  }

  if (prompt.length > 2000) {
    return res.status(400).json({
      success: false,
      error: "Prompt too long. Please limit to 2000 characters"
    });
  }

  // Check concurrent stream limit per user
  const activeCount = incrementActiveStream(userId);
  if (activeCount > STREAM_MAX_CONCURRENT) {
    decrementActiveStream(userId);
    return res.status(429).json({
      success: false,
      error: `Too many concurrent streams. Max ${STREAM_MAX_CONCURRENT} allowed per user.`,
      data: { activeCount: activeCount - 1 }
    });
  }

  // Set SSE headers with proper CORS
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering (NGINX, etc)
  
  // CORS headers - allow Authorization header from client origin
  const origin = req.get('Origin') || req.get('Referer')?.split('/').slice(0, 3).join('/');
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  let streamClosed = false;
  let upstreamAbort = null;
  
  // Handle client disconnect and explicitly cancel upstream
  const cleanup = () => {
    streamClosed = true;
    decrementActiveStream(userId);
    
    if (upstreamAbort) {
      try {
        upstreamAbort.abort(); // Cancel upstream OpenAI request
        console.log(`[STREAMING] Upstream aborted for stream ${streamId}`);
      } catch (e) {
        console.error(`[STREAMING] Error aborting upstream: ${e.message}`);
      }
    }

    // Log telemetry
    const duration = Date.now() - telemetry.startTime;
    const timeToFirstToken = telemetry.firstTokenTime ? telemetry.firstTokenTime - telemetry.startTime : -1;
    const reason = telemetry.abortedByClient ? 'CLIENT_DISCONNECT' : telemetry.errorOccurred ? 'ERROR' : 'COMPLETED';
    
    console.log(`[TELEMETRY] Stream ${streamId} | Duration: ${duration}ms | TTF: ${timeToFirstToken}ms | Tokens: ${telemetry.tokenCount} | Reason: ${reason}`);
    
    // Record in telemetry service
    streamingTelemetry.recordStream({
      streamId,
      userId,
      model,
      tokenCount: telemetry.tokenCount,
      duration,
      timeToFirstToken: timeToFirstToken >= 0 ? timeToFirstToken : null,
      estimatedCost: telemetry.estimatedCost || 0,
      error: telemetry.errorOccurred,
      aborted: telemetry.abortedByClient,
    });
  };

  req.on('close', () => {
    telemetry.abortedByClient = true;
    cleanup();
  });

  // Apply stream timeout
  const timeoutHandle = setTimeout(() => {
    if (!streamClosed) {
      streamClosed = true;
      const errorData = { error: "Stream timeout exceeded", timestamp: new Date().toISOString() };
      res.write(`event: error\ndata: ${JSON.stringify(errorData)}\n\n`);
    }
    cleanup();
  }, STREAM_TIMEOUT_MS);

  try {
    // Get user profile for context
    const supabase = getAuthenticatedClient(req.accessToken);
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    // Create system prompt with user context
    const systemPrompt = `You are a Virtual CFO assistant for small and medium businesses in India. 
    Provide practical, actionable financial advice based on the user's business context.
    
    User Business Context:
    - Business Name: ${profile?.business_name || "Not specified"}
    - Business Type: ${profile?.business_type || "Not specified"}
    - Location: ${profile?.location || "India"}
    - Monthly Revenue: ₹${profile?.monthly_revenue || "Not specified"}
    - Monthly Expenses: ₹${profile?.monthly_expenses || "Not specified"}
    
    Guidelines:
    - Provide specific, actionable advice
    - Focus on Indian business context and regulations
    - Include relevant financial metrics and KPIs
    - Suggest practical implementation steps
    - Keep responses concise but comprehensive`;

    // Create abort controller for upstream request cancellation
    upstreamAbort = new AbortController();

    // Start streaming request to OpenAI
    const stream = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt.trim() }
      ],
      max_tokens: options.max_tokens || 1500,
      temperature: options.temperature || 0.7,
      stream: true
    }, {
      signal: upstreamAbort.signal // Pass abort signal
    });

    // Process stream chunks
    for await (const chunk of stream) {
      if (streamClosed) break;

      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        telemetry.tokenCount++;
        
        // Track first token arrival time
        if (telemetry.firstTokenTime === null) {
          telemetry.firstTokenTime = Date.now();
          const ttf = telemetry.firstTokenTime - telemetry.startTime;
          if (ttf > TELEMETRY_THRESHOLD_MS) {
            console.warn(`[TELEMETRY] Slow first token: ${ttf}ms for stream ${streamId}`);
          }
        }
        
        // Send token event
        const tokenData = {
          text: delta.content,
          tokenCount: telemetry.tokenCount,
          timestamp: new Date().toISOString()
        };
        
        // Accumulate full response
        fullAIResponse += delta.content;
        
        res.write(`event: token\ndata: ${JSON.stringify(tokenData)}\n\n`);
        
        // Flush buffer for real-time delivery
        if (res.flush) {
          res.flush();
        }
      }
    }

    if (!streamClosed) {
      // Estimate token costs
      const estimatedInputTokens = Math.ceil(prompt.length / 4); // Rough estimate
      const estimatedCost = estimateTokenCost(estimatedInputTokens, telemetry.tokenCount, model);
      telemetry.estimatedCost = parseFloat(estimatedCost);
      
      // Send completion metadata
      const metaData = {
        streamId,
        totalTokens: telemetry.tokenCount,
        model: model,
        completedAt: new Date().toISOString(),
        duration: Date.now() - telemetry.startTime,
        timeToFirstToken: telemetry.firstTokenTime ? telemetry.firstTokenTime - telemetry.startTime : -1,
        estimatedCost: telemetry.estimatedCost,
        contextUsed: {
          hasProfile: !!profile,
          businessType: profile?.business_type || null,
          hasRevenueData: !!profile?.monthly_revenue
        }
      };
      
      res.write(`event: meta\ndata: ${JSON.stringify(metaData)}\n\n`);
      res.write(`event: done\ndata: {"status":"completed"}\n\n`);
      
      // Store conversation after streaming completes
      if (fullAIResponse.trim()) {
        await storeConversationHistory(
          userId,
          conversationId,
          prompt.trim(),
          fullAIResponse,
          req.accessToken
        );
      }
    }

  } catch (error) {
    telemetry.errorOccurred = true;
    console.error(`[STREAMING] Error in stream ${streamId}:`, error);
    
    if (!streamClosed) {
      let errorMessage = "AI assistant is temporarily unavailable";
      let errorCode = "UNKNOWN_ERROR";
      
      if (error.message?.includes("API key")) {
        errorMessage = "AI service configuration error";
        errorCode = "CONFIG_ERROR";
      } else if (error.message?.includes("rate limit")) {
        errorMessage = "AI service is busy. Please try again in a moment";
        errorCode = "RATE_LIMIT";
      } else if (error.name === "AbortError") {
        errorMessage = "Stream was cancelled";
        errorCode = "ABORTED";
      }
      
      const errorData = {
        streamId,
        error: errorMessage,
        code: errorCode,
        timestamp: new Date().toISOString()
      };
      
      res.write(`event: error\ndata: ${JSON.stringify(errorData)}\n\n`);
    }
  } finally {
    clearTimeout(timeoutHandle);
    cleanup();
    
    if (!streamClosed) {
      res.end();
    }
  }
});

module.exports = {
  chatAssistant,
  getChatHistory,
  getFinancialInsights,
  streamChatAssistant,
};
