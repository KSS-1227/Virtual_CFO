const express = require("express");
const router = express.Router();
const { vectorSearchController } = require("../services/vectorService");
const { authenticateToken } = require("../middleware/auth");

// All vector routes require authentication
router.use(authenticateToken);

// Semantic search
router.post("/search", vectorSearchController.semanticSearch);

// Hybrid search (keyword + semantic)
router.post("/hybrid-search", vectorSearchController.hybridSearch);

// Regenerate all embeddings
router.post("/regenerate-embeddings", vectorSearchController.regenerateEmbeddings);

module.exports = router;