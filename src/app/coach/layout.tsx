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
import { LogOut, UserPlus, Users, Archive } from 'lucide-react'; // Removed FileSpreadsheet, FileText as they are not used here directly
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

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" side="right"> {/* Changed side to "right" */}
        <SidebarHeader>
          <div className="flex items-center justify-between"> 
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
                    tooltip={{ children: item.label, side: 'left', align: 'center' }} // Changed tooltip side to "left"
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
              tooltip={{children: "התנתקות", side: 'left', align: 'center'}} // Changed tooltip side to "left"
            >
              <LogOut className="h-5 w-5" />
              <span>התנתקות</span>
            </SidebarMenuButton>
        </div>
      </Sidebar>
      {/* Added min-w-0 to help flexbox correctly size the content area */}
      <SidebarInset className="bg-background p-4 md:p-6 overflow-auto min-w-0">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
