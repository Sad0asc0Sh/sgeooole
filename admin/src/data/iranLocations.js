import rawProvinces from './iran-provinces.json'
import rawCities from './iran-cities.json'

const provinceNameOverrides = {
  9: 'چهارمحال و بختیاری',
  16: 'سیستان و بلوچستان',
  23: 'کهگیلویه و بویراحمد',
}

export const normalizeIranLocationText = (value) => String(value ?? '')
  .replace(/[يى]/g, 'ی')
  .replace(/ك/g, 'ک')
  .replace(/\u200c/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLocaleLowerCase('fa-IR')

export const iranProvinces = rawProvinces
  .map((province) => ({
    id: province.id,
    name: provinceNameOverrides[province.id] || province.name,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'fa'))

const provinceById = new Map(iranProvinces.map((province) => [province.id, province]))

export const iranCities = rawCities
  .map((city) => ({
    id: city.id,
    name: city.name,
    provinceId: city.ostan,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'fa'))

export const getCitiesForProvince = (provinceName) => {
  const normalizedProvince = normalizeIranLocationText(provinceName)
  const province = iranProvinces.find(
    (item) => normalizeIranLocationText(item.name) === normalizedProvince,
  )

  if (!province) return []

  return iranCities.filter((city) => city.provinceId === province.id)
}

export const provinceOptions = iranProvinces.map((province) => ({
  label: province.name,
  value: province.name,
}))

export const cityOptionsForProvince = (provinceName) =>
  getCitiesForProvince(provinceName).map((city) => ({
    label: city.name,
    value: city.name,
  }))

export const getProvinceNameForCity = (cityName) => {
  const normalizedCity = normalizeIranLocationText(cityName)
  const city = iranCities.find((item) => normalizeIranLocationText(item.name) === normalizedCity)
  return city ? provinceById.get(city.provinceId)?.name : undefined
}
