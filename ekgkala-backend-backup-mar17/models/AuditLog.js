const mongoose = require('mongoose')

const auditLogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true,
        trim: true,
    },
    entity: {
        type: String, // e.g., 'Order', 'Product', 'User'
        required: true,
    },
    entityId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'entity',
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin', // Assuming actions are mostly by admins, but could be User too
    },
    details: {
        type: Object, // Store changes or relevant info
    },
    ip: {
        type: String,
    },
    userAgent: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
})

module.exports = mongoose.model('AuditLog', auditLogSchema)
