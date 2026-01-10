const express = require('express');
const { getStreamingMetrics, getUserStreamingMetrics, getStreamMetrics } = require('../controllers/metricsController');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get overall streaming metrics (authenticated)
router.get('/streaming', authenticateToken, getStreamingMetrics);

// Get user-specific streaming metrics
router.get('/streaming/user', authenticateToken, getUserStreamingMetrics);

// Get specific stream metrics
router.get('/streaming/:streamId', authenticateToken, getStreamMetrics);

module.exports = router;
