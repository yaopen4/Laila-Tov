
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
import { LogIn, UserPlus } from 'lucide-react';
import { login, signUp, isCoachUser } from '@/services/authService'; // Import the Firebase auth service
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"


const LoginForm: FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false); // To toggle between login and sign up
  const router = useRouter();
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Basic email validation
    if (!email.includes('@')) {
        toast({ title: "שגיאה", description: "נא להזין כתובת אימייל תקינה.", variant: "destructive" });
        setIsLoading(false);
        return;
    }
     if (password.length < 6) {
        toast({ title: "שגיאה", description: "סיסמה חייבת להכיל לפחות 6 תווים.", variant: "destructive" });
        setIsLoading(false);
        return;
    }


    try {
      let userCredential;
      if (isSignUp) {
        userCredential = await signUp(email, password);
        toast({ title: "הרשמה הצליחה", description: "כעת ניתן להתחבר." });
        setIsSignUp(false); // Switch to login tab after successful sign up
      } else {
        userCredential = await login(email, password);
        const user = userCredential.user;
        
        if (isCoachUser(user)) {
          toast({ title: "התחברות הצליחה", description: "ברוכה הבאה, יועצת!" });
          router.push('/coach/dashboard');
        } else if (user.email?.endsWith('@lailatov.app')) {
          const parentUsername = user.email.split('@')[0];
          toast({ title: "התחברות הצליחה", description: `ברוך הבא, ${parentUsername}!` });
          router.push(`/parent/${parentUsername}`);
        } else {
           // This case should ideally not be reached if emails are structured correctly
          toast({ title: "שגיאה", description: "משתמש לא מזוהה.", variant: "destructive" });
        }
      }
    } catch (error: any) {
      console.error("Authentication error:", error);
      let message = "אירעה שגיאה. נא לנסות שוב.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        message = "אימייל או סיסמה שגויים.";
      } else if (error.code === 'auth/email-already-in-use') {
        message = "כתובת אימייל זו כבר רשומה.";
      } else if (error.code === 'auth/invalid-email') {
        message = "כתובת אימייל אינה תקינה.";
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
          <Tabs defaultValue="login" className="w-full" onValueChange={(value) => setIsSignUp(value === 'signup')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">כניסה</TabsTrigger>
              <TabsTrigger value="signup">הרשמה</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={handleAuth} className="space-y-6 pt-4">
                <CardDescription className="text-center pb-2">התחברות למערכת</CardDescription>
                <div className="space-y-2">
                  <Label htmlFor="email-login">אימייל</Label>
                  <Input
                    id="email-login"
                    type="email"
                    placeholder="your-username@lailatov.app"
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
                  {isLoading ? "מתחבר..." : "כניסה"}
                  {!isLoading && <LogIn className="ms-2 h-4 w-4" />}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleAuth} className="space-y-6 pt-4">
                <CardDescription className="text-center pb-2">
                  יועצת: יש להירשם עם האימייל `coach@lailatov.app`.
                  <br />
                  הורים: יש להירשם עם אימייל במבנה `[שםמשתמשהורים]@lailatov.app`.
                </CardDescription>
                <div className="space-y-2">
                  <Label htmlFor="email-signup">אימייל</Label>
                  <Input
                    id="email-signup"
                    type="email"
                    placeholder="your-username@lailatov.app"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="text-right"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-signup">סיסמה</Label>
                  <Input
                    id="password-signup"
                    type="password"
                    placeholder="סיסמה (לפחות 6 תווים)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="text-right"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "יוצר חשבון..." : "הרשמה"}
                  {!isLoading && <UserPlus className="ms-2 h-4 w-4" />}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
         <CardFooter className="text-xs text-muted-foreground text-center block pt-4">
            <p>הורים: שם המשתמש לאימייל (`[שםמשתמשהורים]`) הוא זה שהוגדר על ידי היועצת בעת יצירת פרופיל התינוק.</p>
            <p>לדוגמה: אם שם המשתמש שלכם הוא `cohen-family`, הירשמו עם האימייל `cohen-family@lailatov.app`.</p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default LoginForm;
