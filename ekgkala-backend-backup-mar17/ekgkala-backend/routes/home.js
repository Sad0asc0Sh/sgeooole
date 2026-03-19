const express = require('express');
const router = express.Router();

/* ---------- داده‌های نمونه ----------
   در واقع باید این داده‌ها را از دیتابیس (Mongo, PostgreSQL و …) بخوانید.
   برای تست اولیه می‌توانید یک آرایهٔ ثابت بگذارید.
------------------------------------------------ */

const featuredCategories = [
  // مثال: { _id: "1", title: "دسته‌ بندی ویژه ۱", image: "url‑1" }
];

const popularCategories = [
  // مثال: { _id: "1", title: "دسته‌ بندی پرطرفدار ۱", image: "url‑2" }
];

/* ---------- روت‌ها ---------- */
router.get('/api/featured-categories', (req, res) => {
  res.json({ success: true, data: featuredCategories });
});

router.get('/api/popular-categories', (req, res) => {
  res.json({ success: true, data: popularCategories });
});

module.exports = router;

