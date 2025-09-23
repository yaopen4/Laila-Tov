"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MailPlus, 
  Edit, 
  Eye, 
  Trash2, 
  Copy,
  Save,
  X,
  FileText,
  Code,
  Palette,
  Settings
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { AuthService } from '@/services/authService';
import { EmailTemplateService } from '@/services/emailTemplateService';
import type { InvitationTemplate } from '@/types/auth';

interface TemplateFormData {
  name: string;
  role: 'coach' | 'parent';
  subject: string;
  bodyTemplate: string;
  isDefault: boolean;
}

interface TemplateWithDetails extends InvitationTemplate {
  isExpired?: boolean;
  usageCount?: number;
}

const AVAILABLE_VARIABLES = EmailTemplateService.getAvailableVariables();

export function EmailTemplateManager() {
  const [templates, setTemplates] = useState<TemplateWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateWithDetails | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'edit'>('list');
  const [templateForm, setTemplateForm] = useState<TemplateFormData>({
    name: '',
    role: 'parent',
    subject: '',
    bodyTemplate: '',
    isDefault: false
  });
  const [isSaving, setIsSaving] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    loadTemplates();
    initializePreviewData();
  }, []);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) {
        toast({ title: "שגיאה", description: "משתמש לא מאומת.", variant: "destructive" });
        return;
      }

      const templatesData = await EmailTemplateService.getTemplates(currentUser.organizationId || 'default');
      setTemplates(templatesData as TemplateWithDetails[]);
    } catch (error) {
      console.error("Error loading templates:", error);
      toast({ title: "שגיאה", description: "נכשל בטעינת תבניות.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const initializePreviewData = () => {
    setPreviewData({
      inviterName: 'יוסי כהן',
      organizationName: 'לילה טוב - ייעוץ שינה',
      invitationCode: 'INV-123456',
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('he-IL'),
      customMessage: 'ברוכים הבאים למערכת שלנו!',
      signupUrl: `${process.env.NEXT_PUBLIC_APP_URL}/signup?code=INV-123456`,
      role: 'הורה'
    });
  };

  const handleCreateTemplate = async () => {
    try {
      setIsSaving(true);
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) {
        toast({ title: "שגיאה", description: "משתמש לא מאומת.", variant: "destructive" });
        return;
      }

      const newTemplate: Omit<InvitationTemplate, 'id' | 'createdAt'> = {
        organizationId: currentUser.organizationId || 'default',
        name: templateForm.name,
        role: templateForm.role,
        subject: templateForm.subject,
        bodyTemplate: templateForm.bodyTemplate,
        createdBy: currentUser.uid,
        isDefault: templateForm.isDefault,
        isActive: true
      };

      await EmailTemplateService.createTemplate(newTemplate);
      
      toast({ title: "הצלחה", description: "תבנית נוצרה בהצלחה." });
      setIsCreateDialogOpen(false);
      resetForm();
      loadTemplates();
    } catch (error) {
      console.error("Error creating template:", error);
      toast({ title: "שגיאה", description: "נכשל ביצירת תבנית.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      setIsSaving(true);
      await EmailTemplateService.updateTemplate(selectedTemplate.id, {
        name: templateForm.name,
        role: templateForm.role,
        subject: templateForm.subject,
        bodyTemplate: templateForm.bodyTemplate,
        isDefault: templateForm.isDefault
      });

      toast({ title: "הצלחה", description: "תבנית עודכנה בהצלחה." });
      setIsEditDialogOpen(false);
      setSelectedTemplate(null);
      resetForm();
      loadTemplates();
    } catch (error) {
      console.error("Error updating template:", error);
      toast({ title: "שגיאה", description: "נכשל בעדכון תבנית.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;

    try {
      await EmailTemplateService.deleteTemplate(templateToDelete);
      toast({ title: "הצלחה", description: "תבנית נמחקה בהצלחה." });
      setIsDeleteDialogOpen(false);
      setTemplateToDelete(null);
      loadTemplates();
    } catch (error) {
      console.error("Error deleting template:", error);
      toast({ title: "שגיאה", description: "נכשל במחיקת תבנית.", variant: "destructive" });
    }
  };

  const resetForm = () => {
    setTemplateForm({
      name: '',
      role: 'parent',
      subject: '',
      bodyTemplate: '',
      isDefault: false
    });
  };

  const openEditDialog = (template: TemplateWithDetails) => {
    setSelectedTemplate(template);
    setTemplateForm({
      name: template.name,
      role: template.role,
      subject: template.subject,
      bodyTemplate: template.bodyTemplate,
      isDefault: template.isDefault
    });
    setIsEditDialogOpen(true);
  };

  const openPreviewDialog = (template: TemplateWithDetails) => {
    setSelectedTemplate(template);
    setIsPreviewDialogOpen(true);
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('bodyTemplate') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      const newText = before + `{{${variable}}}` + after;
      
      setTemplateForm(prev => ({
        ...prev,
        bodyTemplate: newText
      }));
      
      // Set cursor position after the inserted variable
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length + 4, start + variable.length + 4);
      }, 0);
    }
  };

  const renderPreview = (template: InvitationTemplate) => {
    return EmailTemplateService.populateTemplate(template, previewData);
  };

  const getDefaultTemplate = (role: string) => {
    return EmailTemplateService.getDefaultTemplate(role as 'coach' | 'parent');
  };

  const loadDefaultTemplate = (role: string) => {
    const defaultTemplate = getDefaultTemplate(role);
    setTemplateForm(prev => ({
      ...prev,
      subject: defaultTemplate.subject,
      bodyTemplate: defaultTemplate.bodyTemplate
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">טוען תבניות...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">תבניות הזמנה</h2>
          <p className="text-muted-foreground">ניהול תבניות אימייל מותאמות אישית</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <MailPlus className="h-4 w-4 mr-2" />
          תבנית חדשה
        </Button>
      </div>

      {/* Templates List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            תבניות קיימות
          </CardTitle>
          <CardDescription>
            {templates.length} תבניות זמינות
          </CardDescription>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-8">
              <MailPlus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">אין תבניות</h3>
              <p className="text-muted-foreground mb-4">צור תבנית ראשונה להתחיל</p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <MailPlus className="h-4 w-4 mr-2" />
                צור תבנית
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>שם</TableHead>
                    <TableHead>תפקיד</TableHead>
                    <TableHead>נושא</TableHead>
                    <TableHead>סטטוס</TableHead>
                    <TableHead>נוצר</TableHead>
                    <TableHead>פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell>
                        <Badge variant={template.role === 'parent' ? 'default' : 'secondary'}>
                          {template.role === 'parent' ? 'הורה' : 'מאמן'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{template.subject}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {template.isDefault && (
                            <Badge variant="outline">ברירת מחדל</Badge>
                          )}
                          {template.isActive ? (
                            <Badge variant="default">פעיל</Badge>
                          ) : (
                            <Badge variant="secondary">לא פעיל</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {template.createdAt.toDate().toLocaleDateString('he-IL')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPreviewDialog(template)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(template)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setTemplateToDelete(template.id);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Template Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>צור תבנית חדשה</DialogTitle>
            <DialogDescription>
              צור תבנית אימייל מותאמת אישית להזמנות משתמשים
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="list">פרטים</TabsTrigger>
              <TabsTrigger value="create">עריכת תוכן</TabsTrigger>
              <TabsTrigger value="edit">תצוגה מקדימה</TabsTrigger>
            </TabsList>
            
            <TabsContent value="list" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">שם התבנית</Label>
                  <Input
                    id="name"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="שם התבנית"
                  />
                </div>
                <div>
                  <Label htmlFor="role">תפקיד</Label>
                  <Select
                    value={templateForm.role}
                    onValueChange={(value) => {
                      setTemplateForm(prev => ({ ...prev, role: value as 'coach' | 'parent' }));
                      loadDefaultTemplate(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="parent">הורה</SelectItem>
                      <SelectItem value="coach">מאמן</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="subject">נושא האימייל</Label>
                <Input
                  id="subject"
                  value={templateForm.subject}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="נושא האימייל"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={templateForm.isDefault}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, isDefault: e.target.checked }))}
                />
                <Label htmlFor="isDefault">תבנית ברירת מחדל</Label>
              </div>
            </TabsContent>
            
            <TabsContent value="create" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <Label htmlFor="bodyTemplate">תוכן התבנית (HTML)</Label>
                  <Textarea
                    id="bodyTemplate"
                    value={templateForm.bodyTemplate}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, bodyTemplate: e.target.value }))}
                    placeholder="הכנס את תוכן התבנית כאן..."
                    className="min-h-[400px] font-mono text-sm"
                  />
                </div>
                <div className="space-y-4">
                  <div>
                    <Label>משתנים זמינים</Label>
                    <div className="space-y-2 mt-2">
                      {AVAILABLE_VARIABLES.map((variable) => (
                        <div key={variable.key} className="border rounded p-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{'{{' + variable.key + '}}'}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => insertVariable(variable.key)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {variable.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {variable.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="edit" className="space-y-4">
              <div>
                <Label>תצוגה מקדימה</Label>
                <div className="border rounded p-4 mt-2 bg-gray-50">
                  <div className="mb-2">
                    <strong>נושא:</strong> {templateForm.subject}
                  </div>
                  <div 
                    className="border rounded p-4 bg-white"
                    dangerouslySetInnerHTML={{ 
                      __html: renderPreview({
                        ...templateForm,
                        id: 'preview',
                        organizationId: 'preview',
                        createdAt: new Date() as any,
                        createdBy: 'preview',
                        isActive: true
                      } as InvitationTemplate).body
                    }}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              ביטול
            </Button>
            <Button onClick={handleCreateTemplate} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'שומר...' : 'שמור תבנית'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ערוך תבנית</DialogTitle>
            <DialogDescription>
              ערוך את תבנית האימייל
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-name">שם התבנית</Label>
                <Input
                  id="edit-name"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit-role">תפקיד</Label>
                <Select
                  value={templateForm.role}
                  onValueChange={(value) => setTemplateForm(prev => ({ ...prev, role: value as 'coach' | 'parent' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="parent">הורה</SelectItem>
                    <SelectItem value="coach">מאמן</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="edit-subject">נושא האימייל</Label>
              <Input
                id="edit-subject"
                value={templateForm.subject}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, subject: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="edit-bodyTemplate">תוכן התבנית (HTML)</Label>
              <Textarea
                id="edit-bodyTemplate"
                value={templateForm.bodyTemplate}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, bodyTemplate: e.target.value }))}
                className="min-h-[300px] font-mono text-sm"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-isDefault"
                checked={templateForm.isDefault}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, isDefault: e.target.checked }))}
              />
              <Label htmlFor="edit-isDefault">תבנית ברירת מחדל</Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              ביטול
            </Button>
            <Button onClick={handleEditTemplate} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'שומר...' : 'שמור שינויים'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>תצוגה מקדימה</DialogTitle>
            <DialogDescription>
              תצוגה מקדימה של התבנית עם נתונים לדוגמה
            </DialogDescription>
          </DialogHeader>
          
          {selectedTemplate && (
            <div className="space-y-4">
              <div>
                <strong>נושא:</strong>
                <p className="mt-1 p-2 bg-gray-50 rounded">
                  {renderPreview(selectedTemplate).subject}
                </p>
              </div>
              <div>
                <strong>תוכן:</strong>
                <div 
                  className="mt-1 border rounded p-4 bg-white"
                  dangerouslySetInnerHTML={{ 
                    __html: renderPreview(selectedTemplate).body
                  }}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>
              סגור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחק תבנית</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק תבנית זו? פעולה זו לא ניתנת לביטול.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate}>
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
