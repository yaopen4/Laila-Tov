
/**
 * @fileoverview Component to display a summary card for a baby on the coach's dashboard.
 * Provides links to view baby's data (parent view) and edit baby's profile.
 */
import type { FC } from 'react';
import Link from 'next/link';
import type { Baby } from '@/lib/mock-data';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Edit3, Eye } from 'lucide-react';
import { format } from "date-fns";
import { he } from 'date-fns/locale';

/**
 * Props for the BabyCard component.
 */
interface BabyCardProps {
  /** The baby object containing details to display. */
  baby: Baby;
}

/**
 * Renders a card displaying a baby's summary information.
 * Includes actions to view the baby's detailed data or edit their profile.
 * @param {BabyCardProps} props - The component's props.
 */
const BabyCard: FC<BabyCardProps> = ({ baby }) => {
  // Determine the date of the latest sleep record, or indicate if none exist.
  const latestSleepDate = baby.sleepRecords && baby.sleepRecords.length > 0 && baby.sleepRecords[0].date
    ? format(new Date(baby.sleepRecords[0].date), "PPP", { locale: he })
    : "אין נתונים";

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col">
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
      <CardContent className="space-y-2 flex-grow">
        <p className="text-sm"><strong className="font-medium">שם האם:</strong> {baby.motherName}</p>
        <p className="text-sm"><strong className="font-medium">שם האב:</strong> {baby.fatherName}</p>
        <p className="text-sm"><strong className="font-medium">עדכון שינה אחרון:</strong> {latestSleepDate}</p>
        <p className="text-sm"><strong className="font-medium">עודכן לאחרונה:</strong> {format(new Date(baby.lastModified), "PPP HH:mm", { locale: he })}</p>
        {baby.description && <p className="text-sm text-muted-foreground pt-2 italic">"{baby.description}"</p>}
      </CardContent>
      <CardFooter className="flex flex-wrap justify-end gap-2 pt-4">
        {/* Link to view the baby's data from the parent's perspective */}
        <Link href={`/parent/${baby.parentUsername}`} passHref legacyBehavior>
          <Button variant="outline" size="sm">
            <Eye className="me-2 h-4 w-4" />
            צפה בנתונים
          </Button>
        </Link>
        {/* Link to edit the baby's profile */}
        <Link href={`/coach/edit-baby/${baby.id}`} passHref legacyBehavior>
          <Button variant="default" size="sm">
            <Edit3 className="me-2 h-4 w-4" />
            ערוך
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
};

export default BabyCard;
