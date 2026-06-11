const Page = require('../models/Page')

// ──────────────────────────────────────────────
// Helper: sanitize slug
// ──────────────────────────────────────────────
function sanitizeSlug(raw) {
  return raw
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}\-]+/gu, '')
    .replace(/\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}

// ──────────────────────────────────────────────
// دریافت صفحه با slug (عمومی - برای فرانت‌اند)
// ──────────────────────────────────────────────
exports.getPageBySlug = async (req, res) => {
  try {
    const { slug } = req.params

    const page = await Page.findOne({ slug, status: 'published' }).lean()

    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'صفحه یافت نشد',
      })
    }

    res.json({
      success: true,
      data: page,
    })
  } catch (error) {
    console.error('Error fetching page by slug:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت صفحه',
      error: error.message,
    })
  }
}

// ──────────────────────────────────────────────
// دریافت صفحه با slug (ادمین - بدون فیلتر وضعیت)
// ──────────────────────────────────────────────
exports.getPageBySlugAdmin = async (req, res) => {
  try {
    const { slug } = req.params

    const page = await Page.findOne({ slug }).lean()

    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'صفحه یافت نشد',
      })
    }

    res.json({
      success: true,
      data: page,
    })
  } catch (error) {
    console.error('Error fetching page by slug (admin):', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت صفحه',
      error: error.message,
    })
  }
}

// ──────────────────────────────────────────────
// لیست صفحات برای ادمین (با فیلتر و صفحه‌بندی)
// ──────────────────────────────────────────────
exports.getAdminPages = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 20
    const skip = (page - 1) * limit

    const filter = {}

    if (req.query.status) {
      filter.status = req.query.status
    }

    if (req.query.search) {
      filter.title = { $regex: req.query.search, $options: 'i' }
    }

    const sort = req.query.sort || '-createdAt'

    const query = Page.find(filter).sort(sort).skip(skip).limit(limit)

    const [items, total] = await Promise.all([query.lean(), Page.countDocuments(filter)])

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
    console.error('Error fetching pages:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت صفحات',
      error: error.message,
    })
  }
}

// ──────────────────────────────────────────────
// ایجاد صفحه جدید
// ──────────────────────────────────────────────
exports.createPage = async (req, res) => {
  try {
    const { title, slug, content, status, meta } = req.body || {}

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'عنوان صفحه الزامی است',
      })
    }

    // Sanitize slug: use provided slug or auto-generate from title
    const finalSlug = slug ? sanitizeSlug(slug) : sanitizeSlug(title)

    if (!finalSlug) {
      return res.status(400).json({
        success: false,
        message: 'اسلاگ معتبر نیست. لطفاً عنوان یا اسلاگ را اصلاح کنید.',
      })
    }

    // Check for duplicate slug before attempting to create
    const existing = await Page.findOne({ slug: finalSlug }).lean()
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A page with this slug already exists',
      })
    }

    const page = await Page.create({
      title,
      slug: finalSlug,
      content: content || '',
      status: status || 'published',
      meta: meta || {},
    })

    res.status(201).json({
      success: true,
      message: 'صفحه با موفقیت ایجاد شد',
      data: page,
    })
  } catch (error) {
    console.error('Error creating page:', error)

    // Handle Mongoose duplicate key error (race condition safety net)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A page with this slug already exists',
      })
    }

    res.status(500).json({
      success: false,
      message: 'خطا در ایجاد صفحه',
      error: error.message,
    })
  }
}

// ──────────────────────────────────────────────
// ویرایش صفحه
// ──────────────────────────────────────────────
exports.updatePage = async (req, res) => {
  try {
    const updates = req.body || {}

    const page = await Page.findById(req.params.id)
    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'صفحه یافت نشد',
      })
    }

    if (updates.title !== undefined) page.title = updates.title

    // Sanitize slug if provided
    if (updates.slug !== undefined) {
      const sanitizedSlug = sanitizeSlug(updates.slug)
      if (!sanitizedSlug) {
        return res.status(400).json({
          success: false,
          message: 'اسلاگ معتبر نیست. لطفاً اسلاگ را اصلاح کنید.',
        })
      }

      // Check if another page already uses this slug
      if (sanitizedSlug !== page.slug) {
        const existing = await Page.findOne({ slug: sanitizedSlug, _id: { $ne: page._id } }).lean()
        if (existing) {
          return res.status(409).json({
            success: false,
            message: 'Slug already in use by another page',
          })
        }
      }

      page.slug = sanitizedSlug
    }

    if (updates.content !== undefined) page.content = updates.content
    if (updates.status !== undefined) page.status = updates.status

    // FIX 3: Merge meta fields instead of replacing entirely
    if (updates.meta !== undefined) {
      page.meta = { ...page.meta, ...updates.meta }
    }

    const saved = await page.save()

    res.json({
      success: true,
      message: 'صفحه با موفقیت ویرایش شد',
      data: saved,
    })
  } catch (error) {
    console.error('Error updating page:', error)

    // Handle Mongoose duplicate key error (race condition safety net)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Slug already in use by another page',
      })
    }

    res.status(500).json({
      success: false,
      message: 'خطا در ویرایش صفحه',
      error: error.message,
    })
  }
}

// ──────────────────────────────────────────────
// حذف صفحه
// ──────────────────────────────────────────────
exports.deletePage = async (req, res) => {
  try {
    const page = await Page.findById(req.params.id)
    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'صفحه یافت نشد',
      })
    }

    await page.deleteOne()

    res.json({
      success: true,
      message: 'صفحه با موفقیت حذف شد',
    })
  } catch (error) {
    console.error('Error deleting page:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در حذف صفحه',
      error: error.message,
    })
  }
}
