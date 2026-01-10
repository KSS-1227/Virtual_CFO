/**
 * VECTOR INTEGRATION CODE FOR GRAPH RAG
 * 
 * This module provides vector embedding and semantic search functionality
 * for the Graph RAG system. Paste this into your backend codebase.
 * 
 * Installation:
 * npm install openai dotenv
 */

const { OpenAIClient } = require("@azure/openai");
const { supabaseAdmin, getAuthenticatedClient } = require("../config/supabase");
const graphRAG = require("../config/graphRAG");

// Vector embedding configuration
const EMBEDDING_CONFIG = {
  model: "text-embedding-3-small", // OpenAI embedding model
  dimension: 1536, // Vector dimension for text-embedding-3-small
  batchSize: 100, // Batch size for embedding operations
};

/**
 * VECTOR EMBEDDING SERVICE
 * Handles creation and storage of embeddings for entities
 */
class VectorEmbeddingService {
  constructor() {
    this.openaiClient = null;
    this.initializeClient();
  }

  /**
   * Initialize OpenAI client for embeddings
   */
  initializeClient() {
    const { openai } = require("./openai");
    this.openaiClient = openai;
  }

  /**
   * Generate embedding for a text string
   * @param {string} text - Text to embed
   * @returns {Promise<number[]>} - Vector embedding
   */
  async generateEmbedding(text) {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error("Text cannot be empty");
      }

      // Truncate text if too long (max 8191 tokens)
      const maxChars = 8191 * 4; // Approximate
      const truncatedText = text.substring(0, maxChars);

      const response = await this.openaiClient.embeddings.create({
        model: EMBEDDING_CONFIG.model,
        input: truncatedText,
        encoding_format: "float",
      });

      if (response.data && response.data.length > 0) {
        return response.data[0].embedding;
      }

      throw new Error("No embedding returned from API");
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * @param {string[]} texts - Array of texts to embed
   * @returns {Promise<number[][]>} - Array of embeddings
   */
  async generateEmbeddingsBatch(texts) {
    try {
      if (!Array.isArray(texts) || texts.length === 0) {
        return [];
      }

      // Split into batches to respect API limits
      const batches = [];
      for (let i = 0; i < texts.length; i += EMBEDDING_CONFIG.batchSize) {
        batches.push(texts.slice(i, i + EMBEDDING_CONFIG.batchSize));
      }

      const allEmbeddings = [];

      for (const batch of batches) {
        const response = await this.openaiClient.embeddings.create({
          model: EMBEDDING_CONFIG.model,
          input: batch,
          encoding_format: "float",
        });

        const embeddings = response.data
          .sort((a, b) => a.index - b.index)
          .map((item) => item.embedding);

        allEmbeddings.push(...embeddings);
      }

      return allEmbeddings;
    } catch (error) {
      console.error("Error generating batch embeddings:", error);
      throw error;
    }
  }

  /**
   * Store embedding for an entity in Supabase
   * @param {UUID} entityId - Entity ID
   * @param {UUID} userId - User ID
   * @param {number[]} embedding - Vector embedding
   */
  async storeEmbedding(entityId, userId, embedding) {
    try {
      const supabase = supabaseAdmin;

      await supabase.from("entity_embeddings").upsert({
        entity_id: entityId,
        user_id: userId,
        embedding: embedding,
        embedding_model: EMBEDDING_CONFIG.model,
        embedding_created_at: new Date().toISOString(),
      });

      console.log(`[Vector] Embedding stored for entity ${entityId}`);
    } catch (error) {
      console.error("Error storing embedding:", error);
      throw error;
    }
  }

  /**
   * Update knowledge entity with embedding
   * @param {UUID} entityId - Entity ID
   * @param {number[]} embedding - Vector embedding
   */
  async updateEntityEmbedding(entityId, embedding) {
    try {
      const supabase = supabaseAdmin;

      await supabase
        .from("knowledge_entities")
        .update({ embedding: embedding })
        .eq("id", entityId);

      console.log(`[Vector] Entity ${entityId} updated with embedding`);
    } catch (error) {
      console.error("Error updating entity embedding:", error);
      throw error;
    }
  }
}

/**
 * SEMANTIC SEARCH SERVICE
 * Performs vector-based semantic search on knowledge graph
 */
class SemanticSearchService {
  constructor() {
    this.vectorService = new VectorEmbeddingService();
  }

  /**
   * Find semantically similar entities
   * @param {UUID} userId - User ID
   * @param {string} query - Search query
   * @param {number} limit - Max results to return
   * @param {number} threshold - Similarity threshold (0-1)
   * @returns {Promise<Object[]>} - Similar entities with scores
   */
  async findSimilarEntities(userId, query, limit = 10, threshold = 0.7) {
    try {
      // Generate embedding for query
      const queryEmbedding = await this.vectorService.generateEmbedding(query);

      const supabase = supabaseAdmin;

      // Use Supabase function to find similar entities
      const { data, error } = await supabase.rpc(
        "find_similar_entities",
        {
          user_id_param: userId,
          embedding_param: queryEmbedding,
          similarity_threshold: threshold,
          limit_count: limit,
        }
      );

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error("Error finding similar entities:", error);
      return [];
    }
  }

  /**
   * Hybrid search combining keyword and semantic search
   * @param {UUID} userId - User ID
   * @param {string} query - Search query
   * @param {number} limit - Max results
   * @returns {Promise<Object>} - Combined search results
   */
  async hybridSearch(userId, query, limit = 20) {
    try {
      const supabase = supabaseAdmin;
      // Keyword search
      const { data: keywordResults } = await supabase
        .from("knowledge_entities")
        .select("*")
        .eq("user_id", userId)
        .or(
          `entity_name.ilike.%${query}%,context.ilike.%${query}%,category.ilike.%${query}%`
        )
        .order("confidence", { ascending: false })
        .limit(limit);

      // Semantic search
      const semanticResults = await this.findSimilarEntities(
        userId,
        query,
        limit,
        0.6
      );

      // Merge and deduplicate results
      const mergedMap = new Map();

      // Keyword scoring parameters — increase to strongly favor keyword matches
      const KEYWORD_BOOST = 2.0; // multiplier for keyword confidence
      const EXACT_MATCH_BONUS = 0.25; // additive bonus for exact entity_name match

      // Add keyword results with higher score boost
      keywordResults?.forEach((entity) => {
        if (!mergedMap.has(entity.entity_name)) {
          // compute base score from confidence
          let base = (entity.confidence || 0) * KEYWORD_BOOST;
          // extra bonus when the entity_name exactly matches the query (case-insensitive)
          if (
            entity.entity_name &&
            entity.entity_name.toLowerCase() === query.toLowerCase()
          ) {
            base += EXACT_MATCH_BONUS;
          }

          mergedMap.set(entity.entity_name, {
            ...entity,
            search_score: base,
            search_type: "keyword",
          });
        }
      });

      // Add semantic results
      semanticResults.forEach((entity) => {
        const key = entity.entity_name;
        if (mergedMap.has(key)) {
          // Combine scores
          const existing = mergedMap.get(key);
          existing.search_score = Math.max(
            existing.search_score,
            entity.similarity_score * 1.0
          );
          existing.search_type = "hybrid";
        } else {
          mergedMap.set(key, {
            ...entity,
            search_score: entity.similarity_score,
            search_type: "semantic",
          });
        }
      });

      // Sort by combined score and return top results
      const results = Array.from(mergedMap.values())
        .sort((a, b) => b.search_score - a.search_score)
        .slice(0, limit);

      return {
        success: true,
        results,
        count: results.length,
        search_types: {
          keyword: results.filter((r) => r.search_type !== "semantic").length,
          semantic: results.filter((r) => r.search_type !== "keyword").length,
          hybrid: results.filter((r) => r.search_type === "hybrid").length,
        },
      };
    } catch (error) {
      console.error("Error in hybrid search:", error);
      return {
        success: false,
        results: [],
        count: 0,
        error: error.message,
      };
    }
  }
}

/**
 * ENHANCED GRAPH RAG WITH VECTOR SUPPORT
 * Extends the existing GraphRAG with semantic search capabilities
 */
class EnhancedGraphRAG extends graphRAG.constructor {
  constructor() {
    super();
    this.vectorService = new VectorEmbeddingService();
    this.semanticSearch = new SemanticSearchService();
  }

  /**
   * Enhanced knowledge storage with embeddings
   * @param {UUID} userId - User ID
   * @param {Object[]} entities - Entities to store
   * @param {Object[]} relationships - Relationships to store
   * @param {UUID} conversationId - Conversation ID
   */
  async storeKnowledgeWithVectors(
    userId,
    entities,
    relationships,
    conversationId
  ) {
    try {
      // First store knowledge normally
      await super.storeKnowledge(userId, entities, relationships, conversationId);

      // Then generate and store embeddings for each entity
      const supabase = supabaseAdmin;

      for (const entity of entities) {
        try {
          // Create embedding text from entity info
          const embeddingText = `${entity.entity} ${entity.category} ${
            entity.context || ""
          }`;

          // Generate embedding
          const embedding =
            await this.vectorService.generateEmbedding(embeddingText);

          // Get the stored entity ID
          const { data: storedEntity } = await supabase
            .from("knowledge_entities")
            .select("id")
            .eq("user_id", userId)
            .eq("entity_name", entity.entity)
            .eq("conversation_id", conversationId)
            .single();

          if (storedEntity) {
            // Store embedding
            await this.vectorService.storeEmbedding(
              storedEntity.id,
              userId,
              embedding
            );

            // Update entity with embedding
            await this.vectorService.updateEntityEmbedding(
              storedEntity.id,
              embedding
            );
          }
        } catch (error) {
          console.error(`Error creating embedding for entity ${entity.entity}:`, error);
          // Continue with next entity
        }
      }

      console.log(
        `[Graph RAG Vector] Stored ${entities.length} entities with embeddings`
      );
    } catch (error) {
      console.error("Error storing knowledge with vectors:", error);
      throw error;
    }
  }

  /**
   * Enhanced knowledge retrieval using hybrid search
   * @param {UUID} userId - User ID
   * @param {string} query - Search query
   * @param {Object} userProfile - User profile
   * @returns {Promise<Object>} - Relevant knowledge with vector scores
   */
  async retrieveRelevantKnowledgeWithVectors(userId, query, userProfile = {}) {
    try {
      // Perform hybrid search
      const hybridResults = await this.semanticSearch.hybridSearch(
        userId,
        query,
        50
      );

      // Combine with relationship data
      const supabase = supabaseAdmin;

      const entityNames = hybridResults.results.map((e) => e.entity_name);

      const { data: relationships } = await supabase
        .from("knowledge_relationships")
        .select("*")
        .eq("user_id", userId)
        .or(
          entityNames.map((name) => `from_entity.eq.${name}`).join(",") +
            "," +
            entityNames.map((name) => `to_entity.eq.${name}`).join(",")
        );

      // Build enhanced context with vector scores
      const context = this.buildEnhancedContextWithVectors(
        hybridResults.results,
        relationships || []
      );

      return {
        entities: hybridResults.results,
        relationships: relationships || [],
        context,
        search_metadata: {
          search_types: hybridResults.search_types,
          total_results: hybridResults.count,
          query_processed: query,
        },
        tokenCount: this.tokenOptimizer.estimateTokens(context),
      };
    } catch (error) {
      console.error("Error retrieving knowledge with vectors:", error);
      return super.retrieveRelevantKnowledge(userId, query, userProfile);
    }
  }

  /**
   * Build context string with vector search scores
   */
  buildEnhancedContextWithVectors(entities, relationships) {
    let context = "🔍 SEMANTIC SEARCH RESULTS\n";
    context += "========================\n\n";

    // Sort by search score
    const sortedEntities = entities
      .sort((a, b) => (b.search_score || 0) - (a.search_score || 0))
      .slice(0, 10);

    context += "📊 HIGHLY RELEVANT ENTITIES\n";
    context += "---------------------------\n";

    sortedEntities.forEach((entity, index) => {
      const relevanceBar =
        "█".repeat(Math.round((entity.search_score || 0.5) * 10)) +
        "░".repeat(10 - Math.round((entity.search_score || 0.5) * 10));
      context += `${index + 1}. ${entity.entity_name}\n`;
      context += `   Relevance: [${relevanceBar}] ${(
        (entity.search_score || 0.5) * 100
      ).toFixed(0)}%\n`;
      context += `   Category: ${entity.category}\n`;
      context += `   Search Type: ${entity.search_type || "unknown"}\n\n`;
    });

    // Add top relationships
    const topRelationships = relationships.slice(0, 5);
    if (topRelationships.length > 0) {
      context += "🔗 KEY RELATIONSHIPS\n";
      context += "-------------------\n";
      topRelationships.forEach((rel) => {
        context += `⚡ ${rel.from_entity} → ${rel.to_entity}\n`;
        context += `   Relationship: ${rel.relationship_type}\n\n`;
      });
    }

    return context;
  }
}

/**
 * API CONTROLLER FOR VECTOR OPERATIONS
 * Use these functions in your Express routes
 */

const vectorSearchController = {
  /**
   * Endpoint: POST /api/vector/search
   * Perform semantic search on knowledge graph
   */
  semanticSearch: async (req, res) => {
    try {
      const { query, limit = 10, threshold = 0.7 } = req.body;
      const userId = req.user.id;

      if (!query) {
        return res.status(400).json({
          success: false,
          error: "Query is required",
        });
      }

      const semanticSearch = new SemanticSearchService();
      const results = await semanticSearch.findSimilarEntities(
        userId,
        query,
        limit,
        threshold
      );

      res.json({
        success: true,
        data: results,
        count: results.length,
      });
    } catch (error) {
      console.error("Vector search error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to perform semantic search",
      });
    }
  },

  /**
   * Endpoint: POST /api/vector/hybrid-search
   * Perform hybrid keyword + semantic search
   */
  hybridSearch: async (req, res) => {
    try {
      const { query, limit = 20 } = req.body;
      const userId = req.user.id;

      if (!query) {
        return res.status(400).json({
          success: false,
          error: "Query is required",
        });
      }

      const semanticSearch = new SemanticSearchService();
      const results = await semanticSearch.hybridSearch(userId, query, limit);

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error("Hybrid search error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to perform hybrid search",
      });
    }
  },

  /**
   * Endpoint: POST /api/vector/regenerate-embeddings
   * Regenerate embeddings for all entities
   */
  regenerateEmbeddings: async (req, res) => {
    try {
      const userId = req.user.id;
      const vectorService = new VectorEmbeddingService();
      const supabase = getAuthenticatedClient(req.accessToken);

      // Get all entities for user
      const { data: entities } = await supabase
        .from("knowledge_entities")
        .select("*")
        .eq("user_id", userId);

      if (!entities || entities.length === 0) {
        return res.json({
          success: true,
          message: "No entities to regenerate",
          count: 0,
        });
      }

      let successCount = 0;
      let errorCount = 0;

      // Batch process embeddings
      for (const entity of entities) {
        try {
          const embeddingText = `${entity.entity_name} ${entity.category} ${
            entity.context || ""
          }`;

          const embedding =
            await vectorService.generateEmbedding(embeddingText);

          await supabase
            .from("entity_embeddings")
            .upsert({
              entity_id: entity.id,
              user_id: userId,
              embedding: embedding,
            });

          await supabase
            .from("knowledge_entities")
            .update({ embedding: embedding })
            .eq("id", entity.id);

          successCount++;
        } catch (error) {
          console.error(`Error regenerating embedding for ${entity.entity_name}:`, error);
          errorCount++;
        }
      }

      res.json({
        success: true,
        message: "Embeddings regeneration complete",
        total: entities.length,
        successful: successCount,
        failed: errorCount,
      });
    } catch (error) {
      console.error("Embedding regeneration error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to regenerate embeddings",
      });
    }
  },
};

// Export all services and controllers
module.exports = {
  VectorEmbeddingService,
  SemanticSearchService,
  EnhancedGraphRAG,
  vectorSearchController,
  EMBEDDING_CONFIG,
};
