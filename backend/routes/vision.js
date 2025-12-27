const express = require('express');
const { analyzeDocument, analyzeBatchDocuments } = require('../controllers/visionController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Analyze single document
router.post('/analyze-document', analyzeDocument);

// Analyze batch documents
router.post('/analyze-batch', analyzeBatchDocuments);

module.exports = router;