
// src/components/auth/login-form.tsx
"use client";

import type { FC } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import AppLogo from "@/components/shared/app-logo";
import { useToast } from "@/hooks/use-toast";
import { LogIn, UserPlus, Briefcase } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { loginWithEmail, registerWithEmail, type AuthUser } from '@/services/authService';
import type { Invite } from '@/types';
import { getInviteByCodeFromFirestore, redeemInvitePartially } from '@/services/inviteService';
import { createCoachProfile } from '@/services/coachService';


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
  const [activeTab, setActiveTab] = useState("login");

  // State for all form types
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [name, setName] = useState('');


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

  const handleInviteRedemption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
        toast({ title: "שגיאה", description: "סיסמה חייבת להכיל לפחות 6 תווים.", variant: "destructive" });
        return;
    }
    setIsLoading(true);

    try {
      const invite = await getInviteByCodeFromFirestore(inviteCode);
      if (!invite) {
        toast({ title: "קוד הזמנה לא תקין", description: "הקוד שהוזן לא נמצא או שכבר נעשה בו שימוש.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      if (invite.status === 'completed' || new Date() > new Date(invite.expiresAt.toDate())) {
        toast({ title: "הזמנה לא זמינה", description: "ההזמנה פגה או שכבר הושלמה.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      
      const normalizedEmail = email.toLowerCase();
      // For parent invites, parentEmails will be an array. For coaches, it might be a single string or an array with one email.
      // Let's ensure parentEmails is always treated as an array in the invite document.
      const authorizedEmails = Array.isArray(invite.parentEmails) ? invite.parentEmails : [invite.parentEmails];
      if (!authorizedEmails.includes(normalizedEmail)) {
        toast({ title: "אימייל לא תואם", description: "כתובת האימייל שהוזנה אינה תואמת להזמנה.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      if (invite.usedBy.some(user => user.email === normalizedEmail)) {
         toast({ title: "אימייל כבר בשימוש", description: "כתובת אימייל זו כבר ניצלה הזמנה זו.", variant: "destructive" });
         setIsLoading(false);
         return;
      }

      // Determine the role from the invite itself, defaulting to parent
      const role = invite.babyData ? 'parent' : 'coach'; 
      const displayName = role === 'coach' ? name : (email.split('@')[0] || "Parent");

      const authUser = await registerWithEmail(
        normalizedEmail,
        password,
        displayName, 
        role,
        'active', // Invites grant active status directly
        invite
      );
      
      // If it's a coach, also create their specific profile
      if (role === 'coach') {
        await createCoachProfile(authUser.uid, normalizedEmail, displayName, 'active');
      }

      await redeemInvitePartially(invite.id, authUser.uid, normalizedEmail);

      const welcomeMessage = role === 'parent' 
        ? `ברוך הבא! התינוק ${invite.babyData.name} קושר לחשבונך.` 
        : `ברוכה הבאה, ${displayName}! חשבונך כיועצת פעיל כעת.`;
      toast({ title: "רישום הושלם!", description: welcomeMessage });
      
      router.push(getRedirectPath(authUser));

    } catch (error: any) {
      console.error("Invite redemption error:", error);
      let message = "אירעה שגיאה ברישום. נסה שוב.";
       if (error.code === 'auth/email-already-in-use') {
        message = "כתובת אימייל זו כבר רשומה. נסה להתחבר או להשתמש באימייל אחר.";
      } else if (error.code === 'auth/weak-password') {
        message = "הסיסמה חלשה מדי. אנא בחר סיסמה חזקה יותר (לפחות 6 תווים).";
      } else if (error.message?.includes('not found')) {
        message = "קוד ההזמנה שהוזן אינו תקין."
      } else if (error.message?.includes('fully redeemed') || error.message?.includes('completed')) {
        message = "קוד הזמנה זה כבר נוצל במלואו."
      } else if (error.message?.includes('expired')) {
        message = "ההזמנה פגה."
      } else if (error.message?.includes('Email does not match')) {
        message = "כתובת האימייל אינה תואמת להזמנה זו."
      } else if (error.message?.includes('already redeemed')) {
        message = "כתובת אימייל זו כבר ניצלה הזמנה זו."
      }
      toast({ title: "שגיאה ברישום", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
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
          <Separator className="my-4" />
          <h3 className="text-lg font-semibold text-center mb-4">התחבר בתור</h3>
          
          <Tabs defaultValue="login" className="w-full" onValueChange={() => {
            // Reset fields on tab change
            setEmail('');
            setPassword('');
            setInviteCode('');
            setName('');
          }}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="login">כניסה</TabsTrigger>
              <TabsTrigger value="parent-invite">הורה עם קוד</TabsTrigger>
              <TabsTrigger value="coach-invite">יועצת עם קוד</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="pt-6">
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
              </form>
            </TabsContent>

            <TabsContent value="parent-invite" className="pt-6">
               <form onSubmit={handleInviteRedemption} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="parent-email-invite">אימייל (של ההורה)</Label>
                  <Input
                    id="parent-email-invite"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parent-invite-code">קוד הזמנה</Label>
                  <Input
                    id="parent-invite-code"
                    type="text"
                    placeholder="קוד שקיבלת מהיועצת"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parent-password-invite">סיסמה</Label>
                  <Input
                    id="parent-password-invite"
                    type="password"
                    placeholder="לפחות 6 תווים"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "מעבד..." : "המשך עם קוד"}
                  {!isLoading && <UserPlus className="ms-2 h-4 w-4" />}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="coach-invite" className="pt-6">
              <form onSubmit={handleInviteRedemption} className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="coach-name-invite">שם מלא</Label>
                    <Input
                      id="coach-name-invite"
                      type="text"
                      placeholder="שם פרטי ומשפחה"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coach-email-invite">אימייל (של היועצת)</Label>
                  <Input
                    id="coach-email-invite"
                    type="email"
                    placeholder="your.coach@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coach-invite-code">קוד הזמנה</Label>
                  <Input
                    id="coach-invite-code"
                    type="text"
                    placeholder="קוד שקיבלת מהמנהל"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coach-password-invite">סיסמה</Label>
                  <Input
                    id="coach-password-invite"
                    type="password"
                    placeholder="לפחות 6 תווים"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "רושם..." : "הירשמי עם קוד"}
                  {!isLoading && <Briefcase className="ms-2 h-4 w-4" />}
                </Button>
              </form>
            </TabsContent>

          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginForm;
