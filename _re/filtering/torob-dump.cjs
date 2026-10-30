const fs = require('node:fs')
const d = JSON.parse(fs.readFileSync('torob-search-sample.json','utf8'))
const show = (name, v) => {
  console.log(`\n=== ${name} ===`)
  if (!Array.isArray(v)) { console.log(JSON.stringify(v).slice(0,600)); return }
  console.log(`length=${v.length}`)
  v.slice(0,4).forEach((item,i) => console.log(`[${i}] ${JSON.stringify(item).slice(0,700)}`))
}
show('filters1', d.filters1)
show('filters2', d.filters2)
show('attributes', d.attributes)
show('available_filters', d.available_filters)
show('categories', d.categories)
show('parent_categories', d.parent_categories)
console.log('\nprice range:', d.min_price, '..', d.max_price, ' count=', d.count, ' category_is_leaf=', d.category_is_leaf)
