const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { protect, optional } = require('../middleware/auth');
const { createCustomLimiter } = require('../middleware/rateLimiter');

const aiChatLimiter = createCustomLimiter({
    name: 'ai-chat',
    windowMs: 60 * 1000,
    max: 8,
    keyType: 'ip',
});

/**
 * @route   POST /api/chat
 * @desc    Send a message to AI assistant (blocking — fallback)
 * @access  Public
 */
router.post('/', aiChatLimiter, optional, chatController.handleMessage);

/**
 * @route   POST /api/chat/stream
 * @desc    Send a message to AI assistant (SSE streaming — tokens in real-time)
 * @access  Public
 */
router.post('/stream', aiChatLimiter, optional, chatController.handleStreamMessage);

/**
 * @route   GET /api/chat/suggestions
 * @desc    Get suggested questions
 * @access  Public
 */
router.get('/suggestions', chatController.getSuggestions);

/**
 * @route   DELETE /api/chat/history
 * @desc    Start fresh: clear conversation for current identity (logged-in user OR guest session)
 * @access  Public (identity via auth token or x-session-id)
 */
router.delete('/history', optional, chatController.clearMyHistory);

/**
 * @route   DELETE /api/chat/history/:userId
 * @desc    Clear chat history for a user (legacy)
 * @access  Protected
 */
router.delete('/history/:userId', protect, chatController.clearHistory);

module.exports = router;
