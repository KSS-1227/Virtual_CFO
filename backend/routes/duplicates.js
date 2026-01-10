const express = require('express');
const router = express.Router();
const { 
  checkDuplicate, 
  registerDocument, 
  getDuplicateStats, 
  clearProcessedDocuments 
} = require('../controllers/duplicateController');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * @route   POST /api/duplicates/check
 * @desc    Check if a document is a duplicate
 * @access  Private
 * @body    { fileHash, fileName, fileSize, extractedData?, userId }
 */
router.post('/check', checkDuplicate);

/**
 * @route   POST /api/duplicates/register
 * @desc    Register a processed document to prevent future duplicates
 * @access  Private
 * @body    { fileHash, contentHash?, fileName, fileSize, extractedData?, userId }
 */
router.post('/register', registerDocument);

/**
 * @route   GET /api/duplicates/stats/:userId
 * @desc    Get duplicate detection statistics for a user
 * @access  Private
 */
router.get('/stats/:userId', getDuplicateStats);

/**
 * @route   DELETE /api/duplicates/clear/:userId
 * @desc    Clear all processed documents for a user
 * @access  Private
 */
router.delete('/clear/:userId', clearProcessedDocuments);

module.exports = router;