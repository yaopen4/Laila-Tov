
// src/components/auth/signup-form.tsx
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
import { UserPlus } from 'lucide-react';
import { Separator } from "@/components/ui/separator";
import { AuthService, type AuthUser } from '@/services/authService';
import { InvitationService } from '@/services/invitationService';

const getRedirectPath = (user: AuthUser): string => {
  if (user.role === 'admin') {
    return '/admin/dashboard';
  } else if (user.role === 'coach') {
    return '/coach/dashboard';
  } else if (user.role === 'parent' && user.managedBabyProfiles && user.managedBabyProfiles.length > 0) {
    return `/parent/${user.managedBabyProfiles[0]}`;
  }
  console.warn("Could not determine redirect path for user:", user);
  return '/';
};

const SignUpForm: FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<{ state: 'idle' | 'validating' | 'valid' | 'invalid'; message?: string }>({ state: 'idle' });
  const router = useRouter();
  const { toast } = useToast();

  const handleInviteRedemption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
        toast({ title: "שגיאה", description: "סיסמה חייבת להכיל לפחות 6 תווים.", variant: "destructive" });
        return;
    }
    if (!name) {
        toast({ title: "שגיאה", description: "שם הוא שדה חובה.", variant: "destructive" });
        return;
    }
    if (!inviteCode) {
        toast({ title: "שגיאה", description: "קוד הזמנה הוא שדה חובה.", variant: "destructive" });
        return;
    }
    setIsLoading(true);

    try {
      // Prevalidate invitation
      setInviteStatus({ state: 'validating' });
      const validator = new InvitationService();
      const pre = await validator.prevalidateInvitation(inviteCode, email);
      if (!pre.isValid) {
        setInviteStatus({ state: 'invalid', message: pre.reason || 'קוד הזמנה לא תקין' });
        throw new Error(pre.reason || 'Invalid invitation');
      }
      setInviteStatus({ state: 'valid' });

      // Use authentication service
      const result = await AuthService.registerWithInvitation(
        inviteCode,
        email,
        password,
        name
      );
      
      if (!result.success || !result.user) {
        throw new Error(result.error || 'Registration failed');
      }
      
      const authUser = result.user;
      
      // Determine welcome message based on role
      const welcomeMessage = authUser.role === 'parent' 
        ? `ברוך הבא! חשבונך כהורה פעיל כעת.` 
        : authUser.role === 'coach'
        ? `ברוכה הבאה, ${name}! חשבונך כיועצת פעיל כעת.`
        : `ברוך הבא, ${name}! חשבונך כמנהל מערכת פעיל כעת.`;
      
      toast({ title: "רישום הושלם!", description: welcomeMessage });
      
      router.push(getRedirectPath(authUser));

    } catch (error: any) {
      console.error("Registration error:", error);
      let message = "אירעה שגיאה ברישום. נסה שוב.";
      
      if (error.code === 'auth/email-already-in-use') {
        message = "כתובת אימייל זו כבר רשומה. נסה להתחבר או להשתמש באימייל אחר.";
      } else if (error.code === 'auth/weak-password') {
        message = "הסיסמה חלשה מדי. אנא בחר סיסמה חזקה יותר (לפחות 6 תווים).";
      } else if (error.message?.includes('Invalid invitation code')) {
        message = "קוד ההזמנה שהוזן אינו תקין או שכתובת האימייל אינה תואמת להזמנה.";
      } else if (error.message?.includes('expired')) {
        message = "ההזמנה פגה.";
      } else if (error.message?.includes('revoked') || error.message?.includes('cancelled')) {
        message = "ההזמנה בוטלה.";
      } else if (error.message?.includes('fully redeemed') || error.message?.includes('already been accepted')) {
        message = "קוד הזמנה זה כבר נוצל.";
      } else if (error.message?.includes('Failed to activate')) {
        message = "נכשל בהפעלת החשבון. אנא נסה שוב או פנה לתמיכה.";
      } else if (error.message?.includes('User with this email already exists')) {
        message = "משתמש עם כתובת אימייל זו כבר קיים במערכת.";
      }
      
      toast({ title: "שגיאה ברישום", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Live validation on blur of invitation code
  const handleInviteBlur = async () => {
    if (!inviteCode || !email) return;
    setInviteStatus({ state: 'validating' });
    try {
      const validator = new InvitationService();
      const pre = await validator.prevalidateInvitation(inviteCode, email);
      if (pre.isValid) {
        setInviteStatus({ state: 'valid' });
      } else {
        setInviteStatus({ state: 'invalid', message: pre.reason });
      }
    } catch (err) {
      setInviteStatus({ state: 'invalid', message: 'שגיאה בבדיקת הקוד' });
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
          <h3 className="text-lg font-semibold text-center mb-4">יצירת חשבון חדש</h3>
          <form onSubmit={handleInviteRedemption} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="signup-name">שם מלא</Label>
              <Input
                id="signup-name"
                type="text"
                placeholder="שם פרטי ומשפחה"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email">אימייל</Label>
              <Input
                id="signup-email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password">סיסמה אישית</Label>
              <Input
                id="signup-password"
                type="password"
                placeholder="לפחות 6 תווים"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-invite-code">קוד הזמנה</Label>
              <Input
                id="signup-invite-code"
                type="text"
                placeholder="הקוד שקיבלת מהיועצת או המנהל"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                onBlur={handleInviteBlur}
                required
              />
              {inviteStatus.state === 'validating' && (
                <p className="text-xs text-muted-foreground">בודק את הקוד…</p>
              )}
              {inviteStatus.state === 'valid' && (
                <p className="text-xs text-emerald-600">קוד הזמנה תקין ✔</p>
              )}
              {inviteStatus.state === 'invalid' && (
                <p className="text-xs text-destructive">{inviteStatus.message || 'קוד הזמנה לא תקין'}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "יוצר חשבון..." : "הירשם והתחבר"}
              {!isLoading && <UserPlus className="ms-2 h-4 w-4" />}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pt-6">
            <Separator />
            <div className="text-center text-sm">
                <p className="text-muted-foreground">חשבון קיים?</p>
                <Link href="/" className="font-semibold text-primary hover:underline">
                    חזור למסך הכניסה
                </Link>
            </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default SignUpForm;
