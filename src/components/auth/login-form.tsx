
// src/components/auth/login-form.tsx
"use client";

import type { FC } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardDescription, CardFooter } from "@/components/ui/card";
import AppLogo from "@/components/shared/app-logo";
import { useToast } from "@/hooks/use-toast";
import { LogIn } from 'lucide-react';
import { loginWithEmail, sendPasswordReset, type AuthUser } from '@/services/authService';
import { Separator } from '../ui/separator';


const getRedirectPath = (user: AuthUser): string => {
  if (user.role === 'admin') {
    return '/admin/dashboard';
  } else if (user.role === 'coach') {
    return '/coach/dashboard';
  } else if (user.role === 'parent' && user.parentUsername) {
    return `/parent/${user.parentUsername}`;
  }
  console.warn("Could not determine redirect path for user:", user);
  return '/';
};


const LoginForm: FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleDirectLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (password.length < 6) {
      toast({ title: "שגיאה", description: "סיסמה חייבת להכיל לפחות 6 תווים.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    try {
      const loggedInUser = await loginWithEmail(email.toLowerCase(), password);

      if (!loggedInUser || !loggedInUser.role) {
         toast({
          title: "שגיאת התחברות",
          description: "לא ניתן היה לאמת את פרטי המשתמש או תפקידו. אנא פנה לתמיכה.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      if (loggedInUser.role === 'coach' && loggedInUser.status !== 'active') {
        toast({
          title: "חשבון ממתין",
          description: `חשבון היועצת (${loggedInUser.email}) עדיין ממתין לאישור או הפעלת תשלום. אנא פנה למנהל המערכת.`,
          variant: "destructive",
          duration: 7000,
        });
        setIsLoading(false);
        return;
      }

      toast({ title: "התחברות הצליחה", description: `ברוך הבא, ${loggedInUser.name || loggedInUser.email}!` });
      router.push(getRedirectPath(loggedInUser));

    } catch (error: any) {
      console.error("Authentication error:", error);
      let message = "אירעה שגיאה. נא לנסות שוב.";
      if (error.code === 'auth/user-not-found' || 
          error.code === 'auth/wrong-password' || 
          error.code === 'auth/invalid-credential' ||
          error.message?.includes("INVALID_LOGIN_CREDENTIALS")) {
        message = "שם משתמש או סיסמה שגויים.";
      } else if (error.code === 'auth/invalid-email') {
        message = "כתובת האימייל אינה תקינה.";
      } else if (error.message?.includes("User document or role not found")) {
        message = "פרטי המשתמש לא אותרו במערכת. אנא פנה לתמיכה.";
      }
      toast({ title: "שגיאה באימות", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      toast({ title: "צריך אימייל", description: "הכנס אימייל לשחזור סיסמה.", variant: "destructive" });
      return;
    }
    try {
      await sendPasswordReset(email);
      toast({ title: "קישור לאיפוס נשלח", description: "בדוק את תיבת הדואר שלך." });
    } catch (error: any) {
      console.error('Password reset error:', error);
      let message = 'אירעה שגיאה בשליחת קישור האיפוס.';
      if (error.code === 'auth/invalid-email') message = 'כתובת האימייל אינה תקינה.';
      if (error.code === 'auth/user-not-found') message = 'לא נמצא משתמש עם אימייל זה.';
      toast({ title: "שגיאה", description: message, variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-background to-accent/10">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-2">
            <AppLogo className="text-5xl" />
          </div>
           <CardDescription className="text-sm text-muted-foreground">מערכת מעקב שינה לתינוקות</CardDescription>
        </CardHeader>
        <CardContent>
            <h3 className="text-lg font-semibold text-center mb-4">כניסה למערכת</h3>
            <form onSubmit={handleDirectLogin} className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="email-login">אימייל</Label>
                <Input
                id="email-login"
                type="email" 
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="text-right"
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="password-login">סיסמה</Label>
                <Input
                id="password-login"
                type="password"
                placeholder="סיסמה"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="text-right"
                />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "מתחבר..." : "התחבר"}
                {!isLoading && <LogIn className="ms-2 h-4 w-4" />}
            </Button>
            <button type="button" onClick={handlePasswordReset} className="w-full text-sm text-primary hover:underline mt-2">
              שכחת סיסמה?
            </button>
            </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pt-6">
            <Separator />
            <div className="text-center text-sm">
                <p className="text-muted-foreground">משתמש חדש?</p>
                <Link href="/signup" className="font-semibold text-primary hover:underline">
                    הירשם עם קוד הזמנה
                </Link>
            </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default LoginForm;
