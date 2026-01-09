/**
 * Streaming Telemetry Service
 * Tracks and monitors streaming metrics for performance analysis
 */

class StreamingTelemetry {
  constructor() {
    this.metrics = new Map(); // Map<streamId, metrics>
    this.aggregated = {
      totalStreams: 0,
      totalTokens: 0,
      totalDuration: 0,
      avgTimeToFirstToken: 0,
      errorCount: 0,
      abortedCount: 0,
      slowStreams: 0, // TTF > 500ms
    };
  }

  /**
   * Record stream telemetry
   */
  recordStream(telemetryData) {
    const {
      streamId,
      userId,
      model,
      tokenCount,
      duration,
      timeToFirstToken,
      estimatedCost,
      error,
      aborted,
    } = telemetryData;

    // Store individual metric
    this.metrics.set(streamId, {
      streamId,
      userId,
      model,
      tokenCount,
      duration,
      timeToFirstToken,
      estimatedCost,
      error,
      aborted,
      timestamp: new Date(),
    });

    // Update aggregated metrics
    this.aggregated.totalStreams++;
    this.aggregated.totalTokens += tokenCount || 0;
    this.aggregated.totalDuration += duration || 0;

    if (error) {
      this.aggregated.errorCount++;
    }
    if (aborted) {
      this.aggregated.abortedCount++;
    }
    if (timeToFirstToken && timeToFirstToken > 500) {
      this.aggregated.slowStreams++;
    }

    // Calculate running averages
    if (timeToFirstToken !== null && timeToFirstToken !== -1) {
      const validTTFMetrics = Array.from(this.metrics.values()).filter(
        (m) => m.timeToFirstToken && m.timeToFirstToken > 0
      );
      this.aggregated.avgTimeToFirstToken =
        validTTFMetrics.reduce((sum, m) => sum + m.timeToFirstToken, 0) /
        Math.max(validTTFMetrics.length, 1);
    }

    // Cleanup old metrics (keep last 1000)
    if (this.metrics.size > 1000) {
      const oldestKey = this.metrics.keys().next().value;
      this.metrics.delete(oldestKey);
    }

    // Log summary if significant anomaly
    if (timeToFirstToken && timeToFirstToken > 1000) {
      console.warn(
        `[TELEMETRY_ALERT] Slow stream detected | TTF: ${timeToFirstToken}ms | Stream: ${streamId}`
      );
    }
    if (duration > 5 * 60 * 1000) {
      console.warn(
        `[TELEMETRY_ALERT] Long stream detected | Duration: ${(duration / 1000).toFixed(1)}s | Stream: ${streamId}`
      );
    }
  }

  /**
   * Get aggregated metrics summary
   */
  getMetricsSummary() {
    return {
      ...this.aggregated,
      avgDurationPerStream: this.aggregated.totalStreams
        ? (this.aggregated.totalDuration / this.aggregated.totalStreams).toFixed(0)
        : 0,
      avgTokensPerStream: this.aggregated.totalStreams
        ? (this.aggregated.totalTokens / this.aggregated.totalStreams).toFixed(0)
        : 0,
      errorRate: this.aggregated.totalStreams
        ? (
            (this.aggregated.errorCount / this.aggregated.totalStreams) *
            100
          ).toFixed(2) + '%'
        : '0%',
      abortRate: this.aggregated.totalStreams
        ? (
            (this.aggregated.abortedCount / this.aggregated.totalStreams) *
            100
          ).toFixed(2) + '%'
        : '0%',
      slowStreamRate: this.aggregated.totalStreams
        ? (
            (this.aggregated.slowStreams / this.aggregated.totalStreams) *
            100
          ).toFixed(2) + '%'
        : '0%',
      recordedMetrics: this.metrics.size,
    };
  }

  /**
   * Get specific stream metrics
   */
  getStreamMetrics(streamId) {
    return this.metrics.get(streamId) || null;
  }

  /**
   * Get metrics for a user
   */
  getUserMetrics(userId) {
    const userMetrics = Array.from(this.metrics.values()).filter(
      (m) => m.userId === userId
    );
    return {
      streamCount: userMetrics.length,
      totalTokens: userMetrics.reduce((sum, m) => sum + (m.tokenCount || 0), 0),
      avgDuration:
        userMetrics.length > 0
          ? (userMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) /
              userMetrics.length).toFixed(0)
          : 0,
      avgTimeToFirstToken:
        userMetrics.length > 0
          ? (userMetrics.reduce((sum, m) => sum + (m.timeToFirstToken || 0), 0) /
              userMetrics.length).toFixed(0)
          : 0,
      errorCount: userMetrics.filter((m) => m.error).length,
      totalEstimatedCost:
        userMetrics.reduce((sum, m) => sum + (m.estimatedCost || 0), 0).toFixed(6),
    };
  }

  /**
   * Reset metrics (for testing or maintenance)
   */
  reset() {
    this.metrics.clear();
    this.aggregated = {
      totalStreams: 0,
      totalTokens: 0,
      totalDuration: 0,
      avgTimeToFirstToken: 0,
      errorCount: 0,
      abortedCount: 0,
      slowStreams: 0,
    };
  }
}

// Export singleton instance
module.exports = new StreamingTelemetry();
