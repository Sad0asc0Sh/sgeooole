'use client'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>خطای کلی رخ داد</h2>
        <button onClick={() => reset()}>تلاش مجدد</button>
      </body>
    </html>
  )
}
