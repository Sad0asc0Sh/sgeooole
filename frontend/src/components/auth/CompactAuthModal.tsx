"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { GoogleLogin, CredentialResponse } from "@react-oauth/google";
import { authService } from "@/services/authService";
import NativeCaptcha, { NativeCaptchaRef } from "@/components/auth/NativeCaptcha";

type Step = "phone" | "otp";

export default function CompactAuthModal({
  open,
  title = "ورود / ثبت‌نام",
  description = "برای افزودن به علاقه‌مندی‌ها وارد حساب خود شوید.",
  onClose,
  onAuthenticated,
}: {
  open: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  onAuthenticated: () => void;
}) {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hpField, setHpField] = useState("");

  const [captchaId, setCaptchaId] = useState("");
  const [captchaText, setCaptchaText] = useState("");
  const captchaRef = useRef<NativeCaptchaRef | null>(null);

  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const otpInputRef = useRef<HTMLInputElement | null>(null);
  const mountTimeRef = useRef<number>(Date.now());
  const focusTimeRef = useRef<number>(0);
  const hasInteractionRef = useRef<boolean>(false);

  useEffect(() => {
    if (!open) return;
    mountTimeRef.current = Date.now();
    focusTimeRef.current = 0;
    hasInteractionRef.current = false;

    const onInteraction = () => {
      hasInteractionRef.current = true;
    };
    window.addEventListener("mousemove", onInteraction, { once: true });
    window.addEventListener("touchstart", onInteraction, { once: true });
    window.addEventListener("keydown", onInteraction, { once: true });
    return () => {
      window.removeEventListener("mousemove", onInteraction);
      window.removeEventListener("touchstart", onInteraction);
      window.removeEventListener("keydown", onInteraction);
    };
  }, [open]);

  const getBotTelemetryPayload = () => {
    const loadTime = Date.now() - mountTimeRef.current;
    const focusDuration = focusTimeRef.current ? Date.now() - focusTimeRef.current : 0;
    const ts = Date.now();
    const payload = JSON.stringify({
      loadTime,
      focusTime: focusDuration,
      hasInteraction: true,
      ts,
    });
    return typeof window !== "undefined" ? btoa(payload) : "";
  };

  const googleEnabled = useMemo(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    return Boolean(clientId);
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLoading(false);
    setStep("phone");
    setOtp("");
    setTimer(0);
    setTimeout(() => phoneInputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    if (step !== "otp") return;
    if (timer <= 0) return;

    const id = setInterval(() => setTimer((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [open, step, timer]);

  useEffect(() => {
    if (!open) return;
    if (step !== "otp") return;
    setTimeout(() => otpInputRef.current?.focus(), 50);
  }, [open, step]);

  const normalizeMobile = (input: string): string | null => {
    const digitsOnly = input.replace(/\D/g, "");
    let normalized = digitsOnly;

    if (normalized.startsWith("98") && normalized.length === 12) {
      normalized = "0" + normalized.slice(2);
    } else if (normalized.length === 10 && normalized.startsWith("9")) {
      normalized = "0" + normalized;
    }

    if (!/^09\d{9}$/.test(normalized)) return null;
    return normalized;
  };

  const handleSendOtp = async () => {
    const normalized = normalizeMobile(phone);
    if (!normalized) {
      setError("شماره موبایل معتبر نیست. نمونه: 09xxxxxxxxx");
      return;
    }
    if (!captchaId || captchaText.length < 5) {
      setError("لطفاً کد کپچا ۵ رقمی را به صورت کامل وارد کنید.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const telemetry = getBotTelemetryPayload();
      const response = await authService.sendOtp(normalized, captchaId, captchaText, {
        hp_field: hpField,
        telemetry,
      });
      if (!response.success) {
        setError(response.message || "ارسال کد با خطا مواجه شد.");
        captchaRef.current?.refresh();
        return;
      }

      setPhone(normalized);
      setStep("otp");
      setTimer(response.expiresIn || 120);
    } catch (err: any) {
      setError(err?.message || "ارسال کد با خطا مواجه شد.");
      captchaRef.current?.refresh();
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!/^\d{4}$/.test(otp)) {
      setError("کد باید ۴ رقم باشد.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await authService.verifyOtp(phone, otp);
      if (!response.success) {
        setError(response.message || "کد وارد شده صحیح نیست.");
        return;
      }

      if (!authService.isAuthenticated()) {
        setError("ورود انجام نشد. لطفاً دوباره تلاش کنید.");
        return;
      }

      onAuthenticated();
    } catch (err: any) {
      setError(err?.message || "تأیید کد با خطا مواجه شد.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      setError("ورود با گوگل ناموفق بود.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await authService.loginWithGoogle(credentialResponse.credential);
      if (!response.success) {
        setError(response.message || "ورود با گوگل ناموفق بود.");
        return;
      }

      if (!authService.isAuthenticated()) {
        setError("ورود انجام نشد. لطفاً دوباره تلاش کنید.");
        return;
      }

      onAuthenticated();
    } catch (err: any) {
      setError(err?.message || "ورود با گوگل ناموفق بود.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="بستن"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => onClose()}
      />

      <div className="relative w-full max-w-[420px] rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-start justify-between p-4 border-b border-gray-100">
          <div className="min-w-0">
            <h2 className="font-black text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          </div>

          <button
            type="button"
            aria-label="بستن"
            className="shrink-0 w-9 h-9 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center"
            onClick={() => onClose()}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          {error && (
            <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700 text-xs">
              {error}
            </div>
          )}

          {googleEnabled && step === "phone" && (
            <div className="mb-4">
              <div className="w-full flex justify-center">
                <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError("ورود با گوگل ناموفق بود.")} />
              </div>
              <div className="flex items-center gap-3 my-4">
                <div className="h-px bg-gray-100 flex-1" />
                <span className="text-[11px] text-gray-400">یا</span>
                <div className="h-px bg-gray-100 flex-1" />
              </div>
            </div>
          )}

          {step === "phone" ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendOtp();
              }}
            >
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">شماره موبایل</label>
                <input
                  ref={phoneInputRef}
                  value={phone}
                  onFocus={() => {
                    focusTimeRef.current = focusTimeRef.current || Date.now();
                    hasInteractionRef.current = true;
                  }}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  dir="ltr"
                  placeholder="09xxxxxxxxx"
                  className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-kala-500/30 focus:border-kala-400"
                />
                {/* Honeypot field (hidden from real users) */}
                <input
                  type="text"
                  name="hp_field"
                  value={hpField}
                  onChange={(e) => setHpField(e.target.value)}
                  style={{ display: "none" }}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                />
              </div>

              {/* Native Captcha Component */}
              <NativeCaptcha
                ref={captchaRef}
                onChange={(id, text) => {
                  setCaptchaId(id);
                  setCaptchaText(text);
                }}
              />

              <button
                type="submit"
                disabled={loading || !captchaId || captchaText.length < 5}
                className="w-full rounded-xl bg-kala-500 hover:bg-kala-600 text-white font-bold py-3 text-sm disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {loading ? "در حال ارسال..." : "ارسال کد"}
              </button>
              <p className="text-[11px] text-gray-400 leading-5">
                با ارسال کد، اگر حسابی نداشته باشید به صورت خودکار ثبت‌نام می‌شوید.
              </p>
            </form>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                handleVerifyOtp();
              }}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-600">
                  کد ارسال‌شده به <span className="font-bold" dir="ltr">{phone}</span>
                </p>
                <button
                  type="button"
                  className="text-xs font-bold text-kala-600 hover:text-kala-700"
                  onClick={() => {
                    setStep("phone");
                    setOtp("");
                    setTimer(0);
                    setError(null);
                    setTimeout(() => phoneInputRef.current?.focus(), 50);
                  }}
                >
                  تغییر شماره
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">کد تایید</label>
                <input
                  ref={otpInputRef}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  dir="ltr"
                  placeholder="----"
                  className="w-full tracking-[0.5em] text-center rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-kala-500/30 focus:border-kala-400"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-kala-500 hover:bg-kala-600 text-white font-bold py-3 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "در حال تأیید..." : "تأیید و ادامه"}
              </button>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>ارسال مجدد</span>
                {timer > 0 ? (
                  <span dir="ltr">{timer}s</span>
                ) : (
                  <button
                    type="button"
                    className="font-bold text-kala-600 hover:text-kala-700"
                    disabled={loading}
                    onClick={handleSendOtp}
                  >
                    ارسال دوباره
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
