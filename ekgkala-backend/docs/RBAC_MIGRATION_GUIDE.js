/**
 * ============================================
 * Example: Migration Guide for Permission-Based RBAC
 * ============================================
 * 
 * This file shows how to migrate from the old role-based system
 * to the new permission-based system.
 * 
 * OLD WAY (Role-Based):
 * ----------------------
 * router.post('/', protect, authorize('admin', 'manager', 'superadmin'), createProduct)
 * 
 * NEW WAY (Permission-Based):
 * ---------------------------
 * router.post('/', protect, checkPermission(PERMISSIONS.PRODUCT_CREATE), createProduct)
 * 
 * Benefits:
 * - More granular control
 * - Easier to add new roles without changing routes
 * - Single source of truth for permissions
 * - Better audit logging
 */

// ============================================
// Example Routes (Products)
// ============================================

// PUBLIC ROUTES (No auth required)
// GET /api/products - List all products
// GET /api/products/:id - Get single product

// PROTECTED ROUTES (Require specific permissions)

// POST /api/products
// Old: protect, authorize('admin', 'manager', 'superadmin')
// New: protect, checkPermission(PERMISSIONS.PRODUCT_CREATE)

// PUT /api/products/:id
// Old: protect, authorize('admin', 'manager', 'superadmin')
// New: protect, checkPermission(PERMISSIONS.PRODUCT_UPDATE)

// DELETE /api/products/:id
// Old: protect, authorize('admin', 'manager', 'superadmin')
// New: protect, checkPermission(PERMISSIONS.PRODUCT_DELETE)

// PUT /api/products/:id/stock
// Old: protect, authorize('admin', 'manager', 'superadmin')
// New: protect, checkPermission(PERMISSIONS.PRODUCT_MANAGE_STOCK)

// ============================================
// Example Routes (Orders)
// ============================================

// GET /api/orders (Admin: all orders)
// Old: protect, authorize('admin', 'manager', 'superadmin')
// New: protect, checkPermission(PERMISSIONS.ORDER_READ_ALL)

// PUT /api/orders/:id/status
// Old: protect, authorize('admin', 'manager', 'superadmin')
// New: protect, checkPermission(PERMISSIONS.ORDER_UPDATE_STATUS)

// ============================================
// Example Routes (Users)
// ============================================

// GET /api/users/admin/all
// Old: protect, authorize('admin', 'manager', 'superadmin')
// New: protect, checkPermission(PERMISSIONS.USER_READ_ALL)

// DELETE /api/users/admin/:id
// Old: protect, authorize('superadmin')
// New: protect, checkPermission(PERMISSIONS.USER_DELETE)

// ============================================
// Using checkAnyPermission (OR logic)
// ============================================

// Example: Allow access if user can view OR moderate reviews
// router.get('/reviews', protect, checkAnyPermission(
//   PERMISSIONS.REVIEW_READ,
//   PERMISSIONS.REVIEW_MODERATE
// ), getAllReviews)

// ============================================
// Using checkAllPermissions (AND logic)
// ============================================

// Example: Require both read and delete permissions for bulk delete
// router.delete('/products/bulk', protect, checkAllPermissions(
//   PERMISSIONS.PRODUCT_READ,
//   PERMISSIONS.PRODUCT_DELETE
// ), bulkDeleteProducts)

module.exports = {
    info: 'This is a documentation file showing migration examples'
}
