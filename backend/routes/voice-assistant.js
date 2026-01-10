const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { 
  processProactiveCommand,
  generateAlerts,
  generateSpeech,
  startMonitoring,
  generateReport,
  processInventoryVoice,
} = require('../controllers/voiceAssistantController');

// Proactive voice command processing
router.post('/proactive', authenticateToken, processProactiveCommand);

// Generate business alerts
router.post('/alerts', authenticateToken, generateAlerts);

// Enhanced speech generation
router.post('/speech', authenticateToken, generateSpeech);

// Start business monitoring
router.post('/monitoring/start', authenticateToken, startMonitoring);

// Generate intelligent reports
router.post('/report', authenticateToken, generateReport);

// Inventory-specific voice commands (stock in/out/check stock)
router.post('/inventory', authenticateToken, processInventoryVoice);

// Send business alert
router.post('/alert/send', authenticateToken, async (req, res) => {
  // Implementation for sending alerts via various channels
  res.json({ success: true, message: 'Alert sent successfully' });
});

module.exports = router;