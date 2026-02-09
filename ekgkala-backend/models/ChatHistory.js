const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

const chatHistorySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sessionId: { type: String }, // For future guest support
    messages: [messageSchema],
    lastUpdated: { type: Date, default: Date.now },
    usage: {
        dailyCount: { type: Number, default: 0 },
        lastReset: { type: Date, default: Date.now }
    }
}, { timestamps: true });

module.exports = mongoose.model('ChatHistory', chatHistorySchema);
