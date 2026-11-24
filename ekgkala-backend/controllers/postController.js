const Post = require('../models/Post')
const mongoose = require('mongoose')
const { sanitizeHtmlContent } = require('../utils/htmlSanitizer')

const ALLOWED_POST_SORTS = new Set(['createdAt', '-createdAt', 'updatedAt', '-updatedAt', 'title', '-title', 'status', '-status'])
const ALLOWED_POST_STATUSES = new Set(['draft', 'published'])

// لیست پست‌ها برای ادمین (با فیلتر و صفحه‌بندی)
exports.getAdminPosts = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20))
    const skip = (page - 1) * limit

    const filter = {}

    if (req.query.status && ALLOWED_POST_STATUSES.has(String(req.query.status))) {
      filter.status = String(req.query.status)
    }

    if (req.query.category && mongoose.Types.ObjectId.isValid(String(req.query.category))) {
      filter.category = String(req.query.category)
    }

    if (req.query.search && typeof req.query.search === 'string') {
      const escapedSearch = req.query.search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (escapedSearch) {
        filter.title = { $regex: escapedSearch, $options: 'i' }
      }
    }

    const rawSort = typeof req.query.sort === 'string' ? req.query.sort.trim() : '-createdAt'
    const sort = ALLOWED_POST_SORTS.has(rawSort) ? rawSort : '-createdAt'

    const query = Post.find(filter)
      .populate('category', 'name')
      .populate('author', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limit)

    const [items, total] = await Promise.all([query.lean(), Post.countDocuments(filter)])

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
    console.error('Error fetching posts:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت پست‌های بلاگ',
      error: error.message,
    })
  }
}

// ایجاد پست جدید
exports.createPost = async (req, res) => {
  try {
    const { title, slug, content, category, tags, status, featuredImage, meta } = req.body || {}

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'عنوان پست الزامی است',
      })
    }

    const postStatus = status && ALLOWED_POST_STATUSES.has(String(status)) ? String(status) : 'draft'
    const payload = {
      title,
      slug,
      content: sanitizeHtmlContent(content || ''),
      category: category || undefined,
      tags: Array.isArray(tags) ? tags : [],
      status: postStatus,
      meta: meta || {},
      featuredImage: featuredImage || null,
    }

    if (req.user && req.user._id) {
      payload.author = req.user._id
    }

    const post = await Post.create(payload)

    res.status(201).json({
      success: true,
      message: 'پست با موفقیت ایجاد شد',
      data: post,
    })
  } catch (error) {
    console.error('Error creating post:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در ایجاد پست بلاگ',
      error: error.message,
    })
  }
}

// دریافت یک پست بر اساس ID
exports.getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('category', 'name')
      .populate('author', 'name email')

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'پست یافت نشد',
      })
    }

    res.json({
      success: true,
      data: post,
    })
  } catch (error) {
    console.error('Error fetching post:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت پست بلاگ',
      error: error.message,
    })
  }
}

// ویرایش پست
exports.updatePost = async (req, res) => {
  try {
    const updates = req.body || {}

    const post = await Post.findById(req.params.id)
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'پست یافت نشد',
      })
    }

    if (updates.title !== undefined) post.title = updates.title
    if (updates.slug !== undefined) post.slug = updates.slug
    if (updates.content !== undefined) post.content = sanitizeHtmlContent(updates.content || '')
    if (updates.category !== undefined) post.category = updates.category || undefined
    if (updates.tags !== undefined) {
      post.tags = Array.isArray(updates.tags) ? updates.tags : []
    }
    if (updates.status !== undefined && ALLOWED_POST_STATUSES.has(String(updates.status))) {
      post.status = String(updates.status)
    }
    if (updates.meta !== undefined) post.meta = updates.meta || {}
    if (updates.featuredImage !== undefined) {
      post.featuredImage = updates.featuredImage || null
    }

    const saved = await post.save()

    res.json({
      success: true,
      message: 'پست با موفقیت ویرایش شد',
      data: saved,
    })
  } catch (error) {
    console.error('Error updating post:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در ویرایش پست بلاگ',
      error: error.message,
    })
  }
}

// حذف پست
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'پست یافت نشد',
      })
    }

    await post.deleteOne()

    res.json({
      success: true,
      message: 'پست با موفقیت حذف شد',
    })
  } catch (error) {
    console.error('Error deleting post:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در حذف پست بلاگ',
      error: error.message,
    })
  }
}

