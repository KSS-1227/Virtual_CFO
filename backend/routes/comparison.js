const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const { 
  getDetailedComparison
} = require("../controllers/comparisonController");

const router = express.Router();

// All comparison routes require authentication
router.use(authenticateToken);

// GET /api/comparison/detailed?month=YYYY-MM
router.get("/detailed", getDetailedComparison);

module.exports = router;