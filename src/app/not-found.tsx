import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-bold">הדף לא נמצא</h1>
      <p className="text-muted-foreground">ייתכן שהקישור שגוי או שהדף הוסר.</p>
      <Button asChild>
        <Link href="/">חזרה למסך הכניסה</Link>
      </Button>
    </main>
  );
}
