const PERSIAN_DIGITS_MAP: Record<string, string> = {
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

export const toEnglishDigits = (value: string): string =>
  String(value ?? "").replace(/[۰-۹٠-٩]/g, (digit) => PERSIAN_DIGITS_MAP[digit] ?? digit);

export const toDigitsOnly = (value: string): string =>
  toEnglishDigits(value).replace(/\D/g, "");

export const normalizeIranMobile = (value: string): string | null => {
  const digitsOnly = toDigitsOnly(value);
  if (!digitsOnly) return null;

  let normalized = digitsOnly;
  if (normalized.startsWith("0098")) normalized = normalized.slice(4);
  else if (normalized.startsWith("098")) normalized = normalized.slice(3);
  else if (normalized.startsWith("98")) normalized = normalized.slice(2);

  if (normalized.length === 10 && normalized.startsWith("9")) {
    normalized = `0${normalized}`;
  }

  return /^09\d{9}$/.test(normalized) ? normalized : null;
};
