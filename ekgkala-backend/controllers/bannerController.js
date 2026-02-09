const Banner = require('../models/Banner')

// لیست بنرها (با فیلتر و صفحه‌بندی)
exports.getBanners = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 20
    const skip = (page - 1) * limit

    const filter = {}

    if (req.query.position) {
      filter.position = req.query.position
    }

    if (req.query.isActive === 'true') {
      filter.isActive = true
    } else if (req.query.isActive === 'false') {
      filter.isActive = false
    }

    const sort = req.query.sort || 'sortOrder -createdAt'

    const query = Banner.find(filter).sort(sort).skip(skip).limit(limit)

    const [items, total] = await Promise.all([query.lean(), Banner.countDocuments(filter)])

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
    console.error('Error fetching banners:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت بنرها',
      error: error.message,
    })
  }
}

// ایجاد بنر
exports.createBanner = async (req, res) => {
  try {
    const { title, link, position, isActive, image, sortOrder } = req.body || {}

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'عنوان بنر الزامی است',
      })
    }

    const banner = await Banner.create({
      title,
      link: link || '',
      position: position || 'homepage-slider',
      isActive: isActive !== undefined ? isActive : true,
      image: image || null,
      sortOrder: sortOrder || 0,
    })

    res.status(201).json({
      success: true,
      message: 'بنر با موفقیت ایجاد شد',
      data: banner,
    })
  } catch (error) {
    console.error('Error creating banner:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در ایجاد بنر',
      error: error.message,
    })
  }
}

// ویرایش بنر
exports.updateBanner = async (req, res) => {
  try {
    const updates = req.body || {}

    const banner = await Banner.findById(req.params.id)
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'بنر یافت نشد',
      })
    }

    if (updates.title !== undefined) banner.title = updates.title
    if (updates.link !== undefined) banner.link = updates.link
    if (updates.position !== undefined) banner.position = updates.position
    if (updates.isActive !== undefined) banner.isActive = updates.isActive
    if (updates.image !== undefined) banner.image = updates.image || null
    if (updates.sortOrder !== undefined) banner.sortOrder = updates.sortOrder

    const saved = await banner.save()

    res.json({
      success: true,
      message: 'بنر با موفقیت ویرایش شد',
      data: saved,
    })
  } catch (error) {
    console.error('Error updating banner:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در ویرایش بنر',
      error: error.message,
    })
  }
}

// حذف بنر
exports.deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id)
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'بنر یافت نشد',
      })
    }

    await banner.deleteOne()

    res.json({
      success: true,
      message: 'بنر با موفقیت حذف شد',
    })
  } catch (error) {
    console.error('Error deleting banner:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در حذف بنر',
      error: error.message,
    })
  }
}

