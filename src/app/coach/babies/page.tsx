/**
 * @fileoverview Coach babies management page.
 * Baby management with advanced features.
 */
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Baby, 
  Plus, 
  Search, 
  Eye, 
  Edit, 
  Archive,
  Calendar,
  TrendingUp
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { BabyService } from '@/services/babyService';
import { AuthService, type AuthUser } from '@/services/authService';
import type { BabyProfile } from '@/types/auth';

export default function CoachBabiesPage() {
  const [babies, setBabies] = useState<BabyProfile[]>([]);
  const [filteredBabies, setFilteredBabies] = useState<BabyProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const init = async () => {
      const user = await AuthService.getCurrentUser();
      setCurrentUser(user);
      if (user?.role === 'coach') {
        await loadBabies(user.uid);
      } else {
        setLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    const filtered = babies.filter(baby =>
      baby.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      baby.familyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      baby.motherName.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredBabies(filtered);
  }, [searchTerm, babies]);

  const loadBabies = async (coachId: string) => {
    try {
      setLoading(true);
      const babiesData = await BabyService.getBabiesForCoach(coachId);
      setBabies(babiesData);
    } catch (error) {
      console.error('Error loading babies:', error);
      toast({
        title: "שגיאה בטעינת תינוקות",
        description: "לא ניתן לטעון את רשימת התינוקות",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewBaby = (babyId: string) => {
    toast({
      title: "צפייה בתינוק",
      description: `פתיחת פרטי תינוק ${babyId}`,
    });
  };

  const handleEditBaby = (babyId: string) => {
    toast({
      title: "עריכת תינוק",
      description: `עריכת פרטי תינוק ${babyId}`,
    });
  };

  const handleArchiveBaby = (babyId: string) => {
    toast({
      title: "ארכיון תינוק",
      description: `העברת תינוק ${babyId} לארכיון`,
    });
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-primary">ניהול תינוקות</h1>
        <div className="flex justify-center items-center h-64">
          <p>טוען תינוקות...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-primary">ניהול תינוקות</h1>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          הוספת תינוק חדש
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="חיפוש תינוקות..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Baby className="h-6 w-6" />
            רשימת תינוקות
          </CardTitle>
          <CardDescription>
            ניהול וצפייה בכל התינוקות שלך
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>שם התינוק</TableHead>
                <TableHead>גיל</TableHead>
                <TableHead>הורים</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>תאריך יצירה</TableHead>
                <TableHead>פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBabies.map((baby) => (
                <TableRow key={baby.id}>
                  <TableCell className="font-medium">
                    {baby.name} {baby.familyName}
                  </TableCell>
                  <TableCell>{baby.age} חודשים</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>אם: {baby.motherName}</div>
                      {baby.fatherName && <div>אב: {baby.fatherName}</div>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={baby.isArchived ? "secondary" : "default"}>
                      {baby.isArchived ? "בארכיון" : "פעיל"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(baby.createdAt).toLocaleDateString('he-IL')}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewBaby(baby.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditBaby(baby.id)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleArchiveBaby(baby.id)}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredBabies.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'לא נמצאו תינוקות התואמים לחיפוש' : 'אין תינוקות להצגה'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
