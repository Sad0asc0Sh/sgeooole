const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

const stepSchema = new mongoose.Schema({
    key: { type: String, required: true },
    title: { type: String, required: true },
    hint: { type: String, default: '' },
    optional: { type: Boolean, default: false },
    categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    status: {
        type: String,
        enum: ['pending', 'current', 'done', 'skipped', 'unavailable'],
        default: 'pending',
    },
}, { _id: false });

const selectionSchema = new mongoose.Schema({
    stepKey: { type: String, required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    qty: { type: Number, default: 1, min: 1 },
    decidedAt: { type: Date, default: Date.now },
}, { _id: false });

const chatHistorySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sessionId: { type: String }, // For future guest support
    messages: [messageSchema],
    lastUpdated: { type: Date, default: Date.now },
    usage: {
        dailyCount: { type: Number, default: 0 },
        lastReset: { type: Date, default: Date.now }
    },
    // ویزارد پک‌ساز مرحله‌به‌مرحله (مثلاً پک دوربین): وضعیت در سرور می‌ماند تا با رفرش/جزئیات گم نشود
    packWizard: {
        active: { type: Boolean, default: false },
        domainId: { type: String, default: '' },
        title: { type: String, default: '' },
        steps: { type: [stepSchema], default: [] },
        currentIndex: { type: Number, default: 0 },
        selections: { type: [selectionSchema], default: [] },
        updatedAt: { type: Date, default: Date.now },
    },
}, { timestamps: true });

module.exports = mongoose.model('ChatHistory', chatHistorySchema);
