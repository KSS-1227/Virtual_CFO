const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const { 
  processVoiceCommand,
  generateSpeech,
  processAudio
} = require('../controllers/voiceController');

// Configure multer for audio uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit for audio
});

// Process voice command (text)
router.post('/command', authenticateToken, processVoiceCommand);

// Generate speech from text
router.post('/speech', authenticateToken, generateSpeech);

// Process audio file (Whisper)
router.post('/audio', authenticateToken, upload.single('audio'), processAudio);

module.exports = router;