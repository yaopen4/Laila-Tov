
"use client";
import { AddBabyForm, type BabyFormData } from "@/components/coach/add-baby-form";
import { addBaby } from "@/lib/mock-data";
import { useRouter } from 'next/navigation';

export default function AddBabyPage() {
  const router = useRouter();

  const handleAddBabySubmit = (values: BabyFormData) => {
    console.log("New baby data:", values);
    addBaby(values); // Assuming addBaby handles the ID generation and full Baby object creation
    // Optionally navigate or show success message is handled by AddBabyForm
    router.push('/coach/dashboard'); // Navigate to dashboard after adding
  };

  return (
    <div className="container mx-auto py-8">
      <AddBabyForm onSubmitProp={handleAddBabySubmit} />
    </div>
  );
}
