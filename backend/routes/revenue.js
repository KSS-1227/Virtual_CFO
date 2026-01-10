const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const {
  getMonthlyRevenue,
  getRevenueComparison,
  getRevenueBreakdown,
  getRevenueInsights,
} = require("../controllers/revenueController");

const router = express.Router();

// All revenue routes require authentication
router.use(authenticateToken);

// GET /api/revenue/monthly?month=YYYY-MM - Get monthly revenue
router.get("/monthly", getMonthlyRevenue);

// GET /api/revenue/compare?month=YYYY-MM - Get revenue comparison
router.get("/compare", getRevenueComparison);

// GET /api/revenue/breakdown?month=YYYY-MM - Get revenue breakdown
router.get("/breakdown", getRevenueBreakdown);

// GET /api/revenue/insight?month=YYYY-MM - Get AI insights
router.get("/insight", getRevenueInsights);

module.exports = router;