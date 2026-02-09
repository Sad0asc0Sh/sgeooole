const express = require('express')
const router = express.Router()

const {
  createTicket,
  getMyTickets,
  getMyTicketById,
  postReplyAsUser,
  getAllTicketsAsAdmin,
  getTicketByIdAsAdmin,
  postReplyAsAdmin,
  updateTicketStatus,
} = require('../controllers/ticketController')
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')

// ============================================
// روت‌های مشتری (برای فرانت‌اند سایت)
// این روت‌ها باید قبل از /:id تعریف شوند
// ============================================
router.get('/my-tickets', protect, getMyTickets)
router.get('/my-tickets/:id', protect, getMyTicketById)
router.post('/my-tickets/:id/reply', protect, postReplyAsUser)
router.post('/', protect, createTicket)

// ============================================
// روت‌های ادمین
// مجوزهای مورد نیاز: TICKET_READ_ALL, TICKET_REPLY, TICKET_UPDATE_STATUS
// ============================================

// GET /api/tickets/admin/all - دریافت لیست تمام تیکت‌ها
router.get(
  '/admin/all',
  protect,
  checkPermission(PERMISSIONS.TICKET_READ_ALL),
  getAllTicketsAsAdmin,
)

// GET /api/tickets/admin - امکان استفاده از این مسیر نیز
router.get(
  '/admin',
  protect,
  checkPermission(PERMISSIONS.TICKET_READ_ALL),
  getAllTicketsAsAdmin,
)

// GET /api/tickets/:id - دریافت جزئیات تیکت
router.get(
  '/:id',
  protect,
  checkPermission(PERMISSIONS.TICKET_READ_ALL),
  getTicketByIdAsAdmin,
)

// POST /api/tickets/:id/reply - پاسخ ادمین به تیکت
router.post(
  '/:id/reply',
  protect,
  checkPermission(PERMISSIONS.TICKET_REPLY),
  postReplyAsAdmin,
)

// PUT /api/tickets/:id/status - تغییر وضعیت تیکت
router.put(
  '/:id/status',
  protect,
  checkPermission(PERMISSIONS.TICKET_UPDATE_STATUS),
  updateTicketStatus,
)

module.exports = router

