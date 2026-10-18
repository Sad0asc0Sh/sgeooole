const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Product = require('../models/Product');
const {
  getActiveSalesCampaignContext,
  findActiveSaleForProduct,
  resolveProductDisplay,
} = require('../services/pricingService');

/**
 * Wishlist Routes for Customer Users
 * All routes require authentication
 */

// ============================================
// GET /api/wishlist - Get user's wishlist
// ============================================
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: 'wishlist',
      // Include time-based promotion fields so the frontend can correctly hide expired discounts
      // and revert pricing when countdowns end (Flash Deals / Special Offers).
      // productType + variants are required so variable products resolve
      // per-variant pricing on their cards (product-level price/discount is
      // meaningless for them and produces phantom discount badges).
      select: 'name slug price compareAtPrice discount images stock countInStock category brand rating isActive isFlashDeal flashDealEndTime isSpecialOffer specialOfferEndTime campaignLabel campaignTheme productType variants pricingMeta',
      match: { isActive: true }, // Only return active products
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'کاربر یافت نشد',
      });
    }

    // Filter out null values (deleted or inactive products)
    const items = (user.wishlist || []).filter(item => item !== null);

    // ۴.۱.۲: همین‌جا همان لایه‌ی نمایش صفحه‌ی محصول اعمال می‌شود تا فرانت حتی اگر
    // قیمت را خودش بازمحاسبه کند، سقف منقضی/تخفیف مرده نبیند. خروجی سازگار است
    // (price نهایی، compareAtPrice فقط با تخفیف واقعی، discount صفر پس از انقضا).
    const now = new Date();
    const campaignContext = await getActiveSalesCampaignContext(now);
    const wishlist = items.map((item) => {
      const plain = typeof item.toObject === 'function' ? item.toObject() : item;
      const activeSale = findActiveSaleForProduct(plain, campaignContext);
      const view = resolveProductDisplay(plain, { now, activeSale }).product;
      // داده‌ی داخلی موتور قیمت‌گذاری به کلاینت نشت نکند؛ فقط قیمت نمایشی لازم است.
      delete view.pricingMeta;
      return view;
    });

    res.json({
      success: true,
      data: wishlist,
      serverNow: now.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت لیست علاقه‌مندی‌ها',
      error: error.message,
    });
  }
});

// ============================================
// POST /api/wishlist - Add item to wishlist
// ============================================
router.post('/', protect, async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'شناسه محصول الزامی است',
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'محصول یافت نشد',
      });
    }

    // Find user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'کاربر یافت نشد',
      });
    }

    // Check if already in wishlist
    if (user.wishlist && user.wishlist.includes(productId)) {
      return res.status(400).json({
        success: false,
        message: 'این محصول قبلا به لیست علاقه‌مندی‌ها اضافه شده است',
      });
    }

    // Add to wishlist
    if (!user.wishlist) {
      user.wishlist = [];
    }
    user.wishlist.push(productId);
    await user.save();

    res.json({
      success: true,
      message: 'محصول به لیست علاقه‌مندی‌ها اضافه شد',
      data: user.wishlist,
    });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در افزودن به لیست علاقه‌مندی‌ها',
      error: error.message,
    });
  }
});

// ============================================
// DELETE /api/wishlist/:productId - Remove item from wishlist
// ============================================
router.delete('/:productId', protect, async (req, res) => {
  try {
    const { productId } = req.params;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'کاربر یافت نشد',
      });
    }

    // Remove from wishlist
    if (user.wishlist) {
      user.wishlist = user.wishlist.filter(
        (id) => id.toString() !== productId
      );
      await user.save();
    }

    res.json({
      success: true,
      message: 'محصول از لیست علاقه‌مندی‌ها حذف شد',
      data: user.wishlist,
    });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در حذف از لیست علاقه‌مندی‌ها',
      error: error.message,
    });
  }
});

// ============================================
// POST /api/wishlist/toggle/:productId - Toggle item in wishlist
// ============================================
router.post('/toggle/:productId', protect, async (req, res) => {
  try {
    const { productId } = req.params;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'محصول یافت نشد',
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'کاربر یافت نشد',
      });
    }

    // Initialize wishlist if not exists
    if (!user.wishlist) {
      user.wishlist = [];
    }

    // Check if already in wishlist
    const index = user.wishlist.findIndex((id) => id.toString() === productId);

    let isInWishlist;
    if (index > -1) {
      // Remove from wishlist
      user.wishlist.splice(index, 1);
      isInWishlist = false;
    } else {
      // Add to wishlist
      user.wishlist.push(productId);
      isInWishlist = true;
    }

    await user.save();

    res.json({
      success: true,
      message: isInWishlist
        ? 'محصول به لیست علاقه‌مندی‌ها اضافه شد'
        : 'محصول از لیست علاقه‌مندی‌ها حذف شد',
      isInWishlist,
      data: user.wishlist,
    });
  } catch (error) {
    console.error('Error toggling wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در به‌روزرسانی لیست علاقه‌مندی‌ها',
      error: error.message,
    });
  }
});

// ============================================
// DELETE /api/wishlist - Clear entire wishlist
// ============================================
router.delete('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'کاربر یافت نشد',
      });
    }

    user.wishlist = [];
    await user.save();

    res.json({
      success: true,
      message: 'لیست علاقه‌مندی‌ها پاک شد',
      data: [],
    });
  } catch (error) {
    console.error('Error clearing wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در پاک کردن لیست علاقه‌مندی‌ها',
      error: error.message,
    });
  }
});

// ============================================
// GET /api/wishlist/check/:productId - Check if product is in wishlist
// ============================================
router.get('/check/:productId', protect, async (req, res) => {
  try {
    const { productId } = req.params;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'کاربر یافت نشد',
      });
    }

    const isInWishlist = user.wishlist && user.wishlist.includes(productId);

    res.json({
      success: true,
      isInWishlist,
    });
  } catch (error) {
    console.error('Error checking wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در بررسی لیست علاقه‌مندی‌ها',
      error: error.message,
    });
  }
});

module.exports = router;
