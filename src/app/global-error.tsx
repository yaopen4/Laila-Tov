'use client';

/**
 * Last resort, for errors in the root layout itself. It replaces the whole document,
 * so it cannot use the app's providers or stylesheet.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="he" dir="rtl">
      <body style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '4rem 1rem' }}>
        <h1>משהו השתבש</h1>
        <p>אירעה שגיאה בלתי צפויה. נסו לרענן את הדף.</p>
        <button onClick={reset} style={{ padding: '0.5rem 1.5rem', marginTop: '1rem' }}>
          נסו שוב
        </button>
      </body>
    </html>
  );
}
