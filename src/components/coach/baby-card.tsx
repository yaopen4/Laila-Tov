import type { FC } from 'react';
import Link from 'next/link';
import type { Baby } from '@/lib/mock-data';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Edit3, Eye } from 'lucide-react';

interface BabyCardProps {
  baby: Baby;
}

const BabyCard: FC<BabyCardProps> = ({ baby }) => {
  const latestSleepDate = baby.sleepRecords?.[0]?.date || "אין נתונים";
  
  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-primary/20 rounded-full">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">{baby.name} {baby.familyName}</CardTitle>
            <CardDescription>גיל: {baby.age} חודשים</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm"><strong className="font-medium">שם האם:</strong> {baby.motherName}</p>
        <p className="text-sm"><strong className="font-medium">שם האב:</strong> {baby.fatherName}</p>
        <p className="text-sm"><strong className="font-medium">עדכון אחרון:</strong> {latestSleepDate}</p>
        {baby.description && <p className="text-sm text-muted-foreground pt-2 italic">"{baby.description}"</p>}
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Link href={`/parent/${baby.parentUsername}`} passHref legacyBehavior>
          <Button variant="outline" size="sm">
            <Eye className="me-2 h-4 w-4" />
            צפה בנתונים
          </Button>
        </Link>
        {/* Placeholder for edit functionality */}
        <Button variant="ghost" size="sm">
          <Edit3 className="me-2 h-4 w-4" />
          ערוך
        </Button>
      </CardFooter>
    </Card>
  );
};

export default BabyCard;
