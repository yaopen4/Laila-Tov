/**
 * @fileoverview Layout for the coach section of the application.
 * Includes a collapsible sidebar for navigation and route protection.
 */
"use client";

import type { ReactNode } from 'react';
import { useEffect } from 'react'; // Added useEffect
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation'; // Added useRouter
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
import { LogOut, UserPlus, Users, Archive, FileSpreadsheet, FileText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { isCoach, logout as authLogout } from '@/lib/auth-service'; // Import auth service

export default function CoachLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Route protection: Redirect to login if not authenticated as coach
  useEffect(() => {
    if (typeof window !== 'undefined' && !isCoach()) {
      router.push('/');
    }
  }, [router]);


  // Navigation items for the coach sidebar
  const navItems = [
    { href: "/coach/dashboard", label: "לוח בקרה", icon: Users },
    { href: "/coach/add-baby", label: "הוספת תינוק", icon: UserPlus },
    { href: "/coach/archive", label: "ארכיון", icon: Archive },
  ];

  const handleLogout = () => {
    authLogout();
    router.push('/');
  };

  // Placeholder for export functionality
  const handlePlaceholderExport = (type: string) => {
    alert(`פונקציית ייצוא ל-${type} עדיין בפיתוח.`);
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
          </SidebarMenu>
        </SidebarContent>
        <Separator className="my-2" />
         <div className="p-2 mt-auto"> {/* Footer section of sidebar */}
            <SidebarMenuButton 
              onClick={handleLogout} 
              tooltip={{children: "התנתקות", side: 'right', align: 'center'}}
            >
              <LogOut className="h-5 w-5" />
              <span>התנתקות</span>
            </SidebarMenuButton>
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
