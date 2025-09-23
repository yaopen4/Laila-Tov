// Permission-Based Navigation Component
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { 
  Home,
  Users,
  Baby,
  BarChart3,
  Settings,
  Shield,
  Activity,
  Mail,
  LogOut,
  Menu,
  ChevronDown
} from 'lucide-react';
import { AuthService } from '@/services/authService';
import { RoleService } from '@/services/roleService';
import type { AuthUser } from '@/types/auth';

interface NavigationItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  roles?: string[];
  badge?: string;
}

interface NavigationGroup {
  title: string;
  items: NavigationItem[];
}

export function PermissionBasedNavigation() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Define navigation structure with permissions
  const navigationGroups: NavigationGroup[] = [
    {
      title: "ראשי",
      items: [
        {
          title: "דשבורד",
          href: "/dashboard",
          icon: Home,
          roles: ['admin', 'coach', 'parent']
        }
      ]
    },
    {
      title: "ניהול משתמשים",
      items: [
        {
          title: "כל המשתמשים",
          href: "/admin/users",
          icon: Users,
          permission: "users.read.all",
          roles: ['admin']
        },
        {
          title: "הזמנות",
          href: "/admin/invitations",
          icon: Mail,
          permission: "system.manage_invitations",
          roles: ['admin', 'coach']
        },
        {
          title: "תפקידים והרשאות",
          href: "/admin/roles",
          icon: Shield,
          permission: "system.manage_roles",
          roles: ['admin']
        }
      ]
    },
    {
      title: "ניהול תינוקות",
      items: [
        {
          title: "פרופילי תינוקות",
          href: "/babies",
          icon: Baby,
          permission: "babies.read.assigned",
          roles: ['admin', 'coach', 'parent']
        },
        {
          title: "דוחות",
          href: "/reports",
          icon: BarChart3,
          permission: "reports.generate.assigned",
          roles: ['admin', 'coach', 'parent']
        }
      ]
    },
    {
      title: "מערכת",
      items: [
        {
          title: "יומני ביקורת",
          href: "/admin/audit",
          icon: Activity,
          permission: "system.view_audit_logs",
          roles: ['admin']
        },
        {
          title: "הגדרות מערכת",
          href: "/admin/settings",
          icon: Settings,
          permission: "system.manage_organization",
          roles: ['admin']
        }
      ]
    }
  ];

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const currentUser = await AuthService.getCurrentUser();
        setUser(currentUser);
        
        if (currentUser) {
          // Load user permissions
          const permissions = await RoleService.getUserPermissions(currentUser.uid) || 
                            currentUser.permissions || 
                            AuthService.getCachedPermissions();
          setUserPermissions(permissions);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();

    // Listen for auth state changes
    const unsubscribe = AuthService.onAuthStateChanged((user) => {
      setUser(user);
      if (user) {
        loadUserData();
      } else {
        setUserPermissions([]);
      }
    });

    return unsubscribe;
  }, []);

  const hasPermission = (item: NavigationItem): boolean => {
    // Check role-based access
    if (item.roles && !item.roles.includes(user?.role || '')) {
      return false;
    }

    // Check permission-based access
    if (item.permission && !userPermissions.includes(item.permission)) {
      return false;
    }

    return true;
  };

  const handleSignOut = async () => {
    try {
      await AuthService.signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getUserInitials = (user: AuthUser): string => {
    if (user.displayName) {
      return user.displayName.split(' ').map(name => name[0]).join('').toUpperCase();
    }
    return user.email?.charAt(0).toUpperCase() || 'U';
  };

  const getRoleDisplayName = (role: string): string => {
    const roleNames = {
      admin: 'מנהל מערכת',
      coach: 'יועץ שינה',
      parent: 'הורה'
    };
    return roleNames[role] || role;
  };

  const getRedirectPath = (): string => {
    if (!user) return '/login';
    return AuthService.getRedirectPath(user);
  };

  if (isLoading) {
    return (
      <header className="border-b">
        <div className="flex h-16 items-center px-4">
          <div className="animate-pulse flex space-x-4 rtl:space-x-reverse">
            <div className="rounded-full bg-gray-200 h-8 w-8"></div>
            <div className="h-4 bg-gray-200 rounded w-24"></div>
          </div>
        </div>
      </header>
    );
  }

  if (!user) {
    return (
      <header className="border-b">
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/" className="text-lg font-semibold">
            לילה טוב
          </Link>
          <div className="flex space-x-2 rtl:space-x-reverse">
            <Button variant="ghost" asChild>
              <Link href="/login">התחברות</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">הרשמה</Link>
            </Button>
          </div>
        </div>
      </header>
    );
  }

  const NavigationContent = () => (
    <div className="space-y-6">
      {navigationGroups.map((group) => {
        const visibleItems = group.items.filter(hasPermission);
        
        if (visibleItems.length === 0) return null;

        return (
          <div key={group.title}>
            <h3 className="px-4 text-sm font-medium text-muted-foreground mb-2">
              {group.title}
            </h3>
            <nav className="space-y-1">
              {visibleItems.map((item) => {
                const isActive = pathname === item.href;
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between px-4 py-2 text-sm rounded-lg mx-2 transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent hover:text-accent-foreground'
                    }`}
                    onClick={() => setIsMobileOpen(false)}
                  >
                    <div className="flex items-center space-x-3 rtl:space-x-reverse">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </div>
                    {item.badge && (
                      <Badge variant="secondary" className="text-xs">
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        );
      })}
    </div>
  );

  return (
    <header className="border-b bg-white">
      <div className="flex h-16 items-center justify-between px-4">
        {/* Mobile Navigation */}
        <div className="flex items-center space-x-4 rtl:space-x-reverse md:hidden">
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <div className="py-4">
                <NavigationContent />
              </div>
            </SheetContent>
          </Sheet>
          
          <Link href={getRedirectPath()} className="text-lg font-semibold">
            לילה טוב
          </Link>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-8 rtl:space-x-reverse">
          <Link href={getRedirectPath()} className="text-lg font-semibold">
            לילה טוב
          </Link>
          
          <nav className="flex items-center space-x-6 rtl:space-x-reverse">
            {navigationGroups.map((group) => 
              group.items.filter(hasPermission).slice(0, 3).map((item) => {
                const isActive = pathname === item.href;
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center space-x-2 rtl:space-x-reverse text-sm transition-colors ${
                      isActive
                        ? 'text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                    {item.badge && (
                      <Badge variant="secondary" className="text-xs">
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                );
              })
            )}
          </nav>
        </div>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center space-x-2 rtl:space-x-reverse">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.photoURL || undefined} />
                <AvatarFallback>{getUserInitials(user)}</AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start">
                <span className="text-sm font-medium">
                  {user.displayName || user.email}
                </span>
                <span className="text-xs text-muted-foreground">
                  {getRoleDisplayName(user.role)}
                </span>
              </div>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>החשבון שלי</DropdownMenuLabel>
            <DropdownMenuItem>
              <span className="text-sm">
                {user.email}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Badge variant="outline" className="text-xs">
                {getRoleDisplayName(user.role)}
              </Badge>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem asChild>
              <Link href="/profile">
                <Settings className="h-4 w-4 mr-2" />
                הגדרות פרופיל
              </Link>
            </DropdownMenuItem>
            
            {hasPermission({ title: '', href: '', icon: Settings, permission: 'system.view_audit_logs' }) && (
              <DropdownMenuItem asChild>
                <Link href="/admin/audit">
                  <Activity className="h-4 w-4 mr-2" />
                  יומני ביקורת
                </Link>
              </DropdownMenuItem>
            )}
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              התנתק
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

