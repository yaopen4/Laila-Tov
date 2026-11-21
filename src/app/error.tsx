'use client';

import { useEffect } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

/**
 * Shown when a page throws while rendering. Without it a production build shows
 * Next.js's bare English "Application error" text to a Hebrew-speaking parent.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ui] Unhandled render error:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-bold">משהו השתבש</h1>
      <p className="text-muted-foreground">אירעה שגיאה בטעינת הדף. נסו שוב בעוד רגע.</p>
      {error.digest && (
        <p className="text-xs text-muted-foreground" dir="ltr">
          קוד תקלה: {error.digest}
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={reset}>נסו שוב</Button>
        <Button variant="outline" asChild>
          <Link href="/">חזרה למסך הכניסה</Link>
        </Button>
      </div>
    </main>
  );
}
