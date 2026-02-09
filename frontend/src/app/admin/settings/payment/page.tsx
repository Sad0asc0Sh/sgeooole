"use client";
import { useState, useEffect } from "react";
import api from "@/lib/api";
import { CreditCard, Save, AlertCircle, CheckCircle, Eye, EyeOff, Layers, ShieldCheck } from "lucide-react";

export default function PaymentSettings() {
  console.log('🚀 NEW Payment Settings Page Loaded - Multi-Gateway System');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState({
    zarinpalMerchant: false,
    sadadMerchant: false,
    sadadTerminal: false,
    sadadKey: false,
  });
  const [settings, setSettings] = useState<any>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get("/settings");
      setSettings(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveSuccess(false);

      // Validate based on active gateway
      const activeGateway = settings?.paymentConfig?.activeGateway || 'zarinpal';

      if (activeGateway === 'zarinpal') {
        const merchantId = settings?.paymentConfig?.zarinpal?.merchantId;
        if (merchantId && merchantId !== '****' && merchantId.length !== 36) {
          alert("مرچنت کد زرین‌پال باید 36 کاراکتر باشد");
          return;
        }
      } else if (activeGateway === 'sadad') {
        const { merchantId, terminalId, terminalKey } = settings?.paymentConfig?.sadad || {};
        if (!merchantId || merchantId === '****') {
          alert("لطفاً Merchant ID سداد را وارد کنید");
          return;
        }
        if (!terminalId || terminalId === '****') {
          alert("لطفاً Terminal ID سداد را وارد کنید");
          return;
        }
        if (!terminalKey || terminalKey === '****') {
          alert("لطفاً Terminal Key سداد را وارد کنید");
          return;
        }
      }

      await api.put("/settings", {
        paymentConfig: settings.paymentConfig
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      // Reload settings to get masked values
      fetchSettings();
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.message || "خطا در ذخیره تنظیمات");
    } finally {
      setSaving(false);
    }
  };

  const updatePaymentConfig = (path: string[], value: any) => {
    setSettings((prev: any) => {
      const newSettings = { ...prev };
      let current = newSettings.paymentConfig;

      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }

      current[path[path.length - 1]] = value;
      return newSettings;
    });
  };

  const toggleSecret = (field: string) => {
    setShowSecrets((prev) => ({
      ...prev,
      [field]: !prev[field as keyof typeof prev],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-kala-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <AlertCircle size={48} className="mb-4 text-red-500" />
        <p>خطا در دریافت تنظیمات</p>
        <button onClick={fetchSettings} className="mt-4 text-kala-600 hover:underline">
          تلاش مجدد
        </button>
      </div>
    );
  }

  const activeGateway = settings?.paymentConfig?.activeGateway || 'zarinpal';
  const zarinpal = settings?.paymentConfig?.zarinpal || {};
  const sadad = settings?.paymentConfig?.sadad || {};

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* NEW VERSION INDICATOR */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-4 rounded-xl shadow-lg border-2 border-green-400">
        <div className="flex items-center gap-3">
          <CheckCircle size={24} />
          <div>
            <p className="font-bold">✅ سیستم جدید درگاه‌های پرداخت چندگانه فعال است</p>
            <p className="text-sm text-green-100">پشتیبانی از ZarinPal و Sadad با امکان تعویض آسان</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-800">مدیریت درگاه‌های پرداخت</h1>
          <p className="text-sm text-gray-500 mt-1">پیکربندی ZarinPal و Sadad</p>
        </div>
      </div>

      {/* Active Gateway Selector */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl shadow-sm border border-blue-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
            <Layers size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">انتخاب درگاه فعال</h2>
            <p className="text-xs text-gray-600">درگاهی که برای پرداخت‌های جدید استفاده می‌شود</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ZarinPal Option */}
          <label
            className={`cursor-pointer border-2 rounded-xl p-5 flex items-center gap-4 transition-all ${activeGateway === 'zarinpal'
                ? 'border-yellow-500 bg-yellow-50 shadow-md'
                : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
          >
            <input
              type="radio"
              name="gateway"
              value="zarinpal"
              checked={activeGateway === 'zarinpal'}
              onChange={() => updatePaymentConfig(['activeGateway'], 'zarinpal')}
              className="w-5 h-5 accent-yellow-600"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-gray-800">زرین‌پال</span>
                {zarinpal.isActive && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    فعال
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">پرداخت آنلاین با کارت‌های بانکی</p>
            </div>
          </label>

          {/* Sadad Option */}
          <label
            className={`cursor-pointer border-2 rounded-xl p-5 flex items-center gap-4 transition-all ${activeGateway === 'sadad'
                ? 'border-blue-500 bg-blue-50 shadow-md'
                : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
          >
            <input
              type="radio"
              name="gateway"
              value="sadad"
              checked={activeGateway === 'sadad'}
              onChange={() => updatePaymentConfig(['activeGateway'], 'sadad')}
              className="w-5 h-5 accent-blue-600"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-gray-800">سداد (ملی)</span>
                {sadad.isActive && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    فعال
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">درگاه بانک ملی ایران</p>
            </div>
          </label>
        </div>
      </div>

      {/* Gateway Configurations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ZarinPal Configuration */}
        <div
          className={`bg-white rounded-2xl shadow-sm border transition-all ${activeGateway === 'zarinpal' ? 'border-yellow-500 ring-2 ring-yellow-100' : 'border-gray-200'
            }`}
        >
          <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white p-5 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 className="font-bold">تنظیمات زرین‌پال</h3>
                  <p className="text-xs text-yellow-100">ZarinPal Payment Gateway</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={zarinpal.isActive || false}
                    onChange={(e) => updatePaymentConfig(['zarinpal', 'isActive'], e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6 bg-white/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:right-[unset] rtl:after:right-[2px] rtl:after:left-[unset] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                </label>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Merchant ID */}
            <div>
              <label className="text-sm font-bold text-gray-700 mb-2 block">
                Merchant ID <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showSecrets.zarinpalMerchant ? "text" : "password"}
                  value={zarinpal.merchantId || ''}
                  onChange={(e) => updatePaymentConfig(['zarinpal', 'merchantId'], e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-gray-50 text-left font-mono text-sm"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => toggleSecret('zarinpalMerchant')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showSecrets.zarinpalMerchant ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Sandbox Toggle */}
            <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-xl border border-yellow-200">
              <div>
                <span className="font-bold text-gray-700 text-sm">حالت آزمایشی (Sandbox)</span>
                <p className="text-xs text-gray-500 mt-1">برای تست بدون پرداخت واقعی</p>
              </div>
              <input
                type="checkbox"
                checked={zarinpal.isSandbox || false}
                onChange={(e) => updatePaymentConfig(['zarinpal', 'isSandbox'], e.target.checked)}
                className="w-5 h-5 accent-yellow-600"
              />
            </div>
          </div>
        </div>

        {/* Sadad Configuration */}
        <div
          className={`bg-white rounded-2xl shadow-sm border transition-all ${activeGateway === 'sadad' ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200'
            }`}
        >
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="font-bold">تنظیمات سداد</h3>
                  <p className="text-xs text-blue-100">Sadad Melli Payment Gateway</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sadad.isActive || false}
                    onChange={(e) => updatePaymentConfig(['sadad', 'isActive'], e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6 bg-white/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:right-[unset] rtl:after:right-[2px] rtl:after:left-[unset] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                </label>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Merchant ID */}
            <div>
              <label className="text-sm font-bold text-gray-700 mb-2 block">
                Merchant ID <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showSecrets.sadadMerchant ? "text" : "password"}
                  value={sadad.merchantId || ''}
                  onChange={(e) => updatePaymentConfig(['sadad', 'merchantId'], e.target.value)}
                  placeholder="123456789012345"
                  className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 text-left font-mono text-sm"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => toggleSecret('sadadMerchant')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showSecrets.sadadMerchant ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Terminal ID */}
            <div>
              <label className="text-sm font-bold text-gray-700 mb-2 block">
                Terminal ID <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showSecrets.sadadTerminal ? "text" : "password"}
                  value={sadad.terminalId || ''}
                  onChange={(e) => updatePaymentConfig(['sadad', 'terminalId'], e.target.value)}
                  placeholder="12345678"
                  className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 text-left font-mono text-sm"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => toggleSecret('sadadTerminal')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showSecrets.sadadTerminal ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Terminal Key */}
            <div>
              <label className="text-sm font-bold text-gray-700 mb-2 block">
                Terminal Key <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showSecrets.sadadKey ? "text" : "password"}
                  value={sadad.terminalKey || ''}
                  onChange={(e) => updatePaymentConfig(['sadad', 'terminalKey'], e.target.value)}
                  placeholder="Your Terminal Key"
                  className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 text-left font-mono text-sm"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => toggleSecret('sadadKey')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showSecrets.sadadKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Sandbox Toggle */}
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div>
                <span className="font-bold text-gray-700 text-sm">حالت آزمایشی (Sandbox)</span>
                <p className="text-xs text-gray-500 mt-1">برای تست بدون پرداخت واقعی</p>
              </div>
              <input
                type="checkbox"
                checked={sadad.isSandbox || false}
                onChange={(e) => updatePaymentConfig(['sadad', 'isSandbox'], e.target.checked)}
                className="w-5 h-5 accent-blue-600"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-3 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-8 py-3 bg-kala-600 text-white rounded-xl font-bold hover:bg-kala-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
              در حال ذخیره...
            </>
          ) : (
            <>
              <Save size={20} />
              ذخیره همه تنظیمات
            </>
          )}
        </button>

        {saveSuccess && (
          <div className="flex items-center gap-2 text-green-600 font-bold animate-fade-in">
            <CheckCircle size={20} />
            تنظیمات با موفقیت ذخیره شد
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-2xl border border-purple-100">
        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
          <AlertCircle size={20} className="text-purple-600" />
          نکات مهم
        </h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="text-purple-600 font-bold">•</span>
            <span>فقط یک درگاه می‌تواند به عنوان درگاه فعال انتخاب شود</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-600 font-bold">•</span>
            <span>قبل از فعال‌سازی درگاه، حتماً اطلاعات آن را کامل کنید</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-600 font-bold">•</span>
            <span>در حالت Sandbox ابتدا تست کنید سپس به حالت Production تغییر دهید</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-600 font-bold">•</span>
            <span>اطلاعات احراز هویت به صورت رمزنگاری شده در دیتابیس ذخیره می‌شود</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
