import Link from "next/link";
import { Send, Instagram, Video } from "lucide-react"; // Using Video as generic for Aparat

export default function Footer() {
    return (
        <footer className="w-full !h-auto !min-h-0 !overflow-visible bg-[#142755] pt-10 pb-24 border-t border-transparent rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.2)] mt-4 touch-auto">
            <div className="mobile-container grid gap-8 !h-auto !overflow-visible">

                {/* Quick Access */}
                <div className="space-y-4">
                    <h3 className="font-bold text-white">دسترسی سریع</h3>
                    <ul className="space-y-2 text-sm text-gray-300">
                        <li><Link href="/products">محصولات</Link></li>
                        <li><Link href="/smart-assembly">اسمبل هوشمند</Link></li>
                        <li><Link href="/about">درباره ما</Link></li>
                        <li><Link href="/contact">تماس با ما</Link></li>
                    </ul>
                </div>

                {/* Customer Service */}
                <div className="space-y-4">
                    <h3 className="font-bold text-white">خدمات مشتریان</h3>
                    <ul className="space-y-2 text-sm text-gray-300">
                        <li><Link href="/tracking">پیگیری سفارش</Link></li>
                        <li><Link href="/terms">قوانین و مقررات</Link></li>
                        <li><Link href="/faq">سوالات متداول</Link></li>
                        <li><Link href="/returns">رویه بازگرداندن کالا</Link></li>
                    </ul>
                </div>

                {/* Newsletter */}
                <div className="space-y-4">
                    <h3 className="font-bold text-white">خبرنامه</h3>
                    <div className="flex gap-2">
                        <input
                            type="email"
                            placeholder="ایمیل خود را وارد کنید"
                            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-gray-400 focus:border-vita-500 focus:outline-none"
                        />
                        <button className="rounded-lg bg-vita-500 px-4 py-2 text-white hover:bg-vita-600">
                            عضویت
                        </button>
                    </div>
                </div>

                {/* Socials & Trust Badge */}
                <div className="flex flex-col gap-6">
                    <div className="flex gap-4">
                        <a href="#" className="rounded-full bg-white p-2 text-[#142755] shadow-sm transition-transform hover:scale-110 hover:text-vita-500">
                            <Send size={20} />
                        </a>
                        <a href="#" className="rounded-full bg-white p-2 text-[#142755] shadow-sm transition-transform hover:scale-110 hover:text-vita-500">
                            <Instagram size={20} />
                        </a>
                        <a href="#" className="rounded-full bg-white p-2 text-[#142755] shadow-sm transition-transform hover:scale-110 hover:text-vita-500">
                            <Video size={20} />
                        </a>
                    </div>

                    {/* Trust Badge Placeholder */}
                    <div className="h-24 w-24 rounded-lg bg-white border border-welf-200 flex items-center justify-center text-xs text-gray-400">
                        نماد اعتماد
                    </div>
                </div>

                <div className="text-center text-xs text-gray-400 mt-4">
                    ۱۴۰۴-۱۳۹۶ تمامی حقوق برای ویلف‌ویتا محفوظ است.
                </div>
            </div>
        </footer>
    );
}
