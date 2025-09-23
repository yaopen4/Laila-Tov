
/**
 * @fileoverview Layout for the consultant section of the application.
 * Includes a collapsible sidebar for navigation and implements client-side route protection
 * to ensure only authenticated consultants can access these routes using Firebase Auth.
 */
"use client";

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
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
import { LogOut, UserPlus, Users, Archive, FileText, FileSpreadsheet, User, Baby, Calendar, BarChart3, Settings } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { AuthService, type AuthUser } from '@/services/authService';
import { useToast } from '@/hooks/use-toast';

export default function CoachLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Client-side route protection:
  // Redirect to login if not authenticated as a coach.
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await AuthService.getCurrentUser();
        setCurrentUser(user);
        setIsLoadingAuth(false);
        if (!user || user.role !== 'coach') {
          router.push('/');
        }
      } catch (error) {
        console.error("Auth check error:", error);
        setIsLoadingAuth(false);
        router.push('/');
      }
    };

    checkAuth();
  }, [router]);

  // Navigation items for the consultant sidebar
  const navItems = [
    { href: "/coach/dashboard", label: "לוח בקרה", icon: Users },
    { href: "/coach/add-baby", label: "הוספת תינוק", icon: UserPlus },
    { href: "/coach/babies", label: "ניהול תינוקות", icon: Baby },
    { href: "/coach/calendar", label: "יומן פגישות", icon: Calendar },
    { href: "/coach/reports", label: "דוחות וניתוח", icon: BarChart3 },
    { href: "/coach/archive", label: "ארכיון", icon: Archive },
    { href: "/coach/settings", label: "הגדרות", icon: Settings },
  ];

  /**
   * Handles user logout.
   * Clears authentication state and redirects to the login page.
   */
  const handleLogout = async () => {
    try {
      await AuthService.signOut();
      toast({ title: "התנתקת בהצלחה" });
      router.push('/');
    } catch (error) {
      console.error("Logout error:", error);
      toast({ title: "שגיאה בהתנתקות", variant: "destructive" });
    }
  };

  if (isLoadingAuth) {
    // Optional: Render a loading spinner or skeleton UI
    return <div className="flex justify-center items-center min-h-screen"><p>טוען...</p></div>;
  }

  // If user is null after auth check or not a coach, content will not render due to redirect.
  // This check can be an additional safeguard or for cases where redirect hasn't completed.
  if (!currentUser || currentUser.role !== 'coach') {
    return null;
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
                    tooltip={{ children: item.label, side: 'left', align: 'center' }}
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
        {/* Coach information section */}
        <div className="p-2 border-b border-border/50">
          <div className="flex items-center gap-3 px-2 py-1 text-sm text-muted-foreground group-data-[collapsible=icon]:justify-center">
            <User className="h-4 w-4 shrink-0" />
            <div className="truncate group-data-[collapsible=icon]:hidden">
              <div className="font-medium text-foreground truncate" title={currentUser?.name || ''}>
                {currentUser?.name || 'לא זמין'}
              </div>
              <div className="text-xs truncate" title={currentUser?.email || ''}>
                {currentUser?.email || 'לא זמין'}
              </div>
            </div>
          </div>
        </div>
         <div className="p-2 mt-auto"> {/* Footer section of sidebar */}
            <SidebarMenuButton
              onClick={handleLogout}
              tooltip={{children: "התנתקות", side: 'left', align: 'center'}}
            >
              <LogOut className="h-5 w-5" />
              <span>התנתקות</span>
            </SidebarMenuButton>
        </div>
      </Sidebar>
      <SidebarInset className="bg-background p-4 md:p-6 overflow-auto min-w-0">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
