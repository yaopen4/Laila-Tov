
import type { FC } from 'react';
import type { Baby } from '@/lib/mock-data';
import BabyCard from './baby-card';

interface BabyListProps {
  babies: Baby[];
  // Removed onBabyArchived prop
}

const BabyList: FC<BabyListProps> = ({ babies }) => {
  if (babies.length === 0) {
    return <p className="text-center text-muted-foreground mt-8">לא נמצאו תינוקות פעילים.</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {babies.map((baby) => (
        // Removed onArchived prop from BabyCard
        <BabyCard key={baby.id} baby={baby} />
      ))}
    </div>
  );
};

export default BabyList;
