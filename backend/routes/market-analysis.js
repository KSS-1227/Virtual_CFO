const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { 
  analyzeMarketTrends, 
  analyzeBusinessScenarios, 
  getPredictiveInsights 
} = require('../controllers/marketAnalysisController');

// Market trend analysis
router.post('/trends', authenticateToken, analyzeMarketTrends);

// Business scenario analysis
router.post('/scenarios', authenticateToken, analyzeBusinessScenarios);

// Predictive insights
router.get('/predictions', authenticateToken, getPredictiveInsights);

module.exports = router;