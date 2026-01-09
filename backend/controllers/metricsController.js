/**
 * Streaming Metrics Monitoring Endpoint
 * Provides metrics and health status for streaming operations
 */

const { asyncHandler } = require("../middleware/errorHandler");
const streamingTelemetry = require("../services/streamingTelemetry");

// Get overall streaming metrics summary
const getStreamingMetrics = asyncHandler(async (req, res) => {
  const summary = streamingTelemetry.getMetricsSummary();

  res.json({
    success: true,
    data: {
      metrics: summary,
      status: summary.totalStreams > 0 ? "active" : "idle",
      health: {
        errorRate: parseFloat(summary.errorRate),
        slowStreamRate: parseFloat(summary.slowStreamRate),
        isHealthy: parseFloat(summary.errorRate) < 5 && parseFloat(summary.slowStreamRate) < 10,
      },
    },
    timestamp: new Date().toISOString(),
  });
});

// Get metrics for current user
const getUserStreamingMetrics = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const userMetrics = streamingTelemetry.getUserMetrics(userId);

  res.json({
    success: true,
    data: userMetrics,
    timestamp: new Date().toISOString(),
  });
});

// Get specific stream metrics (admin only - could add role check)
const getStreamMetrics = asyncHandler(async (req, res) => {
  const { streamId } = req.params;

  if (!streamId) {
    return res.status(400).json({
      success: false,
      error: "streamId parameter required",
    });
  }

  const metrics = streamingTelemetry.getStreamMetrics(streamId);

  if (!metrics) {
    return res.status(404).json({
      success: false,
      error: "Stream metrics not found",
    });
  }

  res.json({
    success: true,
    data: metrics,
  });
});

module.exports = {
  getStreamingMetrics,
  getUserStreamingMetrics,
  getStreamMetrics,
};
