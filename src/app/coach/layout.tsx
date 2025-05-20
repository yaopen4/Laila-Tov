
"use client";

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import AppLogo from "@/components/shared/app-logo";
import { Button } from "@/components/ui/button";
import { LogOut, UserPlus, Users, Archive, FileText, FileSpreadsheet } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { getActiveBabies, type Baby, type SleepRecord, type SleepCycle } from '@/lib/mock-data'; // Added imports for CSV export

export default function CoachLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { href: "/coach/dashboard", label: "לוח בקרה", icon: Users },
    { href: "/coach/add-baby", label: "הוספת תינוק", icon: UserPlus },
    { href: "/coach/archive", label: "ארכיון", icon: Archive },
  ];

  const handleExportCSV = () => {
    const babies = getActiveBabies();
    if (babies.length === 0) {
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

    babies.forEach(baby => {
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
                wakeTime: cycle.wakeTime || '', // Ensure empty string if undefined
              });
            });
          } else {
             // If a record has no cycles, represent it with date and stage
            babyDataForCSV.push({
              date: record.date,
              stage: record.stage,
              cycleNumber: '-',
              bedtime: '-',
              timeToSleep: '-',
              whoPutToSleep: '-',
              howFellAsleep: '-',
              wakeTime: '-',
            });
          }
        });
      } else {
        // If baby has no sleep records at all
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

    if (babies.length > 0) {
      alert(`${babies.length} קבצי CSV נוצרו והורדו (אחד לכל תינוק).`);
    }
  };

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center justify-between p-2">
             <AppLogo className="text-2xl group-data-[collapsible=icon]:hidden" />
             <SidebarTrigger />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href} legacyBehavior passHref>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    tooltip={{ children: item.label, side: 'right', align: 'center' }}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
            {/* Export Buttons */}
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleExportCSV}
                tooltip={{ children: 'ייצוא CSV', side: 'right', align: 'center' }}
              >
                <FileSpreadsheet className="h-5 w-5" />
                <span>ייצוא CSV</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => alert('ייצוא PDF (עדיין לא מיושם במלואו)')} 
                tooltip={{ children: 'ייצוא PDF', side: 'right', align: 'center' }}
              >
                <FileText className="h-5 w-5" />
                <span>ייצוא PDF</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <Separator className="my-2" />
         <div className="p-2 mt-auto">
            <Link href="/" legacyBehavior passHref>
                 <SidebarMenuButton tooltip={{children: "התנתקות", side: 'right', align: 'center'}}>
                    <LogOut className="h-5 w-5" />
                    <span>התנתקות</span>
                </SidebarMenuButton>
            </Link>
        </div>
      </Sidebar>
      <SidebarInset className="bg-background">
        <main className="p-4 md:p-6 h-full overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
