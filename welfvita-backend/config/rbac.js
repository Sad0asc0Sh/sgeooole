/**
 * ============================================
 * Permission-Based Role Access Control (RBAC)
 * Source of Truth for all system permissions
 * ============================================
 */

// ============================================
// PERMISSIONS: All possible actions in the system
// Format: resource:action
// ============================================
const PERMISSIONS = {
    // --- Product Permissions ---
    PRODUCT_READ: 'product:read',
    PRODUCT_CREATE: 'product:create',
    PRODUCT_UPDATE: 'product:update',
    PRODUCT_DELETE: 'product:delete',
    PRODUCT_MANAGE_STOCK: 'product:manage_stock',
    PRODUCT_MANAGE_IMAGES: 'product:manage_images',
    PRODUCT_IMPORT: 'product:import',
    PRODUCT_EXPORT: 'product:export',

    // --- Category Permissions ---
    CATEGORY_READ: 'category:read',
    CATEGORY_CREATE: 'category:create',
    CATEGORY_UPDATE: 'category:update',
    CATEGORY_DELETE: 'category:delete',

    // --- Brand Permissions ---
    BRAND_READ: 'brand:read',
    BRAND_CREATE: 'brand:create',
    BRAND_UPDATE: 'brand:update',
    BRAND_DELETE: 'brand:delete',

    // --- Order Permissions ---
    ORDER_READ: 'order:read',
    ORDER_READ_ALL: 'order:read_all',
    ORDER_UPDATE_STATUS: 'order:update_status',
    ORDER_DELETE: 'order:delete',

    // --- User Permissions ---
    USER_READ: 'user:read',
    USER_READ_ALL: 'user:read_all',
    USER_UPDATE: 'user:update',
    USER_DELETE: 'user:delete',
    USER_MANAGE_ROLE: 'user:manage_role',

    // --- Admin Management Permissions ---
    ADMIN_READ: 'admin:read',
    ADMIN_CREATE: 'admin:create',
    ADMIN_UPDATE: 'admin:update',
    ADMIN_DELETE: 'admin:delete',

    // --- Coupon Permissions ---
    COUPON_READ: 'coupon:read',
    COUPON_CREATE: 'coupon:create',
    COUPON_UPDATE: 'coupon:update',
    COUPON_DELETE: 'coupon:delete',

    // --- Sale/Campaign Permissions ---
    SALE_READ: 'sale:read',
    SALE_CREATE: 'sale:create',
    SALE_UPDATE: 'sale:update',
    SALE_DELETE: 'sale:delete',

    // --- Banner Permissions ---
    BANNER_READ: 'banner:read',
    BANNER_CREATE: 'banner:create',
    BANNER_UPDATE: 'banner:update',
    BANNER_DELETE: 'banner:delete',

    // --- Announcement Permissions ---
    ANNOUNCEMENT_READ: 'announcement:read',
    ANNOUNCEMENT_CREATE: 'announcement:create',
    ANNOUNCEMENT_UPDATE: 'announcement:update',
    ANNOUNCEMENT_DELETE: 'announcement:delete',

    // --- Review Permissions ---
    REVIEW_READ: 'review:read',
    REVIEW_MODERATE: 'review:moderate',
    REVIEW_REPLY: 'review:reply',
    REVIEW_DELETE: 'review:delete',

    // --- Ticket Permissions ---
    TICKET_READ: 'ticket:read',
    TICKET_READ_ALL: 'ticket:read_all',
    TICKET_REPLY: 'ticket:reply',
    TICKET_UPDATE_STATUS: 'ticket:update_status',

    // --- RMA Permissions ---
    RMA_READ: 'rma:read',
    RMA_UPDATE_STATUS: 'rma:update_status',

    // --- Page/Content Permissions ---
    PAGE_READ: 'page:read',
    PAGE_CREATE: 'page:create',
    PAGE_UPDATE: 'page:update',
    PAGE_DELETE: 'page:delete',

    // --- Blog Permissions ---
    BLOG_READ: 'blog:read',
    BLOG_CREATE: 'blog:create',
    BLOG_UPDATE: 'blog:update',
    BLOG_DELETE: 'blog:delete',

    // --- Settings Permissions ---
    SETTINGS_READ: 'settings:read',
    SETTINGS_UPDATE: 'settings:update',

    // --- Shipping Permissions ---
    SHIPPING_READ: 'shipping:read',
    SHIPPING_CREATE: 'shipping:create',
    SHIPPING_UPDATE: 'shipping:update',
    SHIPPING_DELETE: 'shipping:delete',

    // --- Report Permissions ---
    REPORT_READ_SALES: 'report:read_sales',
    REPORT_READ_PRODUCTS: 'report:read_products',
    REPORT_READ_CUSTOMERS: 'report:read_customers',

    // --- Dashboard Permissions ---
    DASHBOARD_VIEW: 'dashboard:view',

    // --- Cache/System Permissions ---
    CACHE_CLEAR: 'cache:clear',

    // --- Cart Permissions ---
    CART_READ: 'cart:read',
    CART_MANAGE: 'cart:manage',
}

// ============================================
// ROLES: Map roles to their permissions
// ============================================
const ROLES = {
    // Superadmin: Full access (all permissions)
    superadmin: Object.values(PERMISSIONS),

    // Manager: High-level operational access (almost everything except admin management)
    manager: [
        // Products
        PERMISSIONS.PRODUCT_READ,
        PERMISSIONS.PRODUCT_CREATE,
        PERMISSIONS.PRODUCT_UPDATE,
        PERMISSIONS.PRODUCT_DELETE,
        PERMISSIONS.PRODUCT_MANAGE_STOCK,
        PERMISSIONS.PRODUCT_MANAGE_IMAGES,
        PERMISSIONS.PRODUCT_IMPORT,
        PERMISSIONS.PRODUCT_EXPORT,

        // Categories
        PERMISSIONS.CATEGORY_READ,
        PERMISSIONS.CATEGORY_CREATE,
        PERMISSIONS.CATEGORY_UPDATE,
        PERMISSIONS.CATEGORY_DELETE,

        // Brands
        PERMISSIONS.BRAND_READ,
        PERMISSIONS.BRAND_CREATE,
        PERMISSIONS.BRAND_UPDATE,
        PERMISSIONS.BRAND_DELETE,

        // Orders
        PERMISSIONS.ORDER_READ,
        PERMISSIONS.ORDER_READ_ALL,
        PERMISSIONS.ORDER_UPDATE_STATUS,

        // Users
        PERMISSIONS.USER_READ,
        PERMISSIONS.USER_READ_ALL,
        PERMISSIONS.USER_UPDATE,

        // Coupons
        PERMISSIONS.COUPON_READ,
        PERMISSIONS.COUPON_CREATE,
        PERMISSIONS.COUPON_UPDATE,

        // Sales
        PERMISSIONS.SALE_READ,
        PERMISSIONS.SALE_CREATE,
        PERMISSIONS.SALE_UPDATE,
        PERMISSIONS.SALE_DELETE,

        // Banners
        PERMISSIONS.BANNER_READ,
        PERMISSIONS.BANNER_CREATE,
        PERMISSIONS.BANNER_UPDATE,
        PERMISSIONS.BANNER_DELETE,

        // Announcements
        PERMISSIONS.ANNOUNCEMENT_READ,
        PERMISSIONS.ANNOUNCEMENT_CREATE,
        PERMISSIONS.ANNOUNCEMENT_UPDATE,
        PERMISSIONS.ANNOUNCEMENT_DELETE,

        // Reviews
        PERMISSIONS.REVIEW_READ,
        PERMISSIONS.REVIEW_MODERATE,
        PERMISSIONS.REVIEW_REPLY,
        PERMISSIONS.REVIEW_DELETE,

        // Tickets
        PERMISSIONS.TICKET_READ,
        PERMISSIONS.TICKET_READ_ALL,
        PERMISSIONS.TICKET_REPLY,
        PERMISSIONS.TICKET_UPDATE_STATUS,

        // RMA
        PERMISSIONS.RMA_READ,
        PERMISSIONS.RMA_UPDATE_STATUS,

        // Pages & Blog
        PERMISSIONS.PAGE_READ,
        PERMISSIONS.PAGE_CREATE,
        PERMISSIONS.PAGE_UPDATE,
        PERMISSIONS.PAGE_DELETE,
        PERMISSIONS.BLOG_READ,
        PERMISSIONS.BLOG_CREATE,
        PERMISSIONS.BLOG_UPDATE,
        PERMISSIONS.BLOG_DELETE,

        // Settings
        PERMISSIONS.SETTINGS_READ,
        PERMISSIONS.SETTINGS_UPDATE,

        // Shipping
        PERMISSIONS.SHIPPING_READ,
        PERMISSIONS.SHIPPING_CREATE,
        PERMISSIONS.SHIPPING_UPDATE,
        PERMISSIONS.SHIPPING_DELETE,

        // Reports & Dashboard
        PERMISSIONS.REPORT_READ_SALES,
        PERMISSIONS.REPORT_READ_PRODUCTS,
        PERMISSIONS.REPORT_READ_CUSTOMERS,
        PERMISSIONS.DASHBOARD_VIEW,

        // Cache & Cart
        PERMISSIONS.CACHE_CLEAR,
        PERMISSIONS.CART_READ,
        PERMISSIONS.CART_MANAGE,
    ],

    // Admin: Standard operational access
    admin: [
        // Products (full access except import/export)
        PERMISSIONS.PRODUCT_READ,
        PERMISSIONS.PRODUCT_CREATE,
        PERMISSIONS.PRODUCT_UPDATE,
        PERMISSIONS.PRODUCT_DELETE,
        PERMISSIONS.PRODUCT_MANAGE_STOCK,
        PERMISSIONS.PRODUCT_MANAGE_IMAGES,

        // Categories
        PERMISSIONS.CATEGORY_READ,
        PERMISSIONS.CATEGORY_CREATE,
        PERMISSIONS.CATEGORY_UPDATE,
        PERMISSIONS.CATEGORY_DELETE,

        // Brands
        PERMISSIONS.BRAND_READ,
        PERMISSIONS.BRAND_CREATE,
        PERMISSIONS.BRAND_UPDATE,
        PERMISSIONS.BRAND_DELETE,

        // Orders (read & update, no delete)
        PERMISSIONS.ORDER_READ,
        PERMISSIONS.ORDER_READ_ALL,
        PERMISSIONS.ORDER_UPDATE_STATUS,

        // Users (read only)
        PERMISSIONS.USER_READ,
        PERMISSIONS.USER_READ_ALL,

        // Coupons
        PERMISSIONS.COUPON_READ,
        PERMISSIONS.COUPON_CREATE,
        PERMISSIONS.COUPON_UPDATE,

        // Sales
        PERMISSIONS.SALE_READ,
        PERMISSIONS.SALE_CREATE,
        PERMISSIONS.SALE_UPDATE,
        PERMISSIONS.SALE_DELETE,

        // Banners
        PERMISSIONS.BANNER_READ,
        PERMISSIONS.BANNER_CREATE,
        PERMISSIONS.BANNER_UPDATE,
        PERMISSIONS.BANNER_DELETE,

        // Announcements
        PERMISSIONS.ANNOUNCEMENT_READ,
        PERMISSIONS.ANNOUNCEMENT_CREATE,
        PERMISSIONS.ANNOUNCEMENT_UPDATE,
        PERMISSIONS.ANNOUNCEMENT_DELETE,

        // Reviews
        PERMISSIONS.REVIEW_READ,
        PERMISSIONS.REVIEW_MODERATE,
        PERMISSIONS.REVIEW_REPLY,
        PERMISSIONS.REVIEW_DELETE,

        // Tickets
        PERMISSIONS.TICKET_READ,
        PERMISSIONS.TICKET_READ_ALL,
        PERMISSIONS.TICKET_REPLY,
        PERMISSIONS.TICKET_UPDATE_STATUS,

        // RMA
        PERMISSIONS.RMA_READ,
        PERMISSIONS.RMA_UPDATE_STATUS,

        // Pages & Blog
        PERMISSIONS.PAGE_READ,
        PERMISSIONS.PAGE_CREATE,
        PERMISSIONS.PAGE_UPDATE,
        PERMISSIONS.PAGE_DELETE,
        PERMISSIONS.BLOG_READ,
        PERMISSIONS.BLOG_CREATE,
        PERMISSIONS.BLOG_UPDATE,
        PERMISSIONS.BLOG_DELETE,

        // Dashboard & Cart
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.CART_READ,
        PERMISSIONS.CART_MANAGE,
    ],

    // Editor: Content editing only (products, pages, blog)
    editor: [
        // Products (read & update only, no create/delete)
        PERMISSIONS.PRODUCT_READ,
        PERMISSIONS.PRODUCT_UPDATE,
        PERMISSIONS.PRODUCT_MANAGE_STOCK,
        PERMISSIONS.PRODUCT_MANAGE_IMAGES,

        // Categories (read only)
        PERMISSIONS.CATEGORY_READ,

        // Brands (read only)
        PERMISSIONS.BRAND_READ,

        // Pages & Blog (full content access)
        PERMISSIONS.PAGE_READ,
        PERMISSIONS.PAGE_CREATE,
        PERMISSIONS.PAGE_UPDATE,
        PERMISSIONS.BLOG_READ,
        PERMISSIONS.BLOG_CREATE,
        PERMISSIONS.BLOG_UPDATE,

        // Reviews (read & reply only)
        PERMISSIONS.REVIEW_READ,
        PERMISSIONS.REVIEW_REPLY,

        // Dashboard (read only)
        PERMISSIONS.DASHBOARD_VIEW,
    ],

    // Support: Customer support role (read-only for orders/users, ticket management)
    support: [
        // Orders (read only)
        PERMISSIONS.ORDER_READ,
        PERMISSIONS.ORDER_READ_ALL,

        // Users (read only)
        PERMISSIONS.USER_READ,
        PERMISSIONS.USER_READ_ALL,

        // Tickets (full access for support)
        PERMISSIONS.TICKET_READ,
        PERMISSIONS.TICKET_READ_ALL,
        PERMISSIONS.TICKET_REPLY,
        PERMISSIONS.TICKET_UPDATE_STATUS,

        // RMA (read only)
        PERMISSIONS.RMA_READ,

        // Reviews (read only)
        PERMISSIONS.REVIEW_READ,

        // Products (read only for reference)
        PERMISSIONS.PRODUCT_READ,

        // Dashboard limited view
        PERMISSIONS.DASHBOARD_VIEW,

        // Cart (read only)
        PERMISSIONS.CART_READ,
    ],

    // User/Customer: Regular customer (very limited access)
    user: [
        // Can create tickets
        PERMISSIONS.TICKET_READ,

        // Can view their own orders (handled by controller logic)
        PERMISSIONS.ORDER_READ,
    ],

    // Guest: No permissions (default for unknown roles)
    guest: [],
}

// ============================================
// Helper function: Check if a role has a specific permission
// ============================================
const hasPermission = (role, permission) => {
    if (role === 'superadmin') return true
    const rolePermissions = ROLES[role] || []
    return rolePermissions.includes(permission)
}

// ============================================
// Helper function: Get all permissions for a role
// ============================================
const getPermissions = (role) => {
    return ROLES[role] || []
}

module.exports = {
    PERMISSIONS,
    ROLES,
    hasPermission,
    getPermissions,
}
