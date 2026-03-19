const Address = require('../models/Address')

// ============================================
// GET /api/addresses - دریافت لیست آدرس‌های کاربر
// ============================================
exports.getUserAddresses = async (req, res) => {
  try {
    const userId = req.user._id

    const addresses = await Address.find({ user: userId })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean()

    res.json({
      success: true,
      data: addresses,
    })
  } catch (error) {
    console.error('Error fetching addresses:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت لیست آدرس‌ها',
      error: error.message,
    })
  }
}

// ============================================
// POST /api/addresses - ایجاد آدرس جدید
// ============================================
exports.createAddress = async (req, res) => {
  try {
    const userId = req.user._id
    const { recipientName, recipientPhone, province, city, address, postalCode, isDefault } = req.body

    // اعتبارسنجی
    if (!recipientName || !recipientPhone || !city || !address || !postalCode) {
      return res.status(400).json({
        success: false,
        message: 'تمام فیلدهای الزامی باید پر شوند',
      })
    }

    // بررسی کد پستی
    if (!/^\d{10}$/.test(postalCode)) {
      return res.status(400).json({
        success: false,
        message: 'کد پستی باید 10 رقم باشد',
      })
    }

    // اگر کاربر هیچ آدرسی ندارد، اولین آدرس را به عنوان پیش‌فرض قرار بده
    const addressCount = await Address.countDocuments({ user: userId })
    const shouldBeDefault = addressCount === 0 ? true : isDefault

    const newAddress = new Address({
      user: userId,
      recipientName,
      recipientPhone,
      province: province || '',
      city,
      address,
      postalCode,
      isDefault: shouldBeDefault,
    })

    const savedAddress = await newAddress.save()

    res.status(201).json({
      success: true,
      message: 'آدرس با موفقیت اضافه شد',
      data: savedAddress,
    })
  } catch (error) {
    console.error('Error creating address:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در ایجاد آدرس',
      error: error.message,
    })
  }
}

// ============================================
// PUT /api/addresses/:id - ویرایش آدرس
// ============================================
exports.updateAddress = async (req, res) => {
  try {
    const userId = req.user._id
    const addressId = req.params.id
    const { recipientName, recipientPhone, province, city, address, postalCode, isDefault } = req.body

    // پیدا کردن آدرس و بررسی مالکیت
    const existingAddress = await Address.findOne({ _id: addressId, user: userId })

    if (!existingAddress) {
      return res.status(404).json({
        success: false,
        message: 'آدرس مورد نظر یافت نشد',
      })
    }

    // به‌روزرسانی فیلدها
    if (recipientName) existingAddress.recipientName = recipientName
    if (recipientPhone) existingAddress.recipientPhone = recipientPhone
    if (province !== undefined) existingAddress.province = province
    if (city) existingAddress.city = city
    if (address) existingAddress.address = address
    if (postalCode) {
      if (!/^\d{10}$/.test(postalCode)) {
        return res.status(400).json({
          success: false,
          message: 'کد پستی باید 10 رقم باشد',
        })
      }
      existingAddress.postalCode = postalCode
    }
    if (isDefault !== undefined) existingAddress.isDefault = isDefault

    const updatedAddress = await existingAddress.save()

    res.json({
      success: true,
      message: 'آدرس با موفقیت ویرایش شد',
      data: updatedAddress,
    })
  } catch (error) {
    console.error('Error updating address:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در ویرایش آدرس',
      error: error.message,
    })
  }
}

// ============================================
// DELETE /api/addresses/:id - حذف آدرس
// ============================================
exports.deleteAddress = async (req, res) => {
  try {
    const userId = req.user._id
    const addressId = req.params.id

    const address = await Address.findOne({ _id: addressId, user: userId })

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'آدرس مورد نظر یافت نشد',
      })
    }

    await Address.deleteOne({ _id: addressId })

    // اگر آدرس پیش‌فرض حذف شد، اولین آدرس دیگر را پیش‌فرض کن
    if (address.isDefault) {
      const firstAddress = await Address.findOne({ user: userId }).sort({ createdAt: -1 })
      if (firstAddress) {
        firstAddress.isDefault = true
        await firstAddress.save()
      }
    }

    res.json({
      success: true,
      message: 'آدرس با موفقیت حذف شد',
    })
  } catch (error) {
    console.error('Error deleting address:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در حذف آدرس',
      error: error.message,
    })
  }
}

// ============================================
// PUT /api/addresses/:id/set-default - تنظیم آدرس پیش‌فرض
// ============================================
exports.setDefaultAddress = async (req, res) => {
  try {
    const userId = req.user._id
    const addressId = req.params.id

    const address = await Address.findOne({ _id: addressId, user: userId })

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'آدرس مورد نظر یافت نشد',
      })
    }

    // همه آدرس‌های دیگر را غیر پیش‌فرض کن
    await Address.updateMany({ user: userId }, { $set: { isDefault: false } })

    // این آدرس را پیش‌فرض کن
    address.isDefault = true
    await address.save()

    res.json({
      success: true,
      message: 'آدرس به عنوان پیش‌فرض انتخاب شد',
      data: address,
    })
  } catch (error) {
    console.error('Error setting default address:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در تنظیم آدرس پیش‌فرض',
      error: error.message,
    })
  }
}
