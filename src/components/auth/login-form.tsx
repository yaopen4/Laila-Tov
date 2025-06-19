
// src/components/auth/login-form.tsx
"use client";

import type { FC } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import AppLogo from "@/components/shared/app-logo";
import { useToast } from "@/hooks/use-toast";
import { LogIn, UserPlus, Users, Briefcase } from 'lucide-react'; // Added Briefcase for coach icon
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { loginWithEmail, registerWithEmail, type AuthUser, type UserDoc } from '@/services/authService';
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

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Parent Sign up with Invite state
  const [inviteCode, setInviteCode] = useState('');
  const [parentEmailForInvite, setParentEmailForInvite] = useState('');
  const [parentPasswordForInvite, setParentPasswordForInvite] = useState('');
  // Removed parentNameForInvite and parentConfirmPasswordForInvite states


  // Coach Registration state
  const [coachName, setCoachName] = useState('');
  const [coachEmail, setCoachEmail] = useState('');
  const [coachPassword, setCoachPassword] = useState('');
  const [coachConfirmPassword, setCoachConfirmPassword] = useState('');
  const [isCoachRegistrationDialogOpen, setIsCoachRegistrationDialogOpen] = useState(false);


  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleDirectLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (loginPassword.length < 6) {
      toast({ title: "שגיאה", description: "סיסמה חייבת להכיל לפחות 6 תווים.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    try {
      const loggedInUser = await loginWithEmail(loginEmail.toLowerCase(), loginPassword);

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

  const handleParentSignUpWithInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    // Removed password confirmation check
    if (parentPasswordForInvite.length < 6) {
        toast({ title: "שגיאה", description: "סיסמה חייבת להכיל לפחות 6 תווים.", variant: "destructive" });
        return;
    }
    setIsLoading(true);

    try {
      const invite = await getInviteByCodeFromFirestore(inviteCode);
      if (!invite) {
        toast({ title: "קוד הזמנה לא תקין", description: "הקוד שהוזן לא נמצא או שכבר נעשה בו שימוש מלא.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      if (invite.status === 'completed' || new Date() > new Date(invite.expiresAt.toDate())) {
        toast({ title: "הזמנה לא זמינה", description: "ההזמנה פגה או שכבר הושלמה.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      
      const normalizedParentEmail = parentEmailForInvite.toLowerCase();
      if (!invite.parentEmails.includes(normalizedParentEmail)) {
        toast({ title: "אימייל לא תואם", description: "כתובת האימייל שהוזנה אינה תואמת להזמנה.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      if (invite.usedBy.some(user => user.email === normalizedParentEmail)) {
         toast({ title: "אימייל כבר בשימוש", description: "כתובת אימייל זו כבר ניצלה הזמנה זו.", variant: "destructive" });
         setIsLoading(false);
         return;
      }

      // Derive name from email for registration
      const parentNameFromEmail = parentEmailForInvite.split('@')[0] || "Parent";

      const authUser = await registerWithEmail(
        normalizedParentEmail,
        parentPasswordForInvite,
        parentNameFromEmail, // Use derived name
        'parent',
        'active',
        invite
      );

      await redeemInvitePartially(invite.id, authUser.uid, normalizedParentEmail);

      toast({ title: "רישום הורים הושלם!", description: `ברוך הבא, ${parentNameFromEmail}! התינוק ${invite.babyData.name} קושר לחשבונך.` });
      router.push(getRedirectPath(authUser));

    } catch (error: any) {
      console.error("Parent sign up error:", error);
      let message = "אירעה שגיאה ברישום. נסה שוב.";
      if (error.code === 'auth/email-already-in-use') {
        message = "כתובת אימייל זו כבר רשומה. נסה להתחבר או להשתמש באימייל אחר.";
      } else if (error.code === 'auth/weak-password') {
        message = "הסיסמה חלשה מדי. אנא בחר סיסמה חזקה יותר (לפחות 6 תווים).";
      } else if (error.message?.includes('Invite code not found')) {
        message = "קוד ההזמנה שהוזן אינו תקין."
      } else if (error.message?.includes('already fully redeemed')) {
        message = "קוד הזמנה זה כבר נוצל במלואו."
      } else if (error.message?.includes('invite has expired')) {
        message = "ההזמנה פגה."
      } else if (error.message?.includes('Email does not match')) {
        message = "כתובת האימייל אינה תואמת להזמנה זו."
      } else if (error.message?.includes('already redeemed this invite')) {
        message = "כתובת אימייל זו כבר ניצלה הזמנה זו."
      }
      toast({ title: "שגיאה ברישום הורים", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };


  const handleCoachRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (coachPassword !== coachConfirmPassword) {
      toast({ title: "שגיאה", description: "הסיסמאות אינן תואמות.", variant: "destructive" });
      return;
    }
     if (coachPassword.length < 6) {
        toast({ title: "שגיאה", description: "סיסמה חייבת להכיל לפחות 6 תווים.", variant: "destructive" });
        return;
    }
    setIsLoading(true);

    try {
      const normalizedCoachEmail = coachEmail.toLowerCase();
      const authUser = await registerWithEmail(
        normalizedCoachEmail,
        coachPassword,
        coachName,
        'coach',
        'active' 
      );
      
      await createCoachProfile(authUser.uid, normalizedCoachEmail, coachName, 'pending_approval');


      toast({ title: "רישום יועצת הצליח!", description: `ברוכה הבאה, ${coachName}! חשבונך נוצר וממתין לאישור מנהל.` });
      setIsCoachRegistrationDialogOpen(false); 
      setActiveTab("login"); 
      setLoginEmail(normalizedCoachEmail); 
      setLoginPassword('');
      
      setCoachName('');
      setCoachEmail('');
      setCoachPassword('');
      setCoachConfirmPassword('');


    } catch (error: any) {
      console.error("Coach registration error:", error);
      let message = "אירעה שגיאה ברישום. נסה שוב.";
      if (error.code === 'auth/email-already-in-use') {
        message = "כתובת אימייל זו כבר רשומה. נסה להתחבר או להשתמש באימייל אחר.";
      } else if (error.code === 'auth/weak-password') {
        message = "הסיסמה חלשה מדי. אנא בחר סיסמה חזקה יותר (לפחות 6 תווים).";
      }
      toast({ title: "שגיאה ברישום יועצת", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-background to-accent/10">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4">
            <AppLogo className="text-5xl" />
          </div>
           <CardTitle className="text-3xl font-bold">לילה טוב</CardTitle>
           <CardDescription>מערכת מעקב שינה לתינוקות</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">התחברות</TabsTrigger>
              <TabsTrigger value="parent-code">הורה עם קוד</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="pt-6">
              <form onSubmit={handleDirectLogin} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email-login">אימייל</Label>
                  <Input
                    id="email-login"
                    type="email" 
                    placeholder="your@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
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
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
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

            <TabsContent value="parent-code" className="pt-6">
              <form onSubmit={handleParentSignUpWithInvite} className="space-y-6">
                 {/* Removed Parent Name Field */}
                <div className="space-y-2">
                  <Label htmlFor="parent-email-invite">אימייל (של ההורה)</Label>
                  <Input
                    id="parent-email-invite"
                    type="email"
                    placeholder="your@email.com"
                    value={parentEmailForInvite}
                    onChange={(e) => setParentEmailForInvite(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-code">קוד הזמנה</Label>
                  <Input
                    id="invite-code"
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
                    value={parentPasswordForInvite}
                    onChange={(e) => setParentPasswordForInvite(e.target.value)}
                    required
                  />
                </div>
                {/* Removed Confirm Password Field */}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "מעבד..." : "המשך עם קוד"}
                  {!isLoading && <UserPlus className="ms-2 h-4 w-4" />}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isCoachRegistrationDialogOpen} onOpenChange={setIsCoachRegistrationDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="link" className="mt-6 text-primary hover:text-primary/80">
            <Briefcase className="me-2 h-4 w-4" />
            מעוניינ/ת להצטרף כיועצת? הירשמ/י כאן
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>רישום יועצת שינה</DialogTitle>
            <DialogDescription>
              מלא/י את הפרטים להגשת בקשת הצטרפות. חשבונך יעבור אישור מנהל.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCoachRegistration} className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="coach-name-dialog" className="text-right col-span-1">
                שם מלא
              </Label>
              <Input
                id="coach-name-dialog"
                type="text"
                placeholder="שם פרטי ומשפחה"
                value={coachName}
                onChange={(e) => setCoachName(e.target.value)}
                required
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="coach-email-dialog" className="text-right col-span-1">
                אימייל
              </Label>
              <Input
                id="coach-email-dialog"
                type="email"
                placeholder="your.coach@email.com"
                value={coachEmail}
                onChange={(e) => setCoachEmail(e.target.value)}
                required
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="coach-password-dialog" className="text-right col-span-1">
                סיסמה
              </Label>
              <Input
                id="coach-password-dialog"
                type="password"
                placeholder="לפחות 6 תווים"
                value={coachPassword}
                onChange={(e) => setCoachPassword(e.target.value)}
                required
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="coach-confirm-password-dialog" className="text-right col-span-1">
                אימות סיסמה
              </Label>
              <Input
                id="coach-confirm-password-dialog"
                type="password"
                placeholder="הקלד/י סיסמה שוב"
                value={coachConfirmPassword}
                onChange={(e) => setCoachConfirmPassword(e.target.value)}
                required
                className="col-span-3"
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "רושם..." : "הירשמי כיועצת"}
                {!isLoading && <Users className="ms-2 h-4 w-4" />}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoginForm;
