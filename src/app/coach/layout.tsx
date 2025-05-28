
/**
 * @fileoverview Layout for the coach section of the application.
 * Includes a collapsible sidebar for navigation and implements client-side route protection
 * to ensure only authenticated coaches can access these routes.
 */
"use client";

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
import { LogOut, UserPlus, Users, Archive } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { isCoach, logout as authLogout } from '@/lib/auth-service'; // Import auth service

export default function CoachLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Client-side route protection:
  // Redirect to login if not authenticated as a coach.
  // This runs on component mount and whenever the router object changes.
  useEffect(() => {
    // Ensure this check runs only in the browser
    if (typeof window !== 'undefined' && !isCoach()) {
      router.push('/'); // Redirect to login page
    }
  }, [router]); // Dependency array ensures this runs if router instance changes

  // Navigation items for the coach sidebar
  const navItems = [
    { href: "/coach/dashboard", label: "לוח בקרה", icon: Users },
    { href: "/coach/add-baby", label: "הוספת תינוק", icon: UserPlus },
    { href: "/coach/archive", label: "ארכיון", icon: Archive },
  ];

  /**
   * Handles user logout.
   * Clears authentication state and redirects to the login page.
   */
  const handleLogout = () => {
    authLogout();
    router.push('/');
  };

  // If not a coach (e.g., during initial client-side render before useEffect kicks in,
  // or if JS is disabled, though less relevant for Next.js apps),
  // render null or a loading indicator to prevent content flash.
  // This check relies on localStorage, so it's primarily for client-side rendering.
  if (typeof window !== 'undefined' && !isCoach()) {
    return null; // Or a loading spinner, or a "Redirecting..." message
  }

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" side="right"> {/* Sidebar positioned on the right for RTL */}
        <SidebarHeader>
          <div className="flex items-center justify-between">
             <AppLogo className="text-2xl group-data-[collapsible=icon]:hidden" />
             <SidebarTrigger /> {/* Trigger remains visible when collapsed */}
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href} legacyBehavior passHref>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    tooltip={{ children: item.label, side: 'left', align: 'center' }} // Tooltip on the left
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
              tooltip={{children: "התנתקות", side: 'left', align: 'center'}} // Tooltip on the left
            >
              <LogOut className="h-5 w-5" />
              <span>התנתקות</span>
            </SidebarMenuButton>
        </div>
      </Sidebar>
      {/*
        SidebarInset is the main content area.
        min-w-0 helps flexbox correctly size the content area, especially if content within it resists shrinking.
      */}
      <SidebarInset className="bg-background p-4 md:p-6 overflow-auto min-w-0">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
