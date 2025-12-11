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
const { protect, authorize } = require('../middleware/auth')

// --- روت‌های مشتری (برای فرانت‌اند سایت) ---
// این روت‌ها باید قبل از /:id تعریف شوند
router.get('/my-tickets', protect, getMyTickets)
router.get('/my-tickets/:id', protect, getMyTicketById)
router.post('/my-tickets/:id/reply', protect, postReplyAsUser)
router.post('/', protect, createTicket)

// --- روت‌های ادمین ---
router.get(
  '/admin/all',
  protect,
  authorize('admin', 'manager', 'superadmin'),
  getAllTicketsAsAdmin,
)

// امکان استفاده از /api/tickets/admin نیز
router.get(
  '/admin',
  protect,
  authorize('admin', 'manager', 'superadmin'),
  getAllTicketsAsAdmin,
)

router.get(
  '/:id',
  protect,
  authorize('admin', 'manager', 'superadmin'),
  getTicketByIdAsAdmin,
)

router.post(
  '/:id/reply',
  protect,
  authorize('admin', 'manager', 'superadmin'),
  postReplyAsAdmin,
)

router.put(
  '/:id/status',
  protect,
  authorize('admin', 'manager', 'superadmin'),
  updateTicketStatus,
)

module.exports = router
