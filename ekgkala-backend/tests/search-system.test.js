/**
 * تست کامل سیستم جستجوهای محبوب
 * 
 * این فایل تمام قابلیت‌های سیستم را تست می‌کند:
 * 1. ثبت جستجوها
 * 2. دریافت محبوب‌ترین‌ها
 * 3. تنظیمات ادمین
 * 4. اتصال Frontend
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_URL || 'http://localhost:5000/api';

// رنگ‌ها برای console
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

const log = {
    success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
    info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
    warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
    section: (msg) => console.log(`\n${colors.cyan}═══ ${msg} ═══${colors.reset}\n`)
};

// شمارنده تست‌ها
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

/**
 * تست یک endpoint
 */
async function testEndpoint(name, testFn) {
    totalTests++;
    try {
        await testFn();
        passedTests++;
        log.success(name);
        return true;
    } catch (error) {
        failedTests++;
        log.error(`${name}: ${error.message}`);
        return false;
    }
}

/**
 * تست 1: Health Check
 */
async function testHealthCheck() {
    log.section('تست 1: Health Check');

    await testEndpoint('API در حال اجرا است', async () => {
        const response = await axios.get(`${API_BASE_URL.replace('/api', '')}/api/health`);
        if (response.data.success !== true) {
            throw new Error('API پاسخ نمی‌دهد');
        }
    });
}

/**
 * تست 2: ثبت جستجوها
 */
async function testSearchTracking() {
    log.section('تست 2: ثبت جستجوها (Search Tracking)');

    const testSearches = [
        'آیفون 14',
        'سامسونگ گلکسی',
        'آیفون 14',
        'لپ تاپ ایسوس',
        'آیفون 14',
        'ایرپاد پرو',
        'آیفون 14',
        'سامسونگ گلکسی',
        'پلی استیشن 5',
        'آیفون 14'
    ];

    for (const searchTerm of testSearches) {
        await testEndpoint(`ثبت جستجو: "${searchTerm}"`, async () => {
            const response = await axios.post(`${API_BASE_URL}/search/track`, {
                searchTerm
            });

            if (!response.data.success) {
                throw new Error('جستجو ثبت نشد');
            }
        });
    }

    log.info(`${testSearches.length} جستجوی تستی ثبت شد`);
}

/**
 * تست 3: دریافت محبوب‌ترین جستجوها
 */
async function testTrendingSearches() {
    log.section('تست 3: دریافت محبوب‌ترین جستجوها');

    await testEndpoint('دریافت لیست محبوب‌ترین‌ها', async () => {
        const response = await axios.get(`${API_BASE_URL}/search/trending?limit=5`);

        if (!response.data.success) {
            throw new Error('خطا در دریافت محبوب‌ترین‌ها');
        }

        if (!Array.isArray(response.data.trending)) {
            throw new Error('فرمت پاسخ اشتباه است');
        }

        log.info(`تعداد محبوب‌ترین‌ها: ${response.data.trending.length}`);

        if (response.data.trending.length > 0) {
            log.info(`محبوب‌ترین: ${response.data.trending.join(', ')}`);

            // بررسی ترتیب (آیفون 14 باید اول باشد چون 5 بار جستجو شده)
            if (response.data.trending[0] !== 'آیفون 14') {
                log.warning('ترتیب محبوبیت ممکن است اشتباه باشد');
            }
        }
    });
}

/**
 * تست 4: پیشنهادات جستجو
 */
async function testSearchSuggestions() {
    log.section('تست 4: پیشنهادات جستجو');

    await testEndpoint('دریافت پیشنهادات برای "آیفون"', async () => {
        const response = await axios.get(`${API_BASE_URL}/search/suggestions?q=آیفون&limit=5`);

        if (!response.data.success) {
            throw new Error('خطا در دریافت پیشنهادات');
        }

        if (!Array.isArray(response.data.suggestions)) {
            throw new Error('فرمت پاسخ اشتباه است');
        }

        if (response.data.suggestions.length > 0) {
            log.info(`پیشنهادات: ${response.data.suggestions.join(', ')}`);
        } else {
            log.warning('هیچ پیشنهادی یافت نشد (ممکن است محصولی با این نام نداشته باشید)');
        }
    });
}

/**
 * تست 5: تنظیمات عمومی
 */
async function testPublicSettings() {
    log.section('تست 5: تنظیمات عمومی (Public Settings)');

    await testEndpoint('دریافت تنظیمات searchSettings', async () => {
        const response = await axios.get(`${API_BASE_URL}/settings/public`);

        if (!response.data.success) {
            throw new Error('خطا در دریافت تنظیمات');
        }

        if (!response.data.settings || !response.data.settings.searchSettings) {
            throw new Error('searchSettings در پاسخ موجود نیست');
        }

        const { searchSettings } = response.data.settings;

        log.info(`Tracking Enabled: ${searchSettings.trackingEnabled}`);
        log.info(`Trending Enabled: ${searchSettings.trendingEnabled}`);
        log.info(`Trending Limit: ${searchSettings.trendingLimit}`);
        log.info(`Trending Period: ${searchSettings.trendingPeriodDays} روز`);

        if (!searchSettings.trackingEnabled) {
            log.warning('ردیابی جستجو غیرفعال است - جستجوها ثبت نمی‌شوند');
        }

        if (!searchSettings.trendingEnabled) {
            log.warning('نمایش محبوب‌ترین‌ها غیرفعال است - در frontend نمایش داده نمی‌شود');
        }
    });
}

/**
 * تست 6: خطاها و Validation
 */
async function testErrorHandling() {
    log.section('تست 6: مدیریت خطاها');

    await testEndpoint('ثبت جستجو بدون searchTerm (باید خطا دهد)', async () => {
        try {
            await axios.post(`${API_BASE_URL}/search/track`, {});
            throw new Error('باید خطا می‌داد اما نداد');
        } catch (error) {
            if (error.response && error.response.status === 400) {
                // این رفتار صحیح است
                return;
            }
            throw error;
        }
    });

    await testEndpoint('ثبت جستجو با searchTerm خالی (باید خطا دهد)', async () => {
        try {
            await axios.post(`${API_BASE_URL}/search/track`, { searchTerm: '   ' });
            throw new Error('باید خطا می‌داد اما نداد');
        } catch (error) {
            if (error.response && error.response.status === 400) {
                // این رفتار صحیح است
                return;
            }
            throw error;
        }
    });
}

/**
 * تست 7: عملکرد (Performance)
 */
async function testPerformance() {
    log.section('تست 7: عملکرد (Performance)');

    await testEndpoint('سرعت پاسخ endpoint /trending', async () => {
        const startTime = Date.now();
        await axios.get(`${API_BASE_URL}/search/trending`);
        const endTime = Date.now();
        const duration = endTime - startTime;

        log.info(`زمان پاسخ: ${duration}ms`);

        if (duration > 1000) {
            log.warning('زمان پاسخ بیش از 1 ثانیه است - نیاز به بهینه‌سازی دارد');
        }
    });

    await testEndpoint('ثبت 10 جستجو به صورت متوالی', async () => {
        const startTime = Date.now();
        const promises = [];

        for (let i = 0; i < 10; i++) {
            promises.push(
                axios.post(`${API_BASE_URL}/search/track`, {
                    searchTerm: `تست ${i}`
                })
            );
        }

        await Promise.all(promises);
        const endTime = Date.now();
        const duration = endTime - startTime;

        log.info(`زمان ثبت 10 جستجو: ${duration}ms (${(duration / 10).toFixed(2)}ms هر کدام)`);
    });
}

/**
 * اجرای همه تست‌ها
 */
async function runAllTests() {
    console.log(`\n${colors.cyan}╔═══════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.cyan}║   تست کامل سیستم جستجوهای محبوب       ║${colors.reset}`);
    console.log(`${colors.cyan}╚═══════════════════════════════════════════╝${colors.reset}\n`);

    log.info(`API URL: ${API_BASE_URL}`);

    try {
        await testHealthCheck();
        await testSearchTracking();
        await testTrendingSearches();
        await testSearchSuggestions();
        await testPublicSettings();
        await testErrorHandling();
        await testPerformance();
    } catch (error) {
        log.error(`خطای غیرمنتظره: ${error.message}`);
    }

    // خلاصه نتایج
    console.log(`\n${colors.cyan}═══════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}           خلاصه نتایج تست‌ها            ${colors.reset}`);
    console.log(`${colors.cyan}═══════════════════════════════════════════${colors.reset}\n`);

    console.log(`کل تست‌ها:      ${totalTests}`);
    console.log(`${colors.green}موفق:           ${passedTests}${colors.reset}`);
    console.log(`${colors.red}ناموفق:         ${failedTests}${colors.reset}`);
    console.log(`درصد موفقیت:    ${((passedTests / totalTests) * 100).toFixed(1)}%\n`);

    if (failedTests === 0) {
        console.log(`${colors.green}✓✓✓ همه تست‌ها با موفقیت انجام شد! ✓✓✓${colors.reset}\n`);
        process.exit(0);
    } else {
        console.log(`${colors.red}✗✗✗ برخی تست‌ها ناموفق بودند ✗✗✗${colors.reset}\n`);
        process.exit(1);
    }
}

// اجرای تست‌ها
if (require.main === module) {
    runAllTests().catch(error => {
        log.error(`خطای کلی: ${error.message}`);
        process.exit(1);
    });
}

module.exports = {
    testHealthCheck,
    testSearchTracking,
    testTrendingSearches,
    testSearchSuggestions,
    testPublicSettings,
    testErrorHandling,
    testPerformance
};
