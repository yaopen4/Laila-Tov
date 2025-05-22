/**
 * @fileoverview Page for adding a new baby profile.
 * This page uses the AddBabyForm component to capture baby details.
 */
"use client";
import { AddBabyForm, type BabyFormData } from "@/components/coach/add-baby-form";
import { addBaby } from "@/lib/mock-data";
import { useRouter } from 'next/navigation';

export default function AddBabyPage() {
  const router = useRouter();

  /**
   * Handles the submission of the new baby form.
   * Adds the baby to mock data and navigates to the dashboard.
   * @param {BabyFormData} values - The form data for the new baby.
   */
  const handleAddBabySubmit = (values: BabyFormData) => {
    addBaby(values); // addBaby handles ID generation and full Baby object creation
    router.push('/coach/dashboard'); // Navigate to dashboard after adding
  };

  return (
    <div className="container mx-auto py-8">
      <AddBabyForm onSubmitProp={handleAddBabySubmit} />
    </div>
  );
}
