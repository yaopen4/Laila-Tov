/**
 * @fileoverview Layout for the admin section of the application.
 * Includes a simple sidebar for navigation and implements client-side route protection
 * to ensure only authenticated admins can access these routes.
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
import { LogOut, LayoutDashboard, MailPlus, Users, Shield, FileText, Settings, UserCheck, TestTube, ClipboardCheck, FileCode } from 'lucide-react';
import { AuthService, type AuthUser } from '@/services/authService';
import { useToast } from '@/hooks/use-toast';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Client-side route protection:
  // Redirect to login if not authenticated as an admin.
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await AuthService.getCurrentUser();
        setCurrentUser(user);
        setIsLoadingAuth(false);
        if (!user || user.role !== 'admin') {
          toast({
              title: "גישה נדחתה",
              description: "עליך להתחבר כמנהל מערכת כדי לצפות בדף זה.",
              variant: "destructive"
          });
          router.push('/');
        }
      } catch (error) {
        console.error("Auth check error:", error);
        setIsLoadingAuth(false);
        router.push('/');
      }
    };

    checkAuth();
  }, [router, toast]);

  // Navigation items for the admin sidebar
  const navItems = [
    { href: "/admin/dashboard", label: "לוח בקרה", icon: LayoutDashboard },
    { href: "/admin/users", label: "ניהול משתמשים", icon: Users },
    { href: "/admin/roles", label: "ניהול תפקידים", icon: Shield },
    { href: "/admin/manual-invitations", label: "הזמנות ידניות", icon: ClipboardCheck },
    { href: "/admin/email-invitations", label: "הזמנות אימייל", icon: MailPlus },
    { href: "/admin/email-templates", label: "תבניות אימייל", icon: FileCode },
    { href: "/admin/audit", label: "יומן ביקורת", icon: FileText },
    { href: "/admin/settings", label: "הגדרות מערכת", icon: Settings },
    { href: "/admin/test-manual-invitations", label: "בדיקת הזמנות ידניות", icon: TestTube },
  ];

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
    return <div className="flex justify-center items-center min-h-screen"><p>טוען...</p></div>;
  }

  if (!currentUser || currentUser.role !== 'admin') {
    return null; // Render nothing while redirecting
  }
  
  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" side="right">
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
        <div className="p-2 mt-auto">
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
