
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AddBabyForm, type BabyFormData } from '@/components/coach/add-baby-form';
import { getBabyById, updateBaby, type Baby } from '@/lib/mock-data';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function EditBabyPage() {
  const params = useParams();
  const router = useRouter();
  const babyId = params.babyId as string;
  const [baby, setBaby] = useState<Baby | null | undefined>(undefined); // undefined for loading, null for not found
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (babyId) {
      setIsLoading(true);
      // Simulate API call
      setTimeout(() => {
        const foundBaby = getBabyById(babyId);
        setBaby(foundBaby);
        setIsLoading(false);
      }, 500);
    }
  }, [babyId]);

  const handleEditBabySubmit = (values: BabyFormData, id?: string) => {
    if (!id || !baby) return;
    console.log("Updated baby data:", values);
    const success = updateBaby({ ...baby, ...values, id }); // Spread existing baby to keep sleepRecords etc.
    if (success) {
      router.push('/coach/dashboard'); // Navigate to dashboard after editing
    }
    // Toast is handled by AddBabyForm
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <Skeleton className="h-12 w-1/2 mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!baby) {
    return (
      <div className="container mx-auto py-8 text-center">
        <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-semibold mb-2">תינוק לא נמצא</h1>
        <p className="text-muted-foreground mb-6">
          לא הצלחנו למצוא את פרטי התינוק עם המזהה שהתקבל.
        </p>
        <Link href="/coach/dashboard" passHref legacyBehavior>
          <Button>חזרה ללוח הבקרה</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <AddBabyForm
        initialData={baby}
        isEditMode={true}
        onSubmitProp={handleEditBabySubmit}
      />
    </div>
  );
}
