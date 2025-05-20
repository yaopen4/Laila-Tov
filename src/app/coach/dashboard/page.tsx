
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Baby } from '@/lib/mock-data';
import { getActiveBabies } from '@/lib/mock-data';
import DashboardHeader from '@/components/coach/dashboard-header';
import BabyList from '@/components/coach/baby-list';
import { Skeleton } from '@/components/ui/skeleton';

export default function CoachDashboardPage() {
  const [babies, setBabies] = useState<Baby[]>([]);
  const [filteredBabies, setFilteredBabies] = useState<Baby[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchAndSetBabies = useCallback(() => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      const activeBabies = getActiveBabies();
      setBabies(activeBabies);
      setFilteredBabies(activeBabies); // Initialize filtered list
      setIsLoading(false);
    }, 500);
  }, []);

  useEffect(() => {
    fetchAndSetBabies();
  }, [fetchAndSetBabies]);

  useEffect(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    const filteredData = babies.filter(item =>
      item.name.toLowerCase().includes(lowercasedFilter) ||
      item.familyName.toLowerCase().includes(lowercasedFilter) ||
      item.motherName.toLowerCase().includes(lowercasedFilter) ||
      item.fatherName.toLowerCase().includes(lowercasedFilter)
    );
    setFilteredBabies(filteredData);
  }, [searchTerm, babies]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  const handleBabyArchived = () => {
    fetchAndSetBabies(); // Refetch active babies after one is archived
  };

  if (isLoading) {
    return (
      <div>
        <DashboardHeader onSearch={handleSearch} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-4 border rounded-lg shadow">
              <Skeleton className="h-8 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-4" />
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-10 w-1/3 mt-4 ms-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  

  return (
    <div className="h-full">
      <DashboardHeader onSearch={handleSearch} />
      <BabyList babies={filteredBabies} onBabyArchived={handleBabyArchived} />
      {/* Real-time update placeholder:
      Firestore listeners would update 'babies' state, re-filtering automatically.
      A toast notification could also appear for new data.
      */}
    </div>
  );
}
