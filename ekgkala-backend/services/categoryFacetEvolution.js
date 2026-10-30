/**
 * ============================================================
 * Category Facet Evolution  (Commit 48.3)
 * ============================================================
 * هدف: عناوین فیلترینگ هر دسته‌بندی به‌طور خودکار و زنده با داده‌ی واقعی
 * محصولات هم‌راستا شوند تا ادمین مجبور نباشد دکمه‌ی «کشف مشخصات» بزند.
 *
 * دو تابع:
 *  - `loadCategoryRulesWithAncestors`: قواعد خود دسته + والدها (با $graphLookup)
 *  - `autoEvolveCategoryFacets`: افزودن/به‌روزرسانی properties دسته از ویژگی‌های
 *    باکت‌شده‌ی یک محصول
 * ============================================================
 */

const mongoose = require('mongoose')
const { mergeCategoryRules } = require('./listingFacets')
const { normCompareKey, isCoreIdentityKey, isNonFilterableKey, CORE_IDENTITY_LABELS } = require('./specNormalization')

const MAX_CATEGORY_FACETS = 24
const MAX_OPTIONS_PER_FACET = 60
const MAX_PINNED_FACETS = 4

// جایگاه هر ویژگی هویتی در سایدبار (۱ تا ۱۷)
const CORE_ORDER = new Map(CORE_IDENTITY_LABELS.map((label, index) => [normCompareKey(label), index + 1]))

/**
 * قواعد دسته با ارث‌بری از والدها (بدون زیرشاخه‌ها).
 * نزدیک‌ترین سطح (خود دسته) اول ادغام می‌شود تا unit/order آن برنده باشد.
 */
async function loadCategoryRulesWithAncestors(CategoryModel, categoryId) {
  if (!categoryId) return []
  try {
    const rows = await CategoryModel.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(String(categoryId)) } },
      {
        $graphLookup: {
          from: CategoryModel.collection.name,
          startWith: '$parent',
          connectFromField: 'parent',
          connectToField: '_id',
          as: 'ancestors',
          maxDepth: 10,
        },
      },
      { $project: { self: '$properties', ancestors: '$ancestors.properties' } },
    ])
    const row = rows[0]
    if (!row) return []
    return mergeCategoryRules([
      { properties: row.self || [] },
      ...(row.ancestors || []).map((properties) => ({ properties })),
    ])
  } catch {
    return []
  }
}

/**
 * همگام‌سازی خودکار فست‌های یک دسته با ویژگی‌های باکت‌شده‌ی محصول.
 *
 * @param {object} CategoryModel مدل Mongoose دسته‌بندی
 * @param {string|object} categoryId شناسه‌ی دسته
 * @param {Array<{label:string, normValue?:string, value?:string}>} properties
 * @returns {Promise<{changed:boolean, added:number, optionsAdded:number}>}
 */
async function autoEvolveCategoryFacets(CategoryModel, categoryId, properties = []) {
  const result = { changed: false, added: 0, optionsAdded: 0 }
  if (!categoryId || !Array.isArray(properties) || properties.length === 0) return result

  let category
  try {
    category = await CategoryModel.findById(categoryId)
  } catch {
    return result
  }
  if (!category) return result

  const props = Array.isArray(category.properties) ? category.properties : []
  const byKey = new Map()
  for (const prop of props) {
    if (!prop || !prop.name) continue
    byKey.set(normCompareKey(prop.name), prop)
    for (const alias of Array.isArray(prop.aliases) ? prop.aliases : []) {
      byKey.set(normCompareKey(alias), prop)
    }
  }

  let nextOrder = props.reduce((max, prop) => Math.max(max, Number(prop.order) || 0), 0) + 1

  for (const item of properties) {
    if (!item || !item.label) continue
    const label = String(item.label).trim()
    const value = String(item.normValue ?? item.bucket ?? item.value ?? '').trim()
    if (!label || !value) continue

    const key = normCompareKey(label)
    const existing = byKey.get(key)

    // (الف) ویژگی موجود است
    if (existing) {
      // تصمیم صریح ادمین محترم است
      if (existing.isFilterable === false) continue
      const options = Array.isArray(existing.options) ? existing.options : []
      if (!options.includes(value) && options.length < MAX_OPTIONS_PER_FACET) {
        existing.options.push(value)
        result.changed = true
        result.optionsAdded += 1
      }
      continue
    }

    // (ب) ویژگی جدید
    // کلیدهای صرفاً جدولی (مدت ضبط پیام، گارانتی، ابعاد …) هرگز به‌صورت
    // خودکار به سایدبار اضافه نمی‌شوند — مگر ادمین خودش تعریف کرده باشد که
    // در آن صورت در شاخه‌ی (الف) بالاتر مدیریت شده‌اند.
    if (isNonFilterableKey(label)) continue
    if (props.length >= MAX_CATEGORY_FACETS) continue

    const isCore = isCoreIdentityKey(label)
    const pinnedCount = props.filter((prop) => prop.isPinned === true).length
    const isPinned = isCore && pinnedCount < MAX_PINNED_FACETS
    // ویژگی‌های هویتی ترتیب ثابت (۱..۱۷) دارند؛ بقیه ترتیب افزایشی
    const coreOrder = CORE_ORDER.get(normCompareKey(label))
    const order = coreOrder !== undefined ? coreOrder : nextOrder++

    const created = {
      name: label,
      type: 'select',
      options: [value],
      isFilterable: true,
      isPinned,
      unit: '',
      order,
      aliases: [],
      valueAliases: {},
    }
    props.push(created)
    byKey.set(key, created)
    result.changed = true
    result.added += 1
  }

  if (result.changed) {
    try {
      await category.save()
      // کش دسته/محصول باید فوراً باطل شود تا سایدبار زنده دیده شود
      const { clearCacheByPrefix } = require('../middleware/cache')
      clearCacheByPrefix('/api/categories')
      clearCacheByPrefix('/api/products')
      clearCacheByPrefix('/api/v1/admin/products')
    } catch (error) {
      // خطای همگام‌سازی هرگز نباید ذخیره‌ی محصول را بشکند
      console.error('[AUTO-EVOLVE] category facet sync failed:', error.message)
      return { ...result, changed: false }
    }
  }

  return result
}

module.exports = {
  autoEvolveCategoryFacets,
  loadCategoryRulesWithAncestors,
  MAX_CATEGORY_FACETS,
  MAX_OPTIONS_PER_FACET,
  MAX_PINNED_FACETS,
}
