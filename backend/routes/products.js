const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const {
  getProducts,
  getProduct,
  createProduct,
  getRecommendations,
  updateRecommendationInteraction,
  getCategories,
} = require("../controllers/productsController");

const router = express.Router();

// All product routes require authentication
router.use(authenticateToken);

// GET /api/products - Get all products with filtering
router.get("/", getProducts);

// GET /api/products/categories - Get product categories
router.get("/categories", getCategories);

// GET /api/products/recommendations - Get AI-powered recommendations for user
router.get("/recommendations", getRecommendations);

// GET /api/products/:id - Get specific product
router.get("/:id", getProduct);

// POST /api/products - Create new product (Admin only)
router.post("/", createProduct);

// PUT /api/products/recommendations/:id - Update recommendation interaction
router.put("/recommendations/:id", updateRecommendationInteraction);

module.exports = router;