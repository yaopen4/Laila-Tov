/**
 * @fileoverview Admin page for creating and managing user invite codes.
 * Allows admins to generate separate invites for coaches and parents.
 */
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { getAllCoachUsers, ensureAdminAccess } from '@/services/authService';
import { getCoachProfile, getUser } from '@/services/coachService';
import { createInviteInFirestore, getInviteByCodeFromFirestore, updateInviteInFirestore } from '@/services/inviteService';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Invite, User } from '@/types';
import type { Baby } from '@/types';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';

export default function AdminInvitesPage() {
  // State for invite creation
  const [role, setRole] = useState<'coach' | 'parent'>('coach');
  const [emails, setEmails] = useState<string[]>(['']);
  const [isCreating, setIsCreating] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [coaches, setCoaches] = useState<User[]>([]);
  const [selectedCoach, setSelectedCoach] = useState<User | null>(null);
  const [coachBabies, setCoachBabies] = useState<Baby[]>([]);
  const [coachParents, setCoachParents] = useState<User[]>([]);
  const { toast } = useToast();

  // Fetch all invites
  useEffect(() => {
    async function fetchInvites() {
      const q = query(collection(db, 'invites'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setInvites(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Invite));
    }
    fetchInvites();
  }, [isCreating]);

  // Fetch all coaches
  useEffect(() => {
    getAllCoachUsers().then(setCoaches);
  }, []);

  // Drill-down: fetch babies and parents for selected coach
  useEffect(() => {
    if (!selectedCoach) return;
    async function fetchBabiesAndParents() {
      const q = query(collection(db, 'babies'));
      const snap = await getDocs(q);
      const babies = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Baby));
      if (!selectedCoach) return; // null check for linter
      const coachBabies = babies.filter(b => b.coachId === selectedCoach.id);
      setCoachBabies(coachBabies);
      // Find all unique parentIds from these babies
      const parentIds = Array.from(new Set(coachBabies.flatMap(b => (b.parentIds || []))));
      // Fetch parent user docs
      const parentDocs = await Promise.all(parentIds.map(pid => getUser(pid)));
      setCoachParents(parentDocs.filter((p): p is User => !!p));
    }
    fetchBabiesAndParents();
  }, [selectedCoach]);

  // Handle invite creation
  const handleCreateInvite = async () => {
    setIsCreating(true);
    try {
      const filteredEmails = emails.map(e => e.trim()).filter(Boolean);
      if (filteredEmails.length === 0) {
        toast({ title: "שגיאה", description: "יש להזין לפחות אימייל אחד.", variant: "destructive" });
        return;
      }

      let babyData: any = undefined;
      if (role === 'parent') {
        // Create basic baby data structure for parent invites
        babyData = {
          parentEmail1: filteredEmails[0] || '',
          parentEmail2: filteredEmails[1] || '',
          // These will be filled in when the coach creates the actual baby profile
          name: '',
          familyName: '',
          age: 0,
          motherName: '',
          fatherName: '',
          siblingsCount: 0,
        };
      }
      // For coach invites, babyData remains undefined and won't be passed to Firestore

      await createInviteInFirestore(
        'admin', // admin creates invites
        babyData, // undefined for coach invites, properly structured for parent invites
        filteredEmails,
        role // Pass the role explicitly
      );
      
      setEmails(['']);
      toast({ title: "הצלחה", description: `הזמנה עבור ${role === 'parent' ? 'הורה' : 'יועצת'} נוצרה בהצלחה.` });
    } catch (error) {
      console.error('Error creating invite:', error);
      toast({ title: "שגיאה", description: "נכשל ביצירת ההזמנה. אנא נסה שוב.", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  // Handle invite revocation
  const handleRevokeInvite = async (inviteId: string) => {
    try {
      // Ensure user has admin access before proceeding
      await ensureAdminAccess();
      
      await updateInviteInFirestore(inviteId, { status: 'revoked' });
      // Refresh invites
      const q = query(collection(db, 'invites'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setInvites(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Invite));
      toast({ title: "הצלחה", description: "ההזמנה בוטלה בהצלחה." });
    } catch (error: any) {
      console.error('Error revoking invite:', error);
      let message = "נכשל בביטול ההזמנה.";
      
      if (error.message?.includes('not authenticated')) {
        message = "עליך להתחבר כמנהל כדי לבטל הזמנות.";
      } else if (error.message?.includes('Admin access required')) {
        message = "נדרשות הרשאות מנהל כדי לבטל הזמנות.";
      } else if (error.message?.includes('User role not found')) {
        message = "לא נמצאו הרשאות משתמש. אנא פנה לתמיכה.";
      } else if (error.code === 'permission-denied' || error.message?.includes('insufficient permissions')) {
        message = "אין לך הרשאות מתאימות לביטול הזמנות. נסה להתנתק ולהתחבר מחדש.";
      }
      
      toast({ 
        title: "שגיאה", 
        description: message, 
        variant: "destructive" 
      });
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">ניהול הזמנות</h1>
      <Card>
        <CardHeader>
          <CardTitle>יצירת הזמנה חדשה</CardTitle>
          <CardDescription>יצירת קוד הזמנה חד פעמי עבור יועצת או הורה.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div>
              <Label>סוג הזמנה</Label>
              <Select value={role} onValueChange={v => setRole(v as 'coach' | 'parent')}>
                <SelectTrigger className="w-32 rtl:text-right">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="parent">הורה</SelectItem>
                  <SelectItem value="coach">יועצת</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>אימייל{role === 'parent' ? 'ים' : ''}</Label>
              {emails.map((email, i) => (
                <Input key={i} value={email} onChange={e => {
                  const arr = [...emails];
                  arr[i] = e.target.value;
                  setEmails(arr);
                }} className="rtl:text-right" placeholder="example@email.com" />
              ))}
              {role === 'parent' && (
                <Button type="button" variant="outline" size="sm" onClick={() => setEmails([...emails, ''])}>הוסף אימייל</Button>
              )}
            </div>
            <Button onClick={handleCreateInvite} disabled={isCreating || emails.every(e => !e.trim())} className="bg-primary text-white">צור קוד הזמנה</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>הזמנות קיימות</CardTitle>
          <CardDescription>רשימת כל ההזמנות שנוצרו והסטטוס שלהן.</CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-right rtl:text-right">
            <thead>
              <tr>
                <th>קוד</th>
                <th>סוג</th>
                <th>אימיילים</th>
                <th>תאריך יצירה</th>
                <th>סטטוס</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {invites.map(invite => (
                <tr key={invite.id}>
                  <td className="font-mono">{invite.id}</td>
                  <td>{invite.babyData ? 'הורה' : 'יועצת'}</td>
                  <td>{
                    invite.babyData 
                      ? (invite.parentEmails || []).join(', ')
                      : ((invite.invitedEmails || invite.parentEmails || []).join(', '))
                  }</td>
                  <td>{invite.createdAt?.toDate ? invite.createdAt.toDate().toLocaleString('he-IL') : ''}</td>
                  <td>{invite.status}</td>
                  <td>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={['completed','expired','revoked'].includes(invite.status)}
                      onClick={() => handleRevokeInvite(invite.id)}
                    >
                      בטל
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>רשימת יועצות</CardTitle>
          <CardDescription>כל היועצות הרשומות במערכת.</CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-right rtl:text-right">
            <thead>
              <tr>
                <th>שם</th>
                <th>אימייל</th>
                <th>סטטוס</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {coaches.map(coach => (
                <tr key={coach.id}>
                  <td>{coach.name}</td>
                  <td>{coach.email}</td>
                  <td>{coach.status}</td>
                  <td>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setSelectedCoach(coach)}>הצג פרטים</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>פרטי יועצת: {coach.name}</DialogTitle>
                          <DialogDescription>כל ההורים והתינוקות המשויכים ליועצת זו.</DialogDescription>
                        </DialogHeader>
                        {/* Drill-down content for this coach */}
                        {selectedCoach && selectedCoach.id === coach.id ? (
                          <>
                            <h4 className="font-semibold mb-2">הורים</h4>
                            <ul className="mb-4">
                              {coachParents.length === 0 && <li>אין הורים משויכים</li>}
                              {coachParents.map(parent => (
                                <li key={parent?.id}>{parent?.name} ({parent?.email})</li>
                              ))}
                            </ul>
                            <h4 className="font-semibold mb-2">תינוקות</h4>
                            <ul>
                              {coachBabies.length === 0 && <li>אין תינוקות משויכים</li>}
                              {coachBabies.map(baby => (
                                <li key={baby.id}>
                                  <a
                                    href={`/parent/${baby.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary underline hover:text-primary/80 cursor-pointer"
                                  >
                                    {baby.name} {baby.familyName}
                                  </a>
                                </li>
                              ))}
                            </ul>
                            <DialogClose asChild>
                              <Button variant="outline" className="mt-4">סגור</Button>
                            </DialogClose>
                          </>
                        ) : (
                          <div className="text-center py-8">טוען נתונים...</div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
    