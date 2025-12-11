const Admin = require('../models/Admin')
const { cloudinary } = require('../middleware/upload')
const Joi = require('joi')

const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(3).max(50),
  email: Joi.string().trim().email(),
  password: Joi.string().min(8).max(128),
  nationalCode: Joi.string().trim().max(20),
  birthDate: Joi.string().isoDate(),
  landline: Joi.string().trim().max(30),
  shebaNumber: Joi.string().trim().max(40),
  province: Joi.string().trim().max(100),
  city: Joi.string().trim().max(100),
  isLegal: Joi.boolean(),
  companyName: Joi.string().trim().max(150),
  companyNationalId: Joi.string().trim().max(50),
  companyRegistrationId: Joi.string().trim().max(50),
  companyLandline: Joi.string().trim().max(30),
  companyProvince: Joi.string().trim().max(100),
  companyCity: Joi.string().trim().max(100),
}).unknown(false)

/**
 * @desc    O"UØƒ?OOñU^OýOñO3OU+UO OOúU,OO1OO¦ U_OñU^U?OUOU, UcOOñO"Oñ (U+OU.OO OUOU.UOU,OO OñU.Oý O1O"U^Oñ)
 * @route   PUT /api/auth/me/update
 * @access  Private
 */
exports.updateMyProfile = async (req, res) => {
  try {
    const { error, value } = updateProfileSchema.validate(req.body, { abortEarly: false })
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      })
    }
    req.body = value

    const { name, email, password } = req.body

    // U_UOO_O UcOñO_U+ UcOOñO"Oñ U?O1U,UO
    const user = await Admin.findById(req.user.id).select('+password')

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'UcOOñO"Oñ UOOU?O¦ U+O\'O_',
      })
    }

    // O"UØƒ?OOñU^OýOñO3OU+UO U?UOU,O_UØO
    if (name) user.name = name
    if (email) user.email = email

    // Personal Info & Sabt Ahval Check
    // Check if identity fields are being modified
    if (req.body.nationalCode !== undefined || req.body.birthDate !== undefined) {
      const finalNationalCode = req.body.nationalCode !== undefined ? req.body.nationalCode : user.nationalCode
      const finalBirthDate = req.body.birthDate !== undefined ? req.body.birthDate : user.birthDate

      // If there is a National Code (and it's not being cleared)
      if (finalNationalCode && finalNationalCode.length > 0) {
        // 1. Enforce Birth Date presence
        if (!finalBirthDate) {
          return res.status(400).json({
            success: false,
            message: 'O"OñOUO O®O"O¦ U^ O¦OUOUOO_ UcO_ U.U,UOOO U^OOñO_ UcOñO_U+ O¦OOñUOOr O¦U^U,O_ OU,OýOU.UO OO3O¦',
          })
        }

        // 2. Validate the Pair via Sabt Ahval Service
        const sabtAhvalService = require('../services/sabtAhvalService')
        const inquiry = await sabtAhvalService.inquiryIdentity(finalNationalCode, finalBirthDate)

        if (!inquiry.isValid) {
          return res.status(400).json({
            success: false,
            message: `OrOúOUO OO-OñOOý UØU^UOO¦: ${inquiry.message}`,
          })
        }
      }
    }

    if (req.body.nationalCode !== undefined) user.nationalCode = req.body.nationalCode
    if (req.body.birthDate !== undefined) user.birthDate = req.body.birthDate
    if (req.body.landline !== undefined) user.landline = req.body.landline
    if (req.body.shebaNumber !== undefined) {
      const { isValidSheba } = require('../utils/validators')
      if (req.body.shebaNumber && !isValidSheba(req.body.shebaNumber)) {
        return res.status(400).json({
          success: false,
          message: 'O\'U.OOñUØ O\'O"O U+OU.O1O¦O"Oñ OO3O¦',
        })
      }
      user.shebaNumber = req.body.shebaNumber
    }
    if (req.body.province !== undefined) user.province = req.body.province
    if (req.body.city !== undefined) user.city = req.body.city

    // Legal Info
    if (req.body.isLegal !== undefined) user.isLegal = req.body.isLegal
    if (req.body.companyName !== undefined) user.companyName = req.body.companyName
    if (req.body.companyNationalId !== undefined) user.companyNationalId = req.body.companyNationalId
    if (req.body.companyRegistrationId !== undefined) user.companyRegistrationId = req.body.companyRegistrationId
    if (req.body.companyLandline !== undefined) user.companyLandline = req.body.companyLandline
    if (req.body.companyProvince !== undefined) user.companyProvince = req.body.companyProvince
    if (req.body.companyCity !== undefined) user.companyCity = req.body.companyCity

    // OU_Oñ OñU.Oý O1O"U^Oñ OªO_UOO_ OOñO3OU, O'O_UØOO O›U+ OñO UØO' UcU+
    if (password && password.trim() !== '') {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'OñU.Oý O1O"U^Oñ O"OUOO_ O-O_OU,U, U UcOOñOUcO¦Oñ O"OO\'O_',
        })
      }
      user.password = password
    }

    await user.save()

    // O-OøU? password OOý OrOñU^OªUO
    const userResponse = user.toJSON()

    res.status(200).json({
      success: true,
      message: 'U_OñU^U?OUOU, O"O U.U^U?U,UOO¦ O"UØƒ?OOñU^OýOñO3OU+UO O\'O_',
      data: userResponse,
    })
  } catch (error) {
    console.error('Error updating profile:', error)
    res.status(500).json({
      success: false,
      message: 'OrOúO O_Oñ O"UØƒ?OOñU^OýOñO3OU+UO U_OñU^U?OUOU,',
      error: error.message,
    })
  }
}

/**
 * @desc    O"UØƒ?OOñU^OýOñO3OU+UO O›U^OO¦OOñ UcOOñO"Oñ
 * @route   PUT /api/auth/me/avatar
 * @access  Private
 */
exports.updateMyAvatar = async (req, res) => {
  try {
    // O"OñOñO3UO U^OªU^O_ U?OUOU, O›U_U,U^O_ O\'O_UØ
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'U,OúU?OU< UOUc O¦OæU^UOOñ O›U^OO¦OOñ O›U_U,U^O_ UcU+UOO_',
      })
    }

    // U_UOO_O UcOñO_U+ UcOOñO"Oñ U?O1U,UO
    const user = await Admin.findById(req.user.id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'UcOOñO"Oñ UOOU?O¦ U+O\'O_',
      })
    }

    // O-OøU? O›U^OO¦OOñ U,O_UOU.UO OOý Cloudinary (OU_Oñ U^OªU^O_ O_OO\'O¦UØ O"OO\'O_)
    if (user.avatar && user.avatar.public_id) {
      try {
        await cloudinary.uploader.destroy(user.avatar.public_id)
        console.log('Old avatar deleted from Cloudinary:', user.avatar.public_id)
      } catch (error) {
        console.error('Error deleting old avatar from Cloudinary:', error)
        // OO_OU.UØ U.UOƒ?OO_UØUOU. O-O¦UO OU_Oñ O-OøU? O¦OæU^UOOñ U,O_UOU.UO U+OU.U^U?U, O"OO\'O_
      }
    }

    // OøOrUOOñUØ O›U^OO¦OOñ OªO_UOO_
    user.avatar = {
      url: req.file.path,
      public_id: req.file.filename,
    }

    await user.save()

    res.status(200).json({
      success: true,
      message: 'O›U^OO¦OOñ O"O U.U^U?U,UOO¦ O"UØƒ?OOñU^OýOñO3OU+UO O\'O_',
      data: user.toJSON(),
    })
  } catch (error) {
    console.error('Error updating avatar:', error)
    res.status(500).json({
      success: false,
      message: 'OrOúO O_Oñ O"UØƒ?OOñU^OýOñO3OU+UO O›U^OO¦OOñ',
      error: error.message,
    })
  }
}
