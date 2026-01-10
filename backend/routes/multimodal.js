const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { 
  processReceiptImage,
  processVoiceInput,
  analyzeBusinessImage,
  processProductImage,
  generateVoiceResponse
} = require('../controllers/multiModalController');

// Receipt image processing with GPT-4 Vision
router.post('/receipt/analyze', authenticateToken, processReceiptImage);

// Voice command processing with Whisper + GPT-4
router.post('/voice/process', authenticateToken, processVoiceInput);

// Business photo analysis
router.post('/business/analyze', authenticateToken, analyzeBusinessImage);

// Single product image → inventory suggestions (no auto-write)
router.post('/inventory/product-image', authenticateToken, processProductImage);

// Generate voice response
router.post('/speech/generate', authenticateToken, generateVoiceResponse);

module.exports = router;