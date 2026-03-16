'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>خطایی رخ داد</h2>
      <button onClick={() => reset()}>تلاش مجدد</button>
    </div>
  )
}
