const AuditLog = require('../models/AuditLog')
const User = require('../models/Admin')

// GET /api/audit-logs
exports.getAuditLogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20))
    const skip = (page - 1) * limit

    const filter = {}

    if (typeof req.query.action === 'string' && req.query.action.trim()) {
      filter.action = req.query.action.trim()
    }
    if (typeof req.query.entity === 'string' && req.query.entity.trim()) {
      filter.entity = req.query.entity.trim()
    }

    if (req.query.startDate || req.query.endDate) {
      const dateCond = {}
      if (req.query.startDate) {
        const s = new Date(req.query.startDate)
        if (!Number.isNaN(s.getTime())) dateCond.$gte = s
      }
      if (req.query.endDate) {
        const e = new Date(req.query.endDate)
        if (!Number.isNaN(e.getTime())) {
          e.setHours(23, 59, 59, 999)
          dateCond.$lte = e
        }
      }
      if (Object.keys(dateCond).length > 0) {
        filter.createdAt = dateCond
      }
    }

    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : ''
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const rx = { $regex: escaped, $options: 'i' }
      const matchingUsers = await User.find({
        $or: [{ name: rx }, { email: rx }],
      })
        .select('_id')
        .lean()
      const userIds = matchingUsers.map((u) => u._id)
      filter.$or = [
        { action: rx },
        { entity: rx },
        { ip: rx },
        ...(userIds.length > 0 ? [{ user: { $in: userIds } }] : []),
      ]
    }

    const [logs, total, actions, entities] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'name email role')
        .lean(),
      AuditLog.countDocuments(filter),
      AuditLog.distinct('action'),
      AuditLog.distinct('entity'),
    ])

    res.json({
      success: true,
      data: logs,
      filters: {
        actions: (actions || []).filter(Boolean).sort(),
        entities: (entities || []).filter(Boolean).sort(),
      },
      pagination: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems: total,
        totalPages: total > 0 ? Math.ceil(total / limit) : 0,
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
