const axios = require('axios')
const readline = require('readline')

// رنگ‌ها برای خروجی
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
}

const log = {
    info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
    success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
    warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
    title: (msg) => console.log(`\n${colors.magenta}${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}${colors.reset}`),
}

// ایجاد interface برای ورودی کاربر
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
})

const question = (prompt) => {
    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            resolve(answer)
        })
    })
}

const testSMS = async () => {
    log.title('🔍 تست مستقل ارسال پیامک ملی‌پیامک')
    log.warning('این اسکریپت بدون نیاز به دیتابیس کار می‌کند')

    console.log('\nلطفا اطلاعات زیر را از پنل ملی‌پیامک خود وارد کنید:')
    console.log('(پنل: https://panel.payamak-panel.com)\n')

    try {
        // دریافت اطلاعات از کاربر
        const smsUsername = await question('👤 نام کاربری پنل: ')
        const smsPassword = await question('🔑 رمز عبور پنل: ')
        const smsSenderNumber = await question('📱 شماره فرستنده (اختیاری): ')
        const testMobile = await question('📞 شماره موبایل تست (مثلا 09123456789): ')

        if (!smsUsername || !smsPassword) {
            log.error('نام کاربری یا رمز عبور وارد نشده است!')
            rl.close()
            process.exit(1)
        }

        if (!testMobile || testMobile.length !== 11) {
            log.error('شماره موبایل معتبر نیست! (باید 11 رقم باشد)')
            rl.close()
            process.exit(1)
        }

        log.title('مرحله 1️⃣: بررسی اطلاعات وارد شده')
        log.info(`نام کاربری: ${smsUsername}`)
        log.info(`رمز عبور: ${'*'.repeat(smsPassword.length)}`)
        log.info(`شماره فرستنده: ${smsSenderNumber || smsUsername}`)
        log.info(`شماره تست: ${testMobile}`)

        // ایجاد کد تست
        const testCode = Math.floor(100000 + Math.random() * 900000).toString()
        const testMessage = `کد تایید شما: ${testCode}\nای‌کا‌جی کالا\nلغو11`

        log.title('مرحله 2️⃣: تست ارسال پیامک')

        // تست با REST API
        log.info('📤 در حال ارسال پیامک از طریق REST API ملی‌پیامک...\n')

        const payload = {
            username: smsUsername.trim(),
            password: smsPassword.trim(),
            to: testMobile.trim(),
            from: smsSenderNumber.trim() || smsUsername.trim(),
            text: testMessage,
            isflash: false,
        }

        log.info('اطلاعات ارسالی:')
        console.log(JSON.stringify({
            ...payload,
            password: '***',
        }, null, 2))

        try {
            const response = await axios.post(
                'https://rest.payamak-panel.com/api/SendSMS/SendSMS',
                payload,
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 20000,
                }
            )

            log.info('\nپاسخ سرور:')
            console.log(JSON.stringify(response.data, null, 2))

            log.title('📊 نتیجه')

            if (response.data.RetStatus === 1) {
                log.success('🎉🎉🎉 پیامک با موفقیت ارسال شد! 🎉🎉🎉')
                log.success(`\nپیامک باید به شماره ${testMobile} ارسال شده باشد`)
                log.success(`محتوای پیامک: ${testMessage}`)
                log.info(`\nشناسه پیامک: ${response.data.Value}`)

                console.log('\n' + colors.green + '✅ سیستم ارسال پیامک کاملا سالم است!' + colors.reset)
                console.log(colors.cyan + '\n💡 نکته: اطلاعاتی که وارد کردید را در پنل ادمین سایت خود وارد کنید:' + colors.reset)
                console.log(colors.cyan + '   - نام کاربری: ' + smsUsername + colors.reset)
                console.log(colors.cyan + '   - رمز عبور: (همان که وارد کردید)' + colors.reset)
                console.log(colors.cyan + '   - شماره فرستنده: ' + (smsSenderNumber || smsUsername) + colors.reset)

            } else {
                log.error('❌ خطا در ارسال پیامک!')
                log.error(`کد خطا: ${response.data.RetStatus}`)
                log.error(`پیام خطا: ${response.data.StrRetStatus}`)

                // راهنمای رفع خطاهای رایج
                log.title('🔧 راهنمای رفع خطا')

                if (response.data.RetStatus === 35) {
                    log.warning('خطای 35 = اطلاعات نامعتبر (InvalidData)')
                    log.warning('احتمالات:')
                    log.warning('  1. نام کاربری یا رمز عبور اشتباه است')
                    log.warning('  2. شماره فرستنده معتبر نیست')
                    log.warning('  3. فرمت شماره موبایل اشتباه است (باید 09xxxxxxxxx باشد)')
                } else if (response.data.RetStatus === 6) {
                    log.warning('خطای 6 = عدم دسترسی')
                    log.warning('احتمالات:')
                    log.warning('  1. حساب کاربری غیرفعال است')
                    log.warning('  2. محدودیت IP وجود دارد')
                } else if (response.data.RetStatus === 9) {
                    log.warning('خطای 9 = اعتبار کافی نیست')
                    log.warning('حساب شما اعتبار کافی ندارد. لطفا شارژ کنید.')
                }

                log.warning('\n📌 برای دیدن لیست کامل خطاها:')
                log.warning('   https://docs.melipayamak.com/api/error-codes')
            }

        } catch (error) {
            log.error('❌ خطای شبکه یا سرور!')

            if (error.response) {
                log.error(`وضعیت HTTP: ${error.response.status}`)
                log.error('پاسخ سرور:')
                console.log(JSON.stringify(error.response.data, null, 2))
            } else if (error.request) {
                log.error('درخواست ارسال شد اما پاسخی دریافت نشد')
                log.error('احتمالا مشکل از اتصال اینترنت یا فایروال است')
            } else {
                log.error(`خطا: ${error.message}`)
            }

            log.title('🔧 راهنمای رفع مشکل')
            log.warning('1. اتصال اینترنت خود را چک کنید')
            log.warning('2. فایروال یا VPN خود را غیرفعال کنید')
            log.warning('3. اطمینان حاصل کنید سایت ملی‌پیامک در دسترس است')
            log.warning('4. با پشتیبانی ملی‌پیامک تماس بگیرید: 02191004346')
        }

    } catch (error) {
        log.error(`خطای غیرمنتظره: ${error.message}`)
        console.error(error)
    } finally {
        rl.close()
    }
}

// اجرای تست
testSMS()
