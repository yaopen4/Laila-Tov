/**
 * @fileoverview Coach dashboard page.
 * Displays a list of active babies, allows searching, and exporting data.
 */
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Baby, SleepRecord, SleepCycle } from '@/lib/mock-data';
import { getActiveBabies } from '@/lib/mock-data';
import DashboardHeader from '@/components/coach/dashboard-header';
import BabyList from '@/components/coach/baby-list';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from "date-fns";
import { he } from 'date-fns/locale';

export default function CoachDashboardPage() {
  const [babies, setBabies] = useState<Baby[]>([]);
  const [filteredBabies, setFilteredBabies] = useState<Baby[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Fetches and sets the list of active babies.
   * Simulates an API call.
   */
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

  // Effect to filter babies based on search term
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

  /**
   * Updates the search term state.
   * @param {string} term - The search term entered by the user.
   */
  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  /**
   * Handles exporting baby data to CSV files.
   * Generates one CSV file per active baby.
   */
  const handleExportCSV = () => {
    const babiesToExport = getActiveBabies(); 
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
          } else { // If a record has no sleep cycles
            babyDataForCSV.push({
              date: record.date,
              stage: record.stage,
              cycleNumber: '-', bedtime: '-', timeToSleep: '-',
              whoPutToSleep: '-', howFellAsleep: '-', wakeTime: '-',
            });
          }
        });
      } else { // If a baby has no sleep records at all
        const emptyRow: any = {};
        Object.keys(csvHeaders).forEach(key => {
            emptyRow[key] = (key === 'date' ? 'אין נתוני שינה' : '');
        });
        babyDataForCSV.push(emptyRow);
      }
      
      const csvString = convertToCSV(babyDataForCSV, csvHeaders);
      // Add BOM for Excel to correctly interpret UTF-8 Hebrew characters
      const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      const safeFileName = `${baby.name}_${baby.familyName}`.replace(/[^a-z0-9א-ת_.-]/gi, '_');
      link.setAttribute('download', `LailaTov_Data_${safeFileName}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      
      // Delay cleanup to ensure download initiation for multiple files
      setTimeout(() => {
        if (link.parentElement) {
            document.body.removeChild(link);
        }
        URL.revokeObjectURL(url);
      }, 100); 
    });

    if (babiesToExport.length > 0) {
      alert(`${babiesToExport.length} קבצי CSV נוצרו והורדו (אחד לכל תינוק).`);
    }
  };

  /**
   * Handles exporting baby data to a PDF file (via browser print).
   * Generates an HTML document with all baby data and triggers the print dialog.
   */
  const handleExportPDF = () => {
    const babiesToExport = getActiveBabies();
    if (babiesToExport.length === 0) {
      alert('אין תינוקות פעילים לייצוא ל-PDF.');
      return;
    }

    let htmlContent = `
      <html>
        <head>
          <meta charset="UTF-8">
          <title>נתוני תינוקות - לילה טוב</title>
          <style>
            @media print {
              body { 
                font-family: Arial, sans-serif; 
                direction: rtl;
              }
              .page-break { 
                page-break-after: always; 
                border-bottom: 1px dashed #ccc;
                padding-bottom: 20px;
                margin-bottom: 20px;
              }
              .baby-section:last-child .page-break {
                page-break-after: auto; /* No page break after the last baby */
                border-bottom: none;
              }
              table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-top: 10px; 
                margin-bottom: 20px;
              }
              th, td { 
                border: 1px solid black; 
                padding: 8px; 
                text-align: right; 
              }
              th { 
                background-color: #f2f2f2; 
              }
              h1, h2, h3, h4 { 
                text-align: right; 
                color: #333;
              }
              h1 { font-size: 24px; margin-bottom: 5px;}
              h2 { font-size: 18px; margin-bottom: 3px; color: #555;}
              h3 { font-size: 16px; margin-bottom: 3px; color: #555;}
              h4 { font-size: 14px; margin-top: 15px; margin-bottom: 5px; color: #777;}
              p { text-align: right; }
              .no-records { font-style: italic; color: #888; }
            }
          </style>
        </head>
        <body>
    `;

    babiesToExport.forEach(baby => {
      htmlContent += `
        <div class="baby-section page-break">
          <h1>תינוק: ${baby.name} ${baby.familyName}</h1>
          <h2>גיל: ${baby.age} חודשים</h2>
          <h3>פרטי הורים: אם - ${baby.motherName}, אב - ${baby.fatherName}</h3>
          ${baby.description ? `<p><strong>תיאור:</strong> ${baby.description}</p>` : ''}
          ${baby.coachNotes ? `<p><strong>הערות מאמן/ת:</strong> ${baby.coachNotes}</p>` : ''}
      `;

      if (baby.sleepRecords && baby.sleepRecords.length > 0) {
        baby.sleepRecords.forEach(record => {
          htmlContent += `<h4>רשומת שינה: ${format(new Date(record.date), "PPP", { locale: he })} (שלב: ${record.stage})</h4>`;
          if (record.sleepCycles && record.sleepCycles.length > 0) {
            htmlContent += `
              <table>
                <thead>
                  <tr>
                    <th>מחזור</th>
                    <th>שעת השכבה</th>
                    <th>זמן להירדם</th>
                    <th>מי הרדים/ה</th>
                    <th>איך נרדמ/ה</th>
                    <th>שעת יקיצה</th>
                  </tr>
                </thead>
                <tbody>
            `;
            record.sleepCycles.forEach((cycle, index) => {
              htmlContent += `
                <tr>
                  <td>${index + 1}</td>
                  <td>${cycle.bedtime}</td>
                  <td>${cycle.timeToSleep}</td>
                  <td>${cycle.whoPutToSleep}</td>
                  <td>${cycle.howFellAsleep}</td>
                  <td>${cycle.wakeTime || '-'}</td>
                </tr>
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
      htmlContent += `</div>`; // Close baby-section
    });

    htmlContent += `</body></html>`;

    // Use a hidden iframe to trigger print
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    document.body.appendChild(iframe);

    iframe.srcdoc = htmlContent;
    iframe.onload = function() {
      try {
        iframe.contentWindow?.focus(); // Required for some browsers
        iframe.contentWindow?.print();
      } catch (error) {
        console.error("Error during print:", error);
        alert("אירעה שגיאה בעת ניסיון הפקת ה-PDF. נסה שוב או בדוק את הגדרות הדפדפן.");
      } finally {
        // Delay removal to allow print dialog to fully process
        setTimeout(() => {
          if (iframe.parentElement) {
            document.body.removeChild(iframe);
          }
        }, 500);
      }
    };
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
