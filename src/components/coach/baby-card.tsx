
import type { FC } from 'react';
import Link from 'next/link';
import type { Baby } from '@/lib/mock-data';
import { archiveBaby } from '@/lib/mock-data';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Edit3, Eye, Archive as ArchiveIcon } from 'lucide-react';
import { format } from "date-fns";
import { he } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";

interface BabyCardProps {
  baby: Baby;
  onArchived?: () => void;
}

const BabyCard: FC<BabyCardProps> = ({ baby, onArchived }) => {
  const { toast } = useToast();
  const latestSleepDate = baby.sleepRecords && baby.sleepRecords.length > 0 && baby.sleepRecords[0].date
    ? format(new Date(baby.sleepRecords[0].date), "PPP", { locale: he })
    : "אין נתונים";

  const handleArchive = () => {
    if (archiveBaby(baby.id)) {
      toast({ 
        title: "תינוק הועבר לארכיון", 
        description: `${baby.name} ${baby.familyName} הועבר בהצלחה לארכיון.` 
      });
      if (onArchived) {
        onArchived();
      }
    } else {
      toast({ 
        title: "שגיאה בארכוב", 
        description: `לא ניתן היה להעביר את ${baby.name} ${baby.familyName} לארכיון.`, 
        variant: "destructive" 
      });
    }
  };
  
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
        <Button variant="outline" size="sm" onClick={handleArchive}>
          <ArchiveIcon className="me-2 h-4 w-4" />
          לארכיון
        </Button>
        <Link href={`/parent/${baby.parentUsername}`} passHref legacyBehavior>
          <Button variant="outline" size="sm">
            <Eye className="me-2 h-4 w-4" />
            צפה בנתונים
          </Button>
        </Link>
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
