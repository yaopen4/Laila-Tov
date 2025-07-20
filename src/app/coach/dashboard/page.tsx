
/**
 * @fileoverview Consultant dashboard page.
 * Displays a list of active babies from Firestore, allows searching, and exporting data.
 * Implements real-time updates for the baby list.
 */
"use client";

import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import type { Baby, SleepRecord, SleepCycle } from '@/types';
import { getActiveBabiesFromFirestore, getSleepRecordsForBabyFromFirestore } from '@/services/babyService';
import DashboardHeader from '@/components/coach/dashboard-header';
import BabyList from '@/components/coach/baby-list';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { format } from "date-fns";
import { he } from 'date-fns/locale';

/**
 * Escapes HTML special characters in a string for safe injection into HTML templates (e.g., for PDF export).
 * @param {string | null | undefined} unsafe - The string to escape.
 * @returns {string} The escaped string.
 */
const escapeHtml = (unsafe: string | null | undefined): string => {
  if (unsafe === null || unsafe === undefined) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

export default function CoachDashboardPage() {
  const [babies, setBabies] = useState<Baby[]>([]);
  const [filteredBabies, setFilteredBabies] = useState<Baby[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const { toast } = useToast();

  // State for export dialog
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [selectedBabyIds, setSelectedBabyIds] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');
  const [selectAllBabies, setSelectAllBabies] = useState(false);
  const [isExporting, setIsExporting] = useState(false);


  // Get the currently authenticated user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        // Handle user not logged in, maybe redirect or show a message
        console.log("User is not logged in.");
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);


  // Real-time listener for active babies, filtered by the current coach's ID
  useEffect(() => {
    if (!currentUser) {
      return; // Wait for the user to be set
    }
    
    setIsLoading(true);

    const q = query(
      collection(db, 'babies'),
      where('coachId', '==', currentUser.uid),
      where('isArchived', '==', false),
      orderBy('familyName'),
      orderBy('name')
    );

    const unsubscribe = onSnapshot(q, 
      async (querySnapshot) => {
        const activeBabiesPromises = querySnapshot.docs.map(async (docSnap) => {
          const babyData = { id: docSnap.id, ...docSnap.data() } as Baby;
          // Fetch sleep records for each baby to have complete data for card display / export
          // This can be optimized if not all sleep data is needed immediately on the dashboard
          const sleepRecords = await getSleepRecordsForBabyFromFirestore(babyData.id);
          return { ...babyData, sleepRecords };
        });
        const activeBabies = await Promise.all(activeBabiesPromises);

        setBabies(activeBabies);
        setFilteredBabies(activeBabies); // Initialize filtered list
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching active babies in real-time: ", error);
        toast({
          title: "שגיאה בטעינת נתונים",
          description: "לא ניתן היה לטעון את רשימת התינוקות.",
          variant: "destructive",
        });
        setIsLoading(false);
      }
    );

    return () => unsubscribe(); // Cleanup listener on component unmount
  }, [currentUser, toast]);


  // Effect to filter babies based on search term
  useEffect(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    const filteredData = babies.filter(item =>
      item.name.toLowerCase().includes(lowercasedFilter) ||
      item.familyName.toLowerCase().includes(lowercasedFilter) ||
      item.motherName.toLowerCase().includes(lowercasedFilter) ||
      (item.fatherName && item.fatherName.toLowerCase().includes(lowercasedFilter))
    );
    setFilteredBabies(filteredData);
  }, [searchTerm, babies]);

  /**
   * Updates the search term state.
   * @param {string} term - The search term entered by the user.
   */
  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  const openExportDialog = () => {
    setSelectedBabyIds([]); // Reset selections
    setSelectAllBabies(false);
    setExportFormat('csv'); // Reset format
    setIsExportDialogOpen(true);
  };

  const handleBabySelectionChange = (babyId: string, checked: boolean) => {
    setSelectedBabyIds(prevSelected =>
      checked ? [...prevSelected, babyId] : prevSelected.filter(id => id !== babyId)
    );
    // If unchecking an item, uncheck "select all"
    if (!checked) {
      setSelectAllBabies(false);
    }
  };

  const handleSelectAllChange = (checked: boolean) => {
    setSelectAllBabies(checked);
    if (checked) {
      setSelectedBabyIds(babies.map(b => b.id));
    } else {
      setSelectedBabyIds([]);
    }
  };
  
  // Effect to update "select all" checkbox if all items are manually selected/deselected
  useEffect(() => {
    if (babies.length > 0 && selectedBabyIds.length === babies.length) {
      setSelectAllBabies(true);
    } else if (selectedBabyIds.length === 0 && !selectAllBabies && babies.length > 0) {
      // This case is tricky; if selectAllBabies was explicitly unchecked, selectedBabyIds is already empty.
      // We want to ensure selectAllBabies is false if not all are selected.
      if(selectAllBabies && selectedBabyIds.length < babies.length) {
        setSelectAllBabies(false);
      }
    }
  }, [selectedBabyIds, babies, selectAllBabies]);


  /**
   * Handles exporting baby data to CSV files.
   * Generates one CSV file per baby.
   * @param {Baby[]} babiesToExport - The list of babies to export.
   */
  const exportBabiesToCSV = async (babiesToExport: Baby[]) => {
    if (babiesToExport.length === 0) {
      toast({ title: 'לא נבחרו תינוקות', description: 'יש לבחור לפחות תינוק אחד לייצוא.', variant: 'destructive' });
      return;
    }
    setIsExporting(true);

    const localEscapeCSV = (field: any): string => {
      if (field === null || field === undefined) return '';
      const stringField = String(field);
      return `"${stringField.replace(/"/g, '""')}"`;
    };

    const convertToCSV = (data: Record<string, any>[], headers: Record<string, string>): string => {
      const headerKeys = Object.keys(headers);
      const hebrewHeaderValues = Object.values(headers);
      const headerRow = hebrewHeaderValues.map(localEscapeCSV).join(',');
      const dataRows = data.map(row => headerKeys.map(key => localEscapeCSV(row[key])).join(','));
      return [headerRow, ...dataRows].join('\n');
    };
    
    const csvHeaders = {
      date: 'תאריך',
      cycleNumber: 'מספר מחזור שינה',
      bedtime: 'שעת השכבה',
      timeToSleep: 'כמה זמן עד שנרדם',
      whoPutToSleep: 'מי הרדים',
      howFellAsleep: 'איך נרדם',
      wakeTime: 'שעת יקיצה'
    };

    for (const baby of babiesToExport) {
      const babyDataForCSV: any[] = [];
      // Ensure sleepRecords are fetched if not already on the baby object from the dashboard state
      const sleepRecords = baby.sleepRecords || await getSleepRecordsForBabyFromFirestore(baby.id);

      if (sleepRecords && sleepRecords.length > 0) {
        sleepRecords.forEach(record => {
          if (record.sleepCycles && record.sleepCycles.length > 0) {
            record.sleepCycles.forEach((cycle, index) => {
              babyDataForCSV.push({
                date: record.date,
                cycleNumber: index + 1,
                bedtime: cycle.bedtime,
                timeToSleep: cycle.timeToSleep,
                whoPutToSleep: cycle.whoPutToSleep,
                howFellAsleep: cycle.howFellAsleep,
                wakeTime: cycle.wakeTime || '', 
              });
            });
          } else {
            babyDataForCSV.push({ date: record.date, cycleNumber: '-', bedtime: '-', timeToSleep: '-', whoPutToSleep: '-', howFellAsleep: '-', wakeTime: '-' });
          }
        });
      } else {
        babyDataForCSV.push({ date: 'אין נתוני שינה', cycleNumber: '', bedtime: '', timeToSleep: '', whoPutToSleep: '', howFellAsleep: '', wakeTime: '' });
      }
      
      const csvString = convertToCSV(babyDataForCSV, csvHeaders);
      const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      const safeFileName = `${baby.name}_${baby.familyName}`.replace(/[^a-z0-9א-ת_.-]/gi, '_');
      link.setAttribute('download', `LailaTov_Data_${safeFileName}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
      if (link.parentElement) document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    toast({ title: 'ייצוא CSV הושלם', description: `${babiesToExport.length} קבצים נוצרו והורדו.`});
    setIsExporting(false);
    setIsExportDialogOpen(false);
  };

  /**
   * Handles exporting baby data to a PDF file (via browser print).
   * @param {Baby[]} babiesToExport - The list of babies to export.
   */
  const exportBabiesToPDF = async (babiesToExport: Baby[]) => {
     if (babiesToExport.length === 0) {
      toast({ title: 'לא נבחרו תינוקות', description: 'יש לבחור לפחות תינוק אחד לייצוא.', variant: 'destructive' });
      return;
    }
    setIsExporting(true);

    let htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
        <head>
          <meta charset="UTF-8">
          <title>נתוני תינוקות - לילה טוב</title>
          <style>
            @media print {
              body { font-family: Arial, sans-serif; direction: rtl; margin: 20px; }
              .baby-section { page-break-after: always; border-bottom: 1px dashed #ccc; padding-bottom: 20px; margin-bottom: 20px; }
              .baby-section:last-child { page-break-after: auto; border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; }
              th, td { border: 1px solid black; padding: 8px; text-align: right; }
              th { background-color: #f2f2f2; }
              h1, h2, h3, h4 { text-align: right; color: #333; }
              h1 { font-size: 22px; margin-bottom: 5px;}
              h2 { font-size: 18px; margin-bottom: 3px; color: #555;}
              h3 { font-size: 16px; margin-bottom: 3px; color: #555;}
              h4 { font-size: 14px; margin-top: 15px; margin-bottom: 5px; color: #777;}
              p { text-align: right; margin: 5px 0; }
              .no-records { font-style: italic; color: #888; margin-top: 10px; }
            }
          </style>
        </head>
        <body>
    `;

    for (const baby of babiesToExport) {
      htmlContent += `
        <div class="baby-section">
          <h1>תינוק: ${escapeHtml(baby.name)} ${escapeHtml(baby.familyName)}</h1>
          <h2>גיל: ${escapeHtml(String(baby.age))} חודשים</h2>
          <h3>פרטי הורים: אם - ${escapeHtml(baby.motherName)}, אב - ${escapeHtml(baby.fatherName)}</h3>
          ${baby.description ? `<p><strong>תיאור:</strong> ${escapeHtml(baby.description)}</p>` : ''}
          ${baby.coachNotes ? `<p><strong>הערות היועצת:</strong> ${escapeHtml(baby.coachNotes)}</p>` : ''}
      `;
      
      const sleepRecords = baby.sleepRecords || await getSleepRecordsForBabyFromFirestore(baby.id);

      if (sleepRecords && sleepRecords.length > 0) {
        sleepRecords.forEach(record => {
          htmlContent += `<h4>רשומת שינה: ${escapeHtml(format(new Date(record.date), "PPP", { locale: he }))}</h4>`;
          if (record.sleepCycles && record.sleepCycles.length > 0) {
            htmlContent += `
              <table>
                <thead><tr><th>מחזור</th><th>שעת השכבה</th><th>זמן להירדם</th><th>מי הרדים</th><th>איך נרדמ/ה</th><th>שעת יקיצה</th></tr></thead>
                <tbody>
            `;
            record.sleepCycles.forEach((cycle, index) => {
              htmlContent += `
                <tr><td>${index + 1}</td><td>${escapeHtml(cycle.bedtime)}</td><td>${escapeHtml(cycle.timeToSleep)}</td><td>${escapeHtml(cycle.whoPutToSleep)}</td><td>${escapeHtml(cycle.howFellAsleep)}</td><td>${escapeHtml(cycle.wakeTime) || '-'}</td></tr>
              `;
            });
            htmlContent += `</tbody></table>`;
          } else {
            htmlContent += `<p class="no-records">אין מחזורי שינה מתועדים לרשומה זו.</p>`;
          }
        });
      } else {
        htmlContent += `<p class="no-records">אין נתוני שינה זמינים לתינוק זה.</p>`;
      }
      htmlContent += `</div>`;
    }

    htmlContent += `</body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.left = '-9999px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    iframe.srcdoc = htmlContent;
    iframe.onload = function() {
      try {
        if (iframe.contentWindow) {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } else { throw new Error("Cannot access iframe content window."); }
      } catch (error) {
        console.error("Error during print:", error);
        toast({ title: 'שגיאה בייצוא PDF', description: 'אירעה שגיאה. נסה שוב.', variant: 'destructive' });
      } finally {
        toast({ title: 'חלון הדפסה מוכן', description: 'בחר "שמור כ-PDF" בחלון ההדפסה של הדפדפן לשמירת הקובץ.' });
        setTimeout(() => { if (iframe.parentElement) document.body.removeChild(iframe); }, 1000); 
        setIsExporting(false);
        setIsExportDialogOpen(false);
      }
    };
  };

  const handleConfirmExport = async () => {
    if (selectedBabyIds.length === 0) {
      toast({ title: 'לא נבחרו תינוקות', description: 'אנא בחר לפחות תינוק אחד לייצוא.', variant: 'destructive' });
      return;
    }
    const babiesToActuallyExport = babies.filter(b => selectedBabyIds.includes(b.id));

    if (exportFormat === 'csv') {
      await exportBabiesToCSV(babiesToActuallyExport);
    } else if (exportFormat === 'pdf') {
      await exportBabiesToPDF(babiesToActuallyExport);
    }
  };


  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto">
        <DashboardHeader onSearch={handleSearch} onOpenExportDialog={openExportDialog} />
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
    <div className="max-w-7xl mx-auto">
      <DashboardHeader onSearch={handleSearch} onOpenExportDialog={openExportDialog} />
      <BabyList babies={filteredBabies} />

      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ייצוא נתוני תינוקות</DialogTitle>
            <DialogDescription>בחר את התינוקות והפורמט לייצוא.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="font-semibold">בחר תינוקות:</Label>
              {babies.length > 0 ? (
                <>
                  <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <Checkbox
                      id="select-all-babies"
                      checked={selectAllBabies}
                      onCheckedChange={(checked) => handleSelectAllChange(Boolean(checked))}
                      disabled={isExporting}
                    />
                    <Label htmlFor="select-all-babies" className="cursor-pointer">בחר הכל</Label>
                  </div>
                  <ScrollArea className="h-[150px] w-full rounded-md border p-2">
                    {babies.map(baby => (
                      <div key={baby.id} className="flex items-center space-x-2 rtl:space-x-reverse py-1">
                        <Checkbox
                          id={`baby-export-${baby.id}`}
                          checked={selectedBabyIds.includes(baby.id)}
                          onCheckedChange={(checked) => handleBabySelectionChange(baby.id, Boolean(checked))}
                          disabled={isExporting}
                        />
                        <Label htmlFor={`baby-export-${baby.id}`} className="cursor-pointer">
                          {baby.name} {baby.familyName}
                        </Label>
                      </div>
                    ))}
                  </ScrollArea>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">אין תינוקות פעילים להצגה.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">בחר פורמט ייצוא:</Label>
              <RadioGroup
                value={exportFormat}
                onValueChange={(value: 'csv' | 'pdf') => setExportFormat(value)}
                className="flex space-x-2 rtl:space-x-reverse"
                disabled={isExporting}
              >
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <RadioGroupItem value="csv" id="format-csv" disabled={isExporting}/>
                  <Label htmlFor="format-csv" className="cursor-pointer">CSV</Label>
                </div>
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <RadioGroupItem value="pdf" id="format-pdf" disabled={isExporting}/>
                  <Label htmlFor="format-pdf" className="cursor-pointer">PDF</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isExporting}>ביטול</Button>
            </DialogClose>
            <Button type="button" onClick={handleConfirmExport} disabled={selectedBabyIds.length === 0 || isExporting}>
              {isExporting ? "מייצא..." : "ייצא נתונים"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
