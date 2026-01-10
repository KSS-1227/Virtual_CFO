const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const { notificationService } = require("../services/notificationService");
const { ReorderIntelligenceService } = require("../services/reorderIntelligenceService");

const router = express.Router();

// SSE endpoint for real-time notifications
router.get("/stream", authenticateToken, (req, res) => {
  const userId = req.user.id;
  notificationService.addClient(userId, res);
});

// Trigger reorder check and notify
router.post("/check-reorders", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const reorderService = new ReorderIntelligenceService();
    const recommendations = await reorderService.generateReorderRecommendations(userId);
    
    const criticalItems = recommendations.filter(r => r.urgency === 'critical');
    if (criticalItems.length > 0) {
      notificationService.notifyReorderRecommendation(userId, criticalItems);
    }

    res.json({ success: true, recommendations });
  } catch (error) {
    console.error("Reorder check error:", error);
    res.status(500).json({ success: false, error: "Failed to check reorders" });
  }
});

// Manual notification trigger (for testing)
router.post("/test", authenticateToken, (req, res) => {
  const { type, message } = req.body;
  notificationService.notifyUser(req.user.id, {
    type: type || 'test',
    priority: 'low',
    title: 'Test Notification',
    message: message || 'This is a test notification',
    timestamp: new Date().toISOString()
  });
  res.json({ success: true });
});

module.exports = router;