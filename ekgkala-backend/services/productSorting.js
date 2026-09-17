const PREFIX = '__listing'
const field = (name) => `${PREFIX}.sort.${name}`
const numeric = (input) => ({ $max: [0, { $convert: { input, to: 'double', onNull: 0, onError: 0 } }] })

const ALIASES = new Map(Object.entries({
  bestseller: 'bestSelling', bestSellers: 'bestSelling', popularity: 'mostVisited',
  flash: 'discount', special: 'discount', '-createdAt': 'newest', createdAt: 'oldest',
  price: 'priceAsc', '-price': 'priceDesc', '-salesCount': 'bestSelling', '-views': 'mostVisited',
  '-rating': 'rating', '-discount': 'discount', name: 'nameAsc', '-name': 'nameDesc',
}))
const MODES = new Set(['relevance', 'newest', 'oldest', 'priceAsc', 'priceDesc', 'bestSelling', 'mostVisited', 'discount', 'rating', 'nameAsc', 'nameDesc'])

function resolveSort(raw, { search }) {
  const requested = raw || (search ? 'relevance' : 'newest')
  const mode = ALIASES.get(requested) || requested
  return mode === 'relevance' && !search ? 'newest' : mode
}

function buildSort(options, legacyFields) {
  const mode = options.sortMode
  const metric = (name) => options.skipDiscount ? name : field(name)
  const sort = {}
  switch (mode) {
    case 'relevance': sort[field('relevance')] = -1; sort.createdAt = -1; break
    case 'newest': sort.createdAt = -1; break
    case 'oldest': sort.createdAt = 1; break
    case 'priceAsc': sort[`${PREFIX}.price`] = 1; break
    case 'priceDesc': sort[`${PREFIX}.price`] = -1; break
    case 'bestSelling': sort[metric('salesCount')] = -1; break
    case 'mostVisited': sort[metric('views')] = -1; break
    case 'rating': sort[metric('rating')] = -1; sort[metric('numReviews')] = -1; break
    case 'discount': sort[metric('discount')] = -1; break
    case 'nameAsc': sort[field('name')] = 1; break
    case 'nameDesc': sort[field('name')] = -1; break
    default:
      for (const token of mode.split(/[\s,]+/)) {
        const name = token.replace(/^-/, '')
        if (!legacyFields.has(name)) continue
        sort[name === 'price' ? `${PREFIX}.price` : name] = token.startsWith('-') ? -1 : 1
      }
      if (!Object.keys(sort).length) sort.createdAt = -1
  }
  if (options.search && mode !== 'relevance') sort[field('relevance')] = -1
  if (!Object.hasOwn(sort, '_id')) sort._id = 1
  return sort
}

function sortStages(options, searchPattern) {
  const mode = options.sortMode
  const fields = {}
  if (!options.skipDiscount) {
    if (mode === 'bestSelling') fields[field('salesCount')] = numeric('$salesCount')
    if (mode === 'mostVisited') fields[field('views')] = numeric('$views')
    if (mode === 'rating') {
      fields[field('rating')] = { $min: [5, numeric('$rating')] }
      fields[field('numReviews')] = numeric('$numReviews')
    }
    if (mode === 'discount') {
      const base = `$${PREFIX}.display.compareAtPrice`
      const price = `$${PREFIX}.price`
      fields[field('discount')] = { $cond: [{ $and: [{ $gt: [base, 0] }, { $gt: [base, price] }] }, { $multiply: [100, { $divide: [{ $subtract: [base, price] }, base] }] }, 0] }
    }
  }
  if (mode === 'nameAsc' || mode === 'nameDesc') {
    fields[field('name')] = { $trim: { input: { $replaceAll: { input: { $replaceAll: { input: { $ifNull: ['$name', ''] }, find: 'ي', replacement: 'ی' } }, find: 'ك', replacement: 'ک' } } } }
  }
  if (options.search) {
    const pattern = searchPattern(options.search)
    const matches = (input, regex) => ({ $regexMatch: { input: { $ifNull: [input, ''] }, regex, options: 'i' } })
    const exactSku = { $anyElementTrue: [{ $map: { input: { $ifNull: ['$variants', []] }, as: 'variant', in: matches('$$variant.sku', `^${pattern}$`) } }] }
    fields[field('relevance')] = { $switch: { branches: [
      { case: { $or: [matches('$sku', `^${pattern}$`), exactSku] }, then: 3 },
      { case: matches('$name', `^${pattern}$`), then: 2 },
      { case: matches('$name', `^${pattern}`), then: 1 },
    ], default: 0 } }
  }
  return Object.keys(fields).length ? [{ $addFields: fields }] : []
}

module.exports = { resolveSort, buildSort, sortStages, MODES }
