"use client";

import { useEffect, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { RotateCw } from "lucide-react";
import { authService } from "@/services/authService";

export interface NativeCaptchaRef {
  refresh: () => void;
  resetInput: () => void;
}

interface NativeCaptchaProps {
  onChange: (captchaId: string, text: string) => void;
  onRefresh?: () => void;
}

const NativeCaptcha = forwardRef<NativeCaptchaRef, NativeCaptchaProps>(
  ({ onChange, onRefresh }, ref) => {
    const [svg, setSvg] = useState<string>("");
    const [captchaId, setCaptchaId] = useState<string>("");
    const [text, setText] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<boolean>(false);

    const loadCaptcha = useCallback(async () => {
      try {
        setLoading(true);
        setError(false);
        setText("");
        onChange("", "");

        const res = await authService.getCaptcha();
        if (res.success && res.captchaId && res.svg) {
          setCaptchaId(res.captchaId);
          setSvg(res.svg);
        } else {
          setError(true);
        }
      } catch (err) {
        setError(true);
      } finally {
        setLoading(false);
      }
    }, [onChange]);

    useEffect(() => {
      loadCaptcha();
    }, [loadCaptcha]);

    useImperativeHandle(ref, () => ({
      refresh: () => {
        loadCaptcha();
        onRefresh?.();
      },
      resetInput: () => {
        setText("");
        onChange(captchaId, "");
      },
    }));

    const handleTextChange = (val: string) => {
      const clean = val.trim().slice(0, 5);
      setText(clean);
      onChange(captchaId, clean);
    };

    return (
      <div className="space-y-2 dir-rtl">
        <label className="block text-xs font-bold text-gray-700">
          کد امنیتی را وارد کنید
        </label>
        <div className="flex items-center gap-2">
          {/* Captcha Image Display */}
          <div className="relative flex-1 h-[44px] bg-slate-50 border border-slate-200 rounded-xl overflow-hidden flex items-center justify-center select-none">
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <RotateCw size={14} className="animate-spin" />
                در حال بارگذاری...
              </div>
            ) : error ? (
              <button
                type="button"
                onClick={loadCaptcha}
                className="text-xs text-rose-600 hover:underline"
              >
                خطا در دریافت. تلاش مجدد
              </button>
            ) : (
              <div
                className="w-full h-full flex items-center justify-center scale-95"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            )}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => {
              loadCaptcha();
              onRefresh?.();
            }}
            disabled={loading}
            title="کپچای جدید"
            aria-label="دریافت کد امنیتی جدید"
            className="w-11 h-[44px] shrink-0 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <RotateCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Input Field */}
        <input
          type="text"
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="کد ۵ رقمی بالا"
          maxLength={5}
          dir="ltr"
          autoComplete="off"
          className="w-full text-center tracking-[0.3em] font-mono rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-kala-500/30 focus:border-kala-400 uppercase"
        />
      </div>
    );
  }
);

NativeCaptcha.displayName = "NativeCaptcha";

export default NativeCaptcha;
