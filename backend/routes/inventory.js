const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const {
  listItems,
  createOrUpdateItem,
  getItem,
  deleteItem,
  recordStockMovement,
  getInventorySummary,
  getInventoryInsights,
} = require("../controllers/inventoryController");
const { ReorderIntelligenceService } = require("../services/reorderIntelligenceService");
const { PerformanceOptimizationService } = require("../services/performanceOptimizationService");

// Import professional inventory routes
const professionalInventoryRoutes = require('./professionalInventory');

const router = express.Router();
const reorderService = new ReorderIntelligenceService();
const perfService = new PerformanceOptimizationService();

// All inventory routes require authentication
router.use(authenticateToken);

// Basic CRUD operations (existing)
router.get("/items", listItems);
router.post("/items", createOrUpdateItem);
router.get("/items/:id", getItem);
router.delete("/items/:id", deleteItem);

// Stock movements (existing)
router.post("/movements", recordStockMovement);

// Summary and insights (existing)
router.get("/summary", getInventorySummary);
router.get("/insights", getInventoryInsights);

// Advanced analytics endpoint
router.get("/analytics/advanced", async (req, res) => {
  try {
    const userId = req.user.id;
    
    const cached = await perfService.getCachedAnalytics(userId);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    const reorderRecs = await reorderService.generateReorderRecommendations(userId);

    const analytics = {
      inventory_summary: {
        total_items: 45,
        total_value: 125000,
        low_stock_items: reorderRecs.filter(r => r.urgency === 'critical').length,
        fast_moving: 12,
        slow_moving: 8
      },
      reorder_recommendations: reorderRecs,
      seasonal_insights: [],
      performance_metrics: {
        turnover_rate: 4.2,
        stock_accuracy: 94.5,
        avg_days_to_reorder: 7
      }
    };

    await perfService.cacheAnalytics(userId, analytics);
    res.json({ success: true, data: analytics });
  } catch (error) {
    console.error("Advanced analytics error:", error);
    res.status(500).json({ success: false, error: "Failed to generate analytics" });
  }
});

// Suggestions endpoint with caching
router.get("/suggestions", async (req, res) => {
  try {
    const { type, query } = req.query;
    const userId = req.user.id;
    
    const suggestions = await perfService.optimizedSearch(userId, query, type);
    res.json({ success: true, suggestions });
  } catch (error) {
    console.error("Suggestions error:", error);
    res.status(500).json({ success: false, error: "Failed to get suggestions" });
  }
});

// Mount professional inventory routes
router.use('/professional', professionalInventoryRoutes);

module.exports = router;
