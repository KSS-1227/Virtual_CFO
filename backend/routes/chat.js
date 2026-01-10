const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const {
  chatAssistantWithRAG,
  getChatHistoryWithRAG,
  getFinancialInsightsWithRAG,
} = require("../controllers/enhancedAiController");

const router = express.Router();

// All AI routes require authentication
router.use(authenticateToken);

// POST /api/chat - AI Financial Assistant Chat with Graph RAG
router.post("/", chatAssistantWithRAG);

// GET /api/chat/history - Get enhanced chat history with knowledge context
router.get("/history", getChatHistoryWithRAG);

// GET /api/chat/insights - Get AI-generated financial insights with Graph RAG
router.get("/insights", getFinancialInsightsWithRAG);

module.exports = router;
