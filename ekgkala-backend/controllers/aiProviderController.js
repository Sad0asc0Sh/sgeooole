const AiProvider = require('../models/AiProvider')
const axios = require('axios')
const dnsAgent = require('../utils/dnsAgent')
const { getProviderRuntimeHealth } = require('../utils/groqService')

exports.getRuntimeHealth = async (req, res) => {
  res.json({ success: true, data: getProviderRuntimeHealth() })
}

exports.getAll = async (req, res) => {
  try {
    const providers = await AiProvider.find().sort({ isDefault: -1, priority: 1, createdAt: 1 })
    res.json({ success: true, data: providers })
  } catch (error) {
    console.error('Error fetching AI providers:', error)
    res.status(500).json({ success: false, message: 'خطا در دریافت لیست ارائه‌دهندگان' })
  }
}

exports.getById = async (req, res) => {
  try {
    const provider = await AiProvider.findById(req.params.id)
    if (!provider) {
      return res.status(404).json({ success: false, message: 'ارائه‌دهنده یافت نشد' })
    }
    res.json({ success: true, data: provider })
  } catch (error) {
    console.error('Error fetching AI provider:', error)
    res.status(500).json({ success: false, message: 'خطا در دریافت اطلاعات ارائه‌دهنده' })
  }
}

exports.create = async (req, res) => {
  try {
    const { name, baseUrl, apiKey, model, isActive, isDefault, priority, maxTokens, temperature, description, headers } = req.body
    const provider = new AiProvider({
      name, baseUrl, apiKey, model,
      isActive: isActive !== undefined ? isActive : true,
      isDefault: isDefault || false,
      priority: priority || 100,
      maxTokens: maxTokens || 500,
      temperature: temperature !== undefined ? temperature : 0.7,
      description: description || '',
      headers: headers || {},
    })
    await provider.save()
    const result = provider.toObject()
    delete result.apiKey
    res.status(201).json({ success: true, data: result, message: 'ارائه‌دهنده با موفقیت ایجاد شد' })
  } catch (error) {
    console.error('Error creating AI provider:', error)
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message).join(', ')
      return res.status(400).json({ success: false, message: messages })
    }
    res.status(500).json({ success: false, message: 'خطا در ایجاد ارائه‌دهنده' })
  }
}

exports.update = async (req, res) => {
  try {
    const provider = await AiProvider.findById(req.params.id).select('+apiKey')
    if (!provider) {
      return res.status(404).json({ success: false, message: 'ارائه‌دهنده یافت نشد' })
    }
    const { name, baseUrl, apiKey, model, isActive, isDefault, priority, maxTokens, temperature, description, headers } = req.body
    if (name !== undefined) provider.name = name
    if (baseUrl !== undefined) provider.baseUrl = baseUrl
    if (apiKey && apiKey !== '****') provider.apiKey = apiKey
    if (model !== undefined) provider.model = model
    if (isActive !== undefined) provider.isActive = isActive
    if (isDefault !== undefined) provider.isDefault = isDefault
    if (priority !== undefined) provider.priority = priority
    if (maxTokens !== undefined) provider.maxTokens = maxTokens
    if (temperature !== undefined) provider.temperature = temperature
    if (description !== undefined) provider.description = description
    if (headers !== undefined) provider.headers = headers
    await provider.save()
    const result = provider.toObject()
    delete result.apiKey
    res.json({ success: true, data: result, message: 'ارائه‌دهنده با موفقیت به‌روزرسانی شد' })
  } catch (error) {
    console.error('Error updating AI provider:', error)
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message).join(', ')
      return res.status(400).json({ success: false, message: messages })
    }
    res.status(500).json({ success: false, message: 'خطا در به‌روزرسانی ارائه‌دهنده' })
  }
}

exports.remove = async (req, res) => {
  try {
    const provider = await AiProvider.findById(req.params.id)
    if (!provider) {
      return res.status(404).json({ success: false, message: 'ارائه‌دهنده یافت نشد' })
    }
    if (provider.isDefault) {
      return res.status(400).json({ success: false, message: 'امکان حذف ارائه‌دهنده پیش‌فرض وجود ندارد. ابتدا ارائه‌دهنده دیگری را به عنوان پیش‌فرض تنظیم کنید.' })
    }
    await AiProvider.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'ارائه‌دهنده با موفقیت حذف شد' })
  } catch (error) {
    console.error('Error deleting AI provider:', error)
    res.status(500).json({ success: false, message: 'خطا در حذف ارائه‌دهنده' })
  }
}

exports.setDefault = async (req, res) => {
  try {
    const provider = await AiProvider.findById(req.params.id)
    if (!provider) {
      return res.status(404).json({ success: false, message: 'ارائه‌دهنده یافت نشد' })
    }
    if (!provider.isActive) {
      return res.status(400).json({ success: false, message: 'ارائه‌دهنده غیرفعال نمی‌تواند پیش‌فرض باشد' })
    }
    provider.isDefault = true
    await provider.save()
    res.json({ success: true, message: `"${provider.name}" به عنوان ارائه‌دهنده پیش‌فرض تنظیم شد` })
  } catch (error) {
    console.error('Error setting default AI provider:', error)
    res.status(500).json({ success: false, message: 'خطا در تنظیم ارائه‌دهنده پیش‌فرض' })
  }
}

exports.testConnection = async (req, res) => {
  try {
    let baseUrl, apiKey, model, headers
    if (req.params.id) {
      const provider = await AiProvider.findById(req.params.id).select('+apiKey')
      if (!provider) {
        return res.status(404).json({ success: false, message: 'ارائه‌دهنده یافت نشد' })
      }
      baseUrl = provider.baseUrl
      apiKey = provider.apiKey
      model = provider.model
      headers = provider.headers ? Object.fromEntries(provider.headers) : {}
    } else {
      baseUrl = req.body.baseUrl
      apiKey = req.body.apiKey
      model = req.body.model
      headers = req.body.headers || {}
    }
    if (!baseUrl || !apiKey || !model) {
      return res.status(400).json({ success: false, message: 'آدرس پایه، کلید API و مدل الزامی هستند' })
    }
    const url = baseUrl.replace(/\/$/, '') + '/chat/completions'
    const response = await axios.post(
      url,
      {
        model,
        messages: [{ role: 'user', content: 'سلام' }],
        // ۱۰ توکن برای مدل‌های استدلالی کافی نیست و تست را گمراه‌کننده می‌کرد؛
        // مدل اول «فکر» می‌کند و با سقف خیلی کم، متن نهایی اصلاً تولید نمی‌شود.
        max_tokens: 512,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...headers,
        },
        timeout: 15000,
        httpsAgent: dnsAgent,
      }
    )
    if (response.data?.choices?.[0]) {
      // موفقیت واقعی یعنی متن نهاییِ غیرخالی؛ وجود choice به‌تنهایی کافی نیست —
      // دقیقاً همین حالت (۲۰۰ با content خالی) چت‌بات را با خطای «پاسخ خالی» از کار می‌انداخت
      // درحالی‌که تست اتصال سبز نشان داده می‌شد.
      const rawContent = response.data.choices[0].message?.content
      const replyText = (typeof rawContent === 'string'
        ? rawContent
        : Array.isArray(rawContent)
          ? rawContent.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('')
          : '').trim()
      if (!replyText) {
        throw new Error('مدل پاسخ خالی برگرداند؛ اتصال برقرار است اما متن نهایی تولید نشد (برای مدل‌های استدلالی سقف توکن خروجی ارائه‌دهنده را بالاتر ببرید یا مدل را عوض کنید).')
      }
      if (req.params.id) {
        await AiProvider.findByIdAndUpdate(req.params.id, {
          lastTestedAt: new Date(),
          lastTestResult: 'success',
        })
      }
      return res.json({ success: true, message: 'اتصال موفق! مدل پاسخ داد.', data: { reply: replyText } })
    }
    throw new Error('پاسخ نامعتبر از API')
  } catch (error) {
    if (req.params?.id) {
      await AiProvider.findByIdAndUpdate(req.params.id, {
        lastTestedAt: new Date(),
        lastTestResult: 'failure',
      }).catch(() => {})
    }
    const errMsg = error.response?.data?.error?.message || error.response?.data?.message || error.message
    console.error('AI provider test failed:', errMsg)
    res.status(400).json({ success: false, message: `تست اتصال ناموفق: ${errMsg}` })
  }
}
