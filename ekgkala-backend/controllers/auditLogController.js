const AuditLog = require('../models/AuditLog')

// GET /api/audit-logs
exports.getAuditLogs = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1)
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20))
        const skip = (page - 1) * limit

        const logs = await AuditLog.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('user', 'name email role')
            .lean()

        const total = await AuditLog.countDocuments()

        res.json({
            success: true,
            data: logs,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
            },
        })
    } catch (error) {
        console.error('Error fetching audit logs:', error)
        res.status(500).json({
            success: false,
            message: 'خطا در دریافت گزارش عملکرد',
        })
    }
}
