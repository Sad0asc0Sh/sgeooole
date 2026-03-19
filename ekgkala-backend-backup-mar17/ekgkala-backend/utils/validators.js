/**
 * بررسی صحت کد ملی (الگوریتم رسمی)
 * @param {string} code - کد ملی ۱۰ رقمی
 * @returns {boolean} - نتیجه اعتبارسنجی
 */
exports.isValidNationalCode = (code) => {
    if (!code || !/^\d{10}$/.test(code)) return false

    const check = parseInt(code[9])
    const sum =
        Array.from(code.substring(0, 9))
            .map((n, i) => parseInt(n) * (10 - i))
            .reduce((a, b) => a + b, 0) % 11

    return (sum < 2 && check === sum) || (sum >= 2 && check === 11 - sum)
}

/**
 * بررسی صحت شماره شبا (الگوریتم ISO 7064)
 * @param {string} sheba - شماره شبا (با یا بدون IR)
 * @returns {boolean}
 */
exports.isValidSheba = (sheba) => {
    if (!sheba || sheba.length < 26) return false
    const str = sheba.toUpperCase().replace(/^IR/, '')
    if (!/^\d{24}$/.test(str)) return false

    const newStr = str.substring(4) + '1827' + str.substring(0, 2)
    const remainder = BigInt(newStr) % 97n
    return remainder === 1n
}
