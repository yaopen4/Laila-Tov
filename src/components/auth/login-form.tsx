// src/components/auth/login-form.tsx
"use client";

import type { FC } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AppLogo from "@/components/shared/app-logo";
import { useToast } from "@/hooks/use-toast";
import { LogIn } from 'lucide-react';
import { login as authLogin } from '@/lib/auth-service'; // Import the auth service

const LoginForm: FC = () => {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Mock authentication
    setTimeout(() => {
      setIsLoading(false);
      if (username.toLowerCase() === 'coach') {
        authLogin(username.toLowerCase(), 'coach'); // Use authService
        toast({ title: "התחברות הצליחה", description: "ברוך הבא, מאמן/ת!" });
        router.push('/coach/dashboard');
      } else if (username) { // Any other username is a parent
        authLogin(username, 'parent'); // Use authService
        toast({ title: "התחברות הצליחה", description: `ברוך הבא, ${username}!` });
        router.push(`/parent/${username}`); // Use username as a mock babyId
      } else {
        toast({ title: "שגיאה", description: "נא להזין שם משתמש.", variant: "destructive" });
      }
    }, 1000);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-6">
            <AppLogo className="text-5xl" />
          </div>
          <CardTitle className="text-2xl">כניסה למערכת</CardTitle>
          <CardDescription>נא להזין שם משתמש</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username">שם משתמש</Label>
              <Input
                id="username"
                type="text"
                placeholder="לדוגמה: משפחת כהן או coach"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
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
      </Card>
    </div>
  );
};

export default LoginForm;
