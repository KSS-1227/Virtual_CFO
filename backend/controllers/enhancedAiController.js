const { generateFinancialAdvice } = require("../config/openai");
const { getAuthenticatedClient } = require("../config/supabase");
const { asyncHandler } = require("../middleware/errorHandler");
const { v4: uuidv4 } = require("uuid");
const graphRAG = require("../config/graphRAG");

// Enhanced AI Chat Assistant with Graph RAG + Vector Search
const chatAssistantWithRAG = asyncHandler(async (req, res) => {
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

    // Try to use enhanced Graph RAG if available
    let relevantKnowledge = { entities: [], relationships: [], context: "" };
    try {
      const { EnhancedGraphRAG } = require("../services/vectorService");
      const enhancedRAG = new EnhancedGraphRAG();
      relevantKnowledge = await enhancedRAG.retrieveRelevantKnowledgeWithVectors(
        userId,
        message,
        profile || {}
      );
    } catch (vectorError) {
      console.log("Vector service not available, using basic Graph RAG:", vectorError.message);
      // Fallback to basic Graph RAG
      relevantKnowledge = await graphRAG.retrieveRelevantKnowledge(
        userId,
        message,
        profile || {}
      );
    }

    // Generate enhanced prompt with knowledge context
    const enhancedPrompt = graphRAG.generateEnhancedPrompt(
      message.trim(),
      relevantKnowledge,
      profile || {}
    );

    // Generate AI response with enhanced context
    const aiResponse = await generateFinancialAdvice(
      enhancedPrompt,
      profile || {}
    );

    // Extract entities from the AI response for knowledge accumulation
    const responseEntities = graphRAG.extractEntities(aiResponse, profile || {});
    const relationships = graphRAG.buildRelationships(responseEntities, {
      conversation_id: conversationId,
      type: "chat_response",
    });

    // Store knowledge with vectors if available
    try {
      const { EnhancedGraphRAG } = require("../services/vectorService");
      const enhancedRAG = new EnhancedGraphRAG();
      await enhancedRAG.storeKnowledgeWithVectors(
        userId,
        responseEntities,
        relationships,
        conversationId
      );
    } catch (vectorError) {
      console.log("Vector storage not available, using basic storage:", vectorError.message);
      // Fallback to basic storage
      await graphRAG.storeKnowledge(userId, responseEntities, relationships, conversationId);
    }

    // Store conversation history
    try {
      // Store user message
      await supabase.from("conversation_history").insert({
        user_id: userId,
        conversation_id: conversationId,
        message_type: "user",
        message_content: message.trim(),
        created_at: new Date().toISOString()
      });
      
      // Store AI response
      await supabase.from("conversation_history").insert({
        user_id: userId,
        conversation_id: conversationId,
        message_type: "ai",
        message_content: aiResponse,
        entities_extracted: {
          count: responseEntities.length,
          entities: responseEntities.map(e => e.entity)
        },
        knowledge_used: {
          entities_count: relevantKnowledge.entities.length,
          relationships_count: relevantKnowledge.relationships.length
        },
        created_at: new Date().toISOString()
      });
      
      console.log(`[GRAPH RAG] Stored conversation ${conversationId} with ${responseEntities.length} entities`);
    } catch (historyError) {
      console.error("Error storing conversation history:", historyError);
    }

    res.json({
      success: true,
      data: {
        message: aiResponse,
        timestamp: new Date().toISOString(),
        context_used: {
          has_profile: !!profile,
          business_type: profile?.business_type || null,
          has_revenue_data: !!profile?.monthly_revenue,
          knowledge_entities_used: relevantKnowledge.entities.length,
          knowledge_relationships_used: relevantKnowledge.relationships.length,
          search_metadata: relevantKnowledge.search_metadata,
        },
        conversation_id: conversationId,
        knowledge_summary: {
          new_entities_extracted: responseEntities.length,
          new_relationships_found: relationships.length,
        },
      },
      error: null,
    });
  } catch (error) {
    console.error("Graph RAG Chat Error:", error);

    // Fallback to regular AI response
    try {
      const supabase = getAuthenticatedClient(req.accessToken);
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", req.user.id)
        .single();

      const fallbackResponse = await generateFinancialAdvice(
        message.trim(),
        profile || {}
      );

      return res.json({
        success: true,
        data: {
          message: fallbackResponse,
          timestamp: new Date().toISOString(),
          context_used: {
            has_profile: !!profile,
            fallback_mode: true,
          },
        },
        error: null,
      });
    } catch (fallbackError) {
      console.error("Fallback error:", fallbackError);
    }

    res.status(500).json({
      success: false,
      error: "AI assistant is temporarily unavailable",
      data: null,
    });
  }
});

// Get enhanced chat history with knowledge context
const getChatHistoryWithRAG = asyncHandler(async (req, res) => {
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

    const { data: history } = await query;

    // Get user's knowledge graph summary
    const { data: entitiesCount } = await supabase
      .from("knowledge_entities")
      .select("id", { count: "exact" })
      .eq("user_id", userId);

    const { data: relationshipsCount } = await supabase
      .from("knowledge_relationships")
      .select("id", { count: "exact" })
      .eq("user_id", userId);

    res.json({
      success: true,
      data: {
        history: history || [],
        knowledge_graph_stats: {
          entities: entitiesCount?.length || 0,
          relationships: relationshipsCount?.length || 0,
        },
        message:
          history?.length > 0
            ? "Chat history retrieved with knowledge context"
            : "No chat history found",
      },
      error: null,
    });
  } catch (error) {
    console.error("Error getting chat history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve chat history",
      data: null,
    });
  }
});

// Get financial insights with Graph RAG enhancement
const getFinancialInsightsWithRAG = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user profile
    const supabase = getAuthenticatedClient(req.accessToken);
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (!profile || !profile.monthly_revenue || !profile.monthly_expenses) {
      return res.status(400).json({
        success: false,
        error: "Complete business profile required for financial insights",
        data: null,
      });
    }

    // Get relevant knowledge from user's graph
    const relevantKnowledge = await graphRAG.retrieveRelevantKnowledge(
      userId,
      "financial insights business analysis performance metrics",
      profile
    );

    // Generate insights prompt with graph context
    const insightsQuery = `Provide comprehensive financial insights and recommendations for my business based on current data and historical knowledge.`;

    const enhancedPrompt = graphRAG.generateEnhancedPrompt(
      insightsQuery,
      relevantKnowledge,
      profile
    );

    const aiInsights = await generateFinancialAdvice(enhancedPrompt, profile);

    // Extract and store new insights as entities
    const conversationId = uuidv4();
    const insightEntities = graphRAG.extractEntities(aiInsights, profile);
    const insightRelationships = graphRAG.buildRelationships(insightEntities, {
      conversation_id: conversationId,
      type: "financial_insights",
    });

    // Store insights knowledge
    await graphRAG.storeKnowledge(userId, insightEntities, insightRelationships, conversationId);

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
        knowledge_context: {
          entities_used: relevantKnowledge.entities.length,
          relationships_used: relevantKnowledge.relationships.length,
          new_entities_extracted: insightEntities.length,
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

module.exports = {
  chatAssistantWithRAG,
  getChatHistoryWithRAG,
  getFinancialInsightsWithRAG,
};