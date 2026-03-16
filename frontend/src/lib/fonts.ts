import localFont from 'next/font/local';

export const iransans = localFont({
  // مسیر جدید نسبت به این فایل (که در src/lib قرار دارد)
  src: './fonts/iransans.woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--font-iransans',
});
