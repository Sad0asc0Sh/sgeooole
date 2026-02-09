const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { protect, optional } = require('../middleware/auth');

/**
 * @route   POST /api/chat
 * @desc    Send a message to AI assistant
 * @access  Public (but better with userId for personalized responses)
 */
router.post('/', optional, chatController.handleMessage);

/**
 * @route   GET /api/chat/suggestions
 * @desc    Get suggested questions
 * @access  Public
 */
router.get('/suggestions', chatController.getSuggestions);

/**
 * @route   DELETE /api/chat/history/:userId
 * @desc    Clear chat history for a user
 * @access  Protected
 */
router.delete('/history/:userId', protect, chatController.clearHistory);

module.exports = router;
