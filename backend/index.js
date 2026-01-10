const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const config = require("./config/env");
const { errorHandler, notFound } = require("./middleware/errorHandler");
const {
  securityHeaders,
  rateLimits,
  sanitizeInput,
  securityLogger,
  corsSecurityCheck,
} = require("./middleware/security");

// Import Redis service and test connection
// const redisService = require("./services/redisService");
// const { getRedisHealth } = require("./config/redis");

// Import routes
const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const documentRoutes = require("./routes/documents");
const chatRoutes = require("./routes/chat");
const businessIdeasRoutes = require("./routes/business-ideas");
// const redisRoutes = require("./routes/redis");
const productsRoutes = require("./routes/products");
const aiRoutes = require("./routes/ai");
const visionRoutes = require("./routes/vision");
const duplicateRoutes = require("./routes/duplicates");
const marketAnalysisRoutes = require("./routes/market-analysis");
const multiModalRoutes = require("./routes/multimodal");
const voiceRoutes = require("./routes/voice");
const metricsRoutes = require("./routes/metrics");
const vectorRoutes = require("./routes/vector");
const inventoryRoutes = require("./routes/inventory");
const professionalInventoryRoutes = require("./routes/professionalInventory");
const notificationRoutes = require("./routes/notifications");
const revenueRoutes = require("./routes/revenue");
const comparisonRoutes = require("./routes/comparison");
// const redisRoutes = require("./routes/redis"); // Commented out
// Optional embedding worker - DISABLED
let EmbeddingWorker = null;
// try {
//   const embeddingModule = require("./services/embeddingWorker");
//   EmbeddingWorker = embeddingModule.EmbeddingWorker;
// } catch (err) {
//   console.log('EmbeddingWorker not available:', err.message);
// }
console.log('⚠️ EmbeddingWorker disabled to avoid Redis connection issues');

// Initialize Express app
const app = express();

// Trust proxy for correct IP addresses
app.set("trust proxy", 1);

// Enhanced security middleware
app.use(compression());
app.use(securityHeaders);
app.use(securityLogger);
app.use(corsSecurityCheck);

// Apply general rate limiting
app.use("/api/", rateLimits.general);

// CORS configuration
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  })
);

// Body parsing middleware
app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buf) => {
      // Prevent JSON pollution attacks
      try {
        JSON.parse(buf);
      } catch (e) {
        res.status(400).json({
          success: false,
          error: "Invalid JSON format",
          data: null,
        });
        return;
      }
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Input sanitization
app.use(sanitizeInput);

// Logging middleware
if (config.nodeEnv === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Enhanced health check endpoint - Redis commented out
app.get("/health", async (req, res) => {
  try {
    // Get Redis health information - commented out
    // const redisHealth = await getRedisHealth();

    res.json({
      success: true,
      data: {
        status: "OK",
        timestamp: new Date().toISOString(),
        environment: config.nodeEnv,
        version: "1.0.0",
        redis: { status: "disabled" }, // Mock Redis status
      },
      error: null,
    });
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({
      success: false,
      error: "Health check failed",
      data: null,
    });
  }
});

// API info endpoint
app.get("/api", (req, res) => {
  res.json({
    success: true,
    data: {
      name: "VirtualCFO Backend API",
      version: "1.0.0",
      description:
        "Backend API for VirtualCFO App with Supabase integration and AI-powered features",
      endpoints: {
        auth: "/api/auth",
        profile: "/api/profile",
        documents: "/api/documents",
        chat: "/api/chat",
        businessIdeas: "/api/business-ideas",
        redis: "/api/redis",
        duplicates: "/api/duplicates",
        marketAnalysis: "/api/market-analysis",
      },
      docs: "See README.md for detailed API documentation",
    },
    error: null,
  });
});

// API Routes with specific rate limiting
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/documents", rateLimits.upload, documentRoutes);
app.use("/api/chat", rateLimits.aiChat, chatRoutes);
app.use("/api/business-ideas", rateLimits.aiChat, businessIdeasRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/vision", rateLimits.aiChat, visionRoutes);
app.use("/api/metrics", metricsRoutes);
app.use("/api/duplicates", duplicateRoutes);
app.use("/api/market-analysis", rateLimits.aiChat, marketAnalysisRoutes);
app.use("/api/multimodal", rateLimits.aiChat, multiModalRoutes);
app.use("/api/voice", rateLimits.aiChat, voiceRoutes);
app.use("/api/vector", vectorRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/inventory/professional", professionalInventoryRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/revenue", revenueRoutes);
app.use("/api/comparison", comparisonRoutes);
// app.use("/api/redis", redisRoutes); // Commented out

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

// Start server
const PORT = config.port;

let serverInstance = null;
let embeddingWorker = null;

const startServer = async () => {
  try {
    // Test Redis connection - commented out
    // const redisConnected = await redisService.getConnectionStatus();
    // let redisHealth = { status: "unknown" };

    // if (redisConnected === "connected") {
    //   console.log("✅ Redis connected successfully");
    //   redisHealth = await getRedisHealth();
    // } else {
    //   console.warn(
    //     "⚠️ Redis connection failed - falling back to in-memory storage"
    //   );
    // }

    const server = app.listen(PORT, () => {
      console.log(`
🚀 VirtualCFO Backend API Server Started!

📍 Server: http://localhost:${PORT}
📊 Health: http://localhost:${PORT}/health
📖 API Info: http://localhost:${PORT}/api
🌍 Environment: ${config.nodeEnv}
🗄️ Redis Status: disabled

📋 Available Endpoints:
   • Profile: /api/profile
   • Documents: /api/documents
   • AI Chat: /api/chat
   • Business Ideas: /api/business-ideas
   • Redis: /api/redis (Admin only)

🔧 Ready for requests!
      `);
    });

    // keep reference for shutdown
    serverInstance = server;

    // Start background embedding worker (only in non-test environments)
    if (EmbeddingWorker) {
      try {
        embeddingWorker = new EmbeddingWorker();
        embeddingWorker.start();
        console.log('✅ EmbeddingWorker started successfully');
      } catch (wkErr) {
        console.log('⚠️ EmbeddingWorker failed to start:', wkErr.message);
      }
    } else {
      console.log('ℹ️ EmbeddingWorker not available');
    }

    // Handle server errors
    server.on("error", (error) => {
      console.error("❌ Server error:", error);
      process.exit(1);
    });

    return server;
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Handle graceful shutdown
const gracefulShutdown = async () => {
  console.log("🛑 Shutdown signal received, shutting down gracefully...");
  try {
    // Stop background worker if running
    try {
      if (embeddingWorker && typeof embeddingWorker.stop === 'function') {
        embeddingWorker.stop();
      }
    } catch (wkErr) {
      console.error('Error stopping embedding worker:', wkErr);
    }

    // Close HTTP server
    if (serverInstance) {
      await new Promise((resolve, reject) => {
        serverInstance.close((err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }

    console.log("✅ Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during graceful shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Start the server
const server = startServer();

module.exports = app;
