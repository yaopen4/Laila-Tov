
// src/components/auth/login-form.tsx
"use client";

import type { FC } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import AppLogo from "@/components/shared/app-logo";
import { useToast } from "@/hooks/use-toast";
import { LogIn } from 'lucide-react';
import { login, isCoachUser } from '@/services/authService';


const LoginForm: FC = () => {
  const [emailInput, setEmailInput] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    let authEmail = emailInput;
    // If the input doesn't contain "@", assume it's a parent's username and append domain
    if (!emailInput.includes('@') && emailInput.trim() !== '') {
      authEmail = `${emailInput.toLowerCase()}@lailatov.app`;
    } else {
      authEmail = emailInput.toLowerCase();
    }
    
     if (password.length < 6) {
        toast({ title: "שגיאה", description: "סיסמה חייבת להכיל לפחות 6 תווים.", variant: "destructive" });
        setIsLoading(false);
        return;
    }

    try {
      // Only login functionality is present now
      const userCredential = await login(authEmail, password);
      const user = userCredential.user;
      
      if (isCoachUser(user)) {
        toast({ title: "התחברות הצליחה", description: "ברוכה הבאה, יועצת!" });
        router.push('/coach/dashboard');
      } else if (user.email?.endsWith('@lailatov.app')) {
        const parentUsername = user.email.split('@')[0];
        toast({ title: "התחברות הצליחה", description: `ברוך הבא, ${parentUsername}!` });
        router.push(`/parent/${parentUsername}`);
      } else {
        // This case should ideally not be reached if usernames are correctly mapped or coach email is used
        toast({ title: "שגיאה", description: "משתמש לא מזוהה.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Authentication error:", error);
      let message = "אירעה שגיאה. נא לנסות שוב.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = "שם משתמש/אימייל או סיסמה שגויים.";
      } else if (error.code === 'auth/invalid-email') {
        message = "שם המשתמש או האימייל אינם תקינים.";
      }
      toast({ title: "שגיאה באימות", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-6">
            <AppLogo className="text-5xl" />
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-6 pt-4">
            <CardTitle className="text-center text-2xl">כניסה למערכת</CardTitle>
            {/* CardDescription removed */}
            <div className="space-y-2">
              <Label htmlFor="email-login">שם משתמש / אימייל</Label>
              <Input
                id="email-login"
                type="text"
                placeholder="לדוגמה: משפחת כהן או coach@lailatov.app"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
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
              {isLoading ? "מתחבר..." : "כניסה"}
              {!isLoading && <LogIn className="ms-2 h-4 w-4" />}
            </Button>
          </form>
        </CardContent>
         {/* CardFooter removed */}
      </Card>
    </div>
  );
};

export default LoginForm;

