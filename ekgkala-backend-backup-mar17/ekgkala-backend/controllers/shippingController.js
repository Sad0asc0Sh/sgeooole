const ShippingMethod = require('../models/ShippingMethod')

// ایجاد روش ارسال جدید
exports.createMethod = async (req, res) => {
  try {
    const { name, description, costType, cost, isActive } = req.body || {}

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'نام روش ارسال الزامی است',
      })
    }

    const existing = await ShippingMethod.findOne({ name })
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'روش ارسال با این نام قبلاً ثبت شده است',
      })
    }

    const method = await ShippingMethod.create({
      name,
      description,
      costType: costType || 'fixed',
      cost,
      isActive: isActive !== undefined ? isActive : true,
    })

    res.status(201).json({
      success: true,
      message: 'روش ارسال با موفقیت ایجاد شد',
      data: method,
    })
  } catch (error) {
    console.error('Error creating shipping method:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در ایجاد روش ارسال',
      error: error.message,
    })
  }
}

// دریافت همه روش‌های ارسال (عمومی و ادمین)
exports.getAllMethods = async (req, res) => {
  try {
    const filter = {}

    // اگر کوئری isActive صراحتاً داده نشده، برای روت عمومی فقط فعال‌ها برگردانیم
    if (req.path === '/' && req.method === 'GET' && req.query.includeInactive !== 'true') {
      filter.isActive = true
    }

    const methods = await ShippingMethod.find(filter).sort({ createdAt: -1 }).lean()

    res.json({
      success: true,
      data: methods,
    })
  } catch (error) {
    console.error('Error fetching shipping methods:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت روش‌های ارسال',
      error: error.message,
    })
  }
}

// دریافت یک روش ارسال بر اساس ID
exports.getMethodById = async (req, res) => {
  try {
    const method = await ShippingMethod.findById(req.params.id)

    if (!method) {
      return res.status(404).json({
        success: false,
        message: 'روش ارسال یافت نشد',
      })
    }

    res.json({
      success: true,
      data: method,
    })
  } catch (error) {
    console.error('Error fetching shipping method:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت روش ارسال',
      error: error.message,
    })
  }
}

// ویرایش روش ارسال
exports.updateMethod = async (req, res) => {
  try {
    const updates = req.body || {}

    const method = await ShippingMethod.findById(req.params.id)
    if (!method) {
      return res.status(404).json({
        success: false,
        message: 'روش ارسال یافت نشد',
      })
    }

    if (updates.name && updates.name !== method.name) {
      const existing = await ShippingMethod.findOne({ name: updates.name })
      if (existing && existing._id.toString() !== method._id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'روش ارسال دیگری با این نام وجود دارد',
        })
      }
    }

    method.name = updates.name ?? method.name
    method.description = updates.description ?? method.description
    method.costType = updates.costType ?? method.costType
    if (updates.cost !== undefined) {
      method.cost = updates.cost
    }
    if (updates.isActive !== undefined) {
      method.isActive = updates.isActive
    }

    const saved = await method.save()

    res.json({
      success: true,
      message: 'روش ارسال با موفقیت ویرایش شد',
      data: saved,
    })
  } catch (error) {
    console.error('Error updating shipping method:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در ویرایش روش ارسال',
      error: error.message,
    })
  }
}

// حذف روش ارسال
exports.deleteMethod = async (req, res) => {
  try {
    const method = await ShippingMethod.findById(req.params.id)

    if (!method) {
      return res.status(404).json({
        success: false,
        message: 'روش ارسال یافت نشد',
      })
    }

    await method.deleteOne()

    res.json({
      success: true,
      message: 'روش ارسال با موفقیت حذف شد',
    })
  } catch (error) {
    console.error('Error deleting shipping method:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در حذف روش ارسال',
      error: error.message,
    })
  }
}

