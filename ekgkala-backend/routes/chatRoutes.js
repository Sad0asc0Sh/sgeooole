const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { protect, optional } = require('../middleware/auth');

/**
 * @route   POST /api/chat
 * @desc    Send a message to AI assistant (blocking — fallback)
 * @access  Public
 */
router.post('/', optional, chatController.handleMessage);

/**
 * @route   POST /api/chat/stream
 * @desc    Send a message to AI assistant (SSE streaming — tokens in real-time)
 * @access  Public
 */
router.post('/stream', optional, chatController.handleStreamMessage);

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
