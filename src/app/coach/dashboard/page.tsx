
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Baby, SleepRecord, SleepCycle } from '@/lib/mock-data'; // Added imports for CSV
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

  const handleExportCSV = () => {
    const babiesToExport = getActiveBabies(); // Use the unfiltered list for export
    if (babiesToExport.length === 0) {
      alert('אין תינוקות פעילים לייצוא.');
      return;
    }

    const escapeCSV = (field: any): string => {
      if (field === null || field === undefined) {
        return '';
      }
      const stringField = String(field);
      if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n') || stringField.includes('\r')) {
        return `"${stringField.replace(/"/g, '""')}"`;
      }
      return stringField;
    };

    const convertToCSV = (data: Record<string, any>[], headers: Record<string, string>): string => {
      const headerKeys = Object.keys(headers);
      const hebrewHeaderValues = Object.values(headers);

      const headerRow = hebrewHeaderValues.map(escapeCSV).join(',');
      const dataRows = data.map(row =>
        headerKeys.map(key => escapeCSV(row[key])).join(',')
      );
      return [headerRow, ...dataRows].join('\n');
    };
    
    const csvHeaders = {
      date: 'תאריך',
      stage: 'שלב בתהליך',
      cycleNumber: 'מספר מחזור שינה',
      bedtime: 'שעת השכבה',
      timeToSleep: 'כמה זמן עד שנרדם/ה',
      whoPutToSleep: 'מי הרדים/ה',
      howFellAsleep: 'איך נרדמ/ה',
      wakeTime: 'שעת יקיצה'
    };

    babiesToExport.forEach(baby => {
      const babyDataForCSV: any[] = [];

      if (baby.sleepRecords && baby.sleepRecords.length > 0) {
        baby.sleepRecords.forEach(record => {
          if (record.sleepCycles && record.sleepCycles.length > 0) {
            record.sleepCycles.forEach((cycle, index) => {
              babyDataForCSV.push({
                date: record.date,
                stage: record.stage,
                cycleNumber: index + 1,
                bedtime: cycle.bedtime,
                timeToSleep: cycle.timeToSleep,
                whoPutToSleep: cycle.whoPutToSleep,
                howFellAsleep: cycle.howFellAsleep,
                wakeTime: cycle.wakeTime || '', 
              });
            });
          } else {
            babyDataForCSV.push({
              date: record.date,
              stage: record.stage,
              cycleNumber: '-', bedtime: '-', timeToSleep: '-',
              whoPutToSleep: '-', howFellAsleep: '-', wakeTime: '-',
            });
          }
        });
      } else {
        const emptyRow: any = {};
        Object.keys(csvHeaders).forEach(key => {
            emptyRow[key] = (key === 'date' ? 'אין נתוני שינה' : '');
        });
        babyDataForCSV.push(emptyRow);
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
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });

    if (babiesToExport.length > 0) {
      alert(`${babiesToExport.length} קבצי CSV נוצרו והורדו (אחד לכל תינוק).`);
    }
  };

  const handleExportPDF = () => {
    alert('ייצוא PDF (עדיין לא מיושם במלואו)');
  };


  if (isLoading) {
    return (
      <div>
        <DashboardHeader 
          onSearch={handleSearch} 
          onExportCSV={() => {}} // Placeholder while loading
          onExportPDF={() => {}} // Placeholder while loading
        />
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
      <DashboardHeader 
        onSearch={handleSearch} 
        onExportCSV={handleExportCSV}
        onExportPDF={handleExportPDF}
      />
      <BabyList babies={filteredBabies} />
    </div>
  );
}
