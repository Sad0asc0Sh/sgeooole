const Ticket = require('../models/Ticket')

// Helper: ساخت فیلتر براساس کوئری برای ادمین
const buildTicketFilter = (query) => {
  const filter = {}

  if (query.status) {
    filter.status = query.status
  }

  if (query.priority) {
    filter.priority = query.priority
  }

  if (query.search) {
    // جستجو روی موضوع (و در آینده می‌توان ایمیل را هم اضافه کرد)
    filter.subject = { $regex: query.search, $options: 'i' }
  }

  return filter
}

// --- روت‌های ادمین ---

// لیست همه تیکت‌ها برای ادمین
exports.getAllTicketsAsAdmin = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 20
    const skip = (page - 1) * limit

    const filter = buildTicketFilter(req.query)
    const sort = req.query.sort || '-createdAt'

    const query = Ticket.find(filter)
      .populate('user', 'name email')
      .populate('order', '_id')
      .sort(sort)
      .skip(skip)
      .limit(limit)

    const [tickets, total] = await Promise.all([query.lean(), Ticket.countDocuments(filter)])

    // افزودن فیلد orderNumber بر اساس _id برای نمایش در جدول
    const data = tickets.map((t) => {
      const order = t.order
      const orderWithNumber =
        order && order._id
          ? {
            ...order,
            orderNumber: order._id.toString().slice(-8),
          }
          : order

      return {
        ...t,
        order: orderWithNumber,
      }
    })

    res.json({
      success: true,
      data,
      pagination: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    })
  } catch (error) {
    console.error('Error fetching tickets (admin):', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت لیست تیکت‌ها',
      error: error.message,
    })
  }
}

// جزئیات یک تیکت برای ادمین
exports.getTicketByIdAsAdmin = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('user', 'name email')
      .populate('order', '_id')
      .populate('messages.sender', 'name email')

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'تیکت یافت نشد',
      })
    }

    const obj = ticket.toObject()

    // اضافه کردن timestamp برای سازگاری با UI فعلی
    obj.messages = (obj.messages || []).map((m) => ({
      ...m,
      timestamp: m.createdAt,
    }))

    // افزودن orderNumber مشابه لیست
    if (obj.order && obj.order._id) {
      obj.order = {
        ...obj.order,
        orderNumber: obj.order._id.toString().slice(-8),
      }
    }

    res.json({
      success: true,
      data: obj,
    })
  } catch (error) {
    console.error('Error fetching ticket (admin):', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت تیکت',
      error: error.message,
    })
  }
}

// پاسخ ادمین به تیکت
exports.postReplyAsAdmin = async (req, res) => {
  try {
    const { message } = req.body || {}
    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'متن پاسخ نمی‌تواند خالی باشد',
      })
    }

    const ticket = await Ticket.findById(req.params.id)
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'تیکت یافت نشد',
      })
    }

    ticket.messages.push({
      sender: req.user._id,
      message: message.trim(),
      isAdminReply: true,
    })

    // پس از پاسخ ادمین، وضعیت را به pending (در انتظار کاربر) تغییر می‌دهیم
    ticket.status = 'pending'

    const saved = await ticket.save()

    res.json({
      success: true,
      message: 'پاسخ با موفقیت ثبت شد',
      data: saved,
    })
  } catch (error) {
    console.error('Error posting admin reply:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در ثبت پاسخ تیکت',
      error: error.message,
    })
  }
}

// به‌روزرسانی وضعیت تیکت (ادمین)
exports.updateTicketStatus = async (req, res) => {
  try {
    const { status } = req.body || {}

    const allowedStatuses = ['open', 'pending', 'closed']
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'وضعیت نامعتبر است',
      })
    }

    const ticket = await Ticket.findById(req.params.id)
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'تیکت یافت نشد',
      })
    }

    ticket.status = status
    const saved = await ticket.save()

    res.json({
      success: true,
      message: 'وضعیت تیکت با موفقیت به‌روزرسانی شد',
      data: saved,
    })
  } catch (error) {
    console.error('Error updating ticket status:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در به‌روزرسانی وضعیت تیکت',
      error: error.message,
    })
  }
}

// --- روت‌های مشتری ---

// ایجاد تیکت جدید توسط کاربر
exports.createTicket = async (req, res) => {
  try {
    const { subject, message, order, priority } = req.body || {}

    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'موضوع و متن پیام الزامی است',
      })
    }

    const ticket = await Ticket.create({
      user: req.user._id,
      order: order || undefined,
      subject,
      priority: priority || 'medium',
      messages: [
        {
          sender: req.user._id,
          message,
          isAdminReply: false,
        },
      ],
    })

    res.status(201).json({
      success: true,
      message: 'تیکت با موفقیت ثبت شد',
      data: ticket,
    })
  } catch (error) {
    console.error('Error creating ticket:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در ثبت تیکت',
      error: error.message,
    })
  }
}

// لیست تیکت‌های کاربر جاری
exports.getMyTickets = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 20
    const skip = (page - 1) * limit

    const filter = { user: req.user._id }

    if (req.query.status) {
      filter.status = req.query.status
    }

    if (req.query.priority) {
      filter.priority = req.query.priority
    }

    const sort = req.query.sort || '-updatedAt'

    const query = Ticket.find(filter).sort(sort).skip(skip).limit(limit)

    const [items, total] = await Promise.all([query.lean(), Ticket.countDocuments(filter)])

    res.json({
      success: true,
      data: items,
      pagination: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    })
  } catch (error) {
    console.error('Error fetching user tickets:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت تیکت‌های شما',
      error: error.message,
    })
  }
}

// جزئیات یک تیکت برای کاربر (فقط تیکت‌های خودش)
exports.getMyTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({
      _id: req.params.id,
      user: req.user._id, // فقط تیکت‌های خود کاربر
    })
      .populate('messages.sender', 'name email')

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'تیکت یافت نشد',
      })
    }

    const obj = ticket.toObject()

    // اضافه کردن timestamp برای سازگاری با UI
    obj.messages = (obj.messages || []).map((m) => ({
      ...m,
      timestamp: m.createdAt,
    }))

    res.json({
      success: true,
      data: obj,
    })
  } catch (error) {
    console.error('Error fetching user ticket:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت تیکت',
      error: error.message,
    })
  }
}

// پاسخ کاربر به تیکت خودش
exports.postReplyAsUser = async (req, res) => {
  try {
    const { message } = req.body || {}
    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'متن پاسخ نمی‌تواند خالی باشد',
      })
    }

    const ticket = await Ticket.findOne({
      _id: req.params.id,
      user: req.user._id, // فقط تیکت‌های خود کاربر
    })

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'تیکت یافت نشد',
      })
    }

    // اگر تیکت بسته شده باشد، کاربر نمی‌تواند پاسخ دهد
    if (ticket.status === 'closed') {
      return res.status(400).json({
        success: false,
        message: 'تیکت بسته شده است و امکان ارسال پاسخ وجود ندارد',
      })
    }

    ticket.messages.push({
      sender: req.user._id,
      message: message.trim(),
      isAdminReply: false,
    })

    // پس از پاسخ کاربر، وضعیت را به open تغییر می‌دهیم
    ticket.status = 'open'

    const saved = await ticket.save()

    res.json({
      success: true,
      message: 'پاسخ با موفقیت ثبت شد',
      data: saved,
    })
  } catch (error) {
    console.error('Error posting user reply:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در ثبت پاسخ',
      error: error.message,
    })
  }
}

