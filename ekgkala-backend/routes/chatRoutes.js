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
 * @route   POST /api/chat/pack/action
 * @desc    Pack wizard actions: select | skip | back | restart (validated server-side)
 * @access  Public
 */
router.post('/pack/action', aiChatLimiter, optional, chatController.handlePackAction);

/**
 * @route   GET /api/chat/pack/state
 * @desc    Read-only wizard state for the product page (no daily-limit consumption)
 * @access  Public
 */
router.get('/pack/state', optional, chatController.getPackState);

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
