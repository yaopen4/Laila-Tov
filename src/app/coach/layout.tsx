
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
import { LogOut, UserPlus, Users, Archive, FileText, FileSpreadsheet } from 'lucide-react'; // Added FileSpreadsheet
import { Separator } from '@/components/ui/separator';

export default function CoachLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { href: "/coach/dashboard", label: "לוח בקרה", icon: Users },
    { href: "/coach/add-baby", label: "הוספת תינוק", icon: UserPlus },
    { href: "/coach/archive", label: "ארכיון", icon: Archive },
  ];

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center justify-between p-2">
             <AppLogo className="text-2xl group-data-[collapsible=icon]:hidden" />
             {/* Removed group-data-[collapsible=icon]:hidden from SidebarTrigger to allow re-expanding */}
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
                onClick={() => alert('ייצוא CSV (לא מיושם)')} // Placeholder action
                tooltip={{ children: 'ייצוא CSV', side: 'right', align: 'center' }}
              >
                <FileSpreadsheet className="h-5 w-5" /> {/* Changed icon */}
                <span>ייצוא CSV</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => alert('ייצוא PDF (לא מיושם)')} // Placeholder action
                tooltip={{ children: 'ייצוא PDF', side: 'right', align: 'center' }}
              >
                <FileText className="h-5 w-5" /> {/* Kept FileText for PDF */}
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
