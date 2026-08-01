"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { CreditCard, Settings as SettingsIcon } from "lucide-react";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  console.log('✅ Settings Layout Loaded - Tab System Active');

  const tabs = [
    {
      name: "تنظیمات عمومی",
      href: "/admin/settings",
      icon: SettingsIcon,
      description: "تنظیمات هوش مصنوعی و سایر موارد",
    },
    {
      name: "درگاه‌های پرداخت",
      href: "/admin/settings/payment",
      icon: CreditCard,
      description: "مدیریت ZarinPal و Sadad",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-gray-900 mb-2">تنظیمات سیستم</h1>
        <p className="text-gray-500">مدیریت تنظیمات عمومی و درگاه‌های پرداخت</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-2 overflow-x-auto pb-px">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname === tab.href;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-3 px-6 py-4 border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? "border-kala-600 text-kala-600 bg-kala-50/50 font-bold"
                    : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <Icon size={20} />
                <div className="text-right">
                  <div className={`text-sm ${isActive ? "font-bold" : "font-medium"}`}>
                    {tab.name}
                  </div>
                  <div className="text-xs text-gray-500 hidden sm:block">
                    {tab.description}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div>{children}</div>
    </div>
  );
}
