import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { InvitationTemplate } from '@/types/auth';

export class EmailTemplateService {
  /**
   * Get all templates for an organization
   */
  static async getTemplates(organizationId: string): Promise<InvitationTemplate[]> {
    const templatesQuery = query(
      collection(db, 'invitation_templates'),
      where('organizationId', '==', organizationId),
      orderBy('createdAt', 'desc')
    );
    
    const templatesSnapshot = await getDocs(templatesQuery);
    return templatesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as InvitationTemplate));
  }

  /**
   * Get template by ID
   */
  static async getTemplate(templateId: string): Promise<InvitationTemplate | null> {
    const templateDoc = await getDocs(
      query(collection(db, 'invitation_templates'), where('__name__', '==', templateId))
    );
    
    if (templateDoc.empty) return null;
    
    return {
      id: templateDoc.docs[0].id,
      ...templateDoc.docs[0].data()
    } as InvitationTemplate;
  }

  /**
   * Get template for specific role and organization
   */
  static async getTemplateForRole(
    organizationId: string, 
    role: 'coach' | 'parent'
  ): Promise<InvitationTemplate | null> {
    const templateQuery = query(
      collection(db, 'invitation_templates'),
      where('organizationId', '==', organizationId),
      where('role', '==', role),
      where('isActive', '==', true)
    );
    
    const templatesSnapshot = await getDocs(templateQuery);
    
    if (templatesSnapshot.empty) return null;
    
    // Return the first active template, or the default one if multiple exist
    const templates = templatesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as InvitationTemplate));
    
    // Prefer default template
    const defaultTemplate = templates.find(t => t.isDefault);
    return defaultTemplate || templates[0];
  }

  /**
   * Create new template
   */
  static async createTemplate(
    template: Omit<InvitationTemplate, 'id' | 'createdAt'>
  ): Promise<string> {
    const newTemplate = {
      ...template,
      createdAt: Timestamp.now()
    };
    
    const docRef = await addDoc(collection(db, 'invitation_templates'), newTemplate);
    return docRef.id;
  }

  /**
   * Update existing template
   */
  static async updateTemplate(
    templateId: string, 
    updates: Partial<Omit<InvitationTemplate, 'id' | 'createdAt' | 'createdBy' | 'organizationId'>>
  ): Promise<void> {
    const templateRef = doc(db, 'invitation_templates', templateId);
    await updateDoc(templateRef, updates);
  }

  /**
   * Delete template
   */
  static async deleteTemplate(templateId: string): Promise<void> {
    const templateRef = doc(db, 'invitation_templates', templateId);
    await deleteDoc(templateRef);
  }

  /**
   * Set template as default for role
   */
  static async setDefaultTemplate(
    organizationId: string, 
    role: 'coach' | 'parent', 
    templateId: string
  ): Promise<void> {
    // First, unset all other default templates for this role
    const existingTemplates = await this.getTemplates(organizationId);
    const roleTemplates = existingTemplates.filter(t => t.role === role);
    
    for (const template of roleTemplates) {
      if (template.id !== templateId && template.isDefault) {
        await this.updateTemplate(template.id, { isDefault: false });
      }
    }
    
    // Set the new default
    await this.updateTemplate(templateId, { isDefault: true });
  }

  /**
   * Get default template for role (fallback to built-in)
   */
  static getDefaultTemplate(role: 'coach' | 'parent'): { subject: string; bodyTemplate: string } {
    const templates = {
      parent: {
        subject: 'הזמנה להצטרפות למערכת לילה טוב לניהול שינה',
        bodyTemplate: `<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #007bff; margin-bottom: 10px;">לילה טוב</h1>
    <p style="color: #666; margin: 0;">מערכת ניהול שינה לתינוקות</p>
  </div>
  
  <h2 style="color: #333;">שלום,</h2>
  
  <p style="font-size: 16px; line-height: 1.5;">
    הוזמנת על ידי <strong>{{inviterName}}</strong> להצטרף למערכת <strong>{{organizationName}}</strong> לניהול שינה של התינוק שלך.
  </p>
  
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
    <p style="margin: 0; font-size: 18px; font-weight: bold; color: #007bff;">
      קוד ההזמנה שלך: {{invitationCode}}
    </p>
  </div>
  
  {{#if customMessage}}
  <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0; font-style: italic;">{{customMessage}}</p>
  </div>
  {{/if}}
  
  <p style="font-size: 16px; line-height: 1.5;">
    להשלמת הרשמה, לחץ על הכפתור למטה או העתק את הקישור לדפדפן:
  </p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="{{signupUrl}}" 
       style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
      הצטרף עכשיו
    </a>
  </div>
  
  <p style="font-size: 14px; color: #666; margin-top: 30px;">
    הזמנה זו תפוג ב: <strong>{{expiryDate}}</strong>
  </p>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  
  <p style="font-size: 12px; color: #999; text-align: center;">
    אם לא ביקשת הזמנה זו, תוכל להתעלם מהאימייל הזה.
  </p>
</div>`
      },
      coach: {
        subject: 'הזמנה להצטרפות כמדריכת שינה במערכת לילה טוב',
        bodyTemplate: `<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #007bff; margin-bottom: 10px;">לילה טוב</h1>
    <p style="color: #666; margin: 0;">מערכת ניהול שינה לתינוקות</p>
  </div>
  
  <h2 style="color: #333;">שלום,</h2>
  
  <p style="font-size: 16px; line-height: 1.5;">
    הוזמנת על ידי <strong>{{inviterName}}</strong> להצטרף כמדריכת שינה במערכת <strong>{{organizationName}}</strong>.
  </p>
  
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
    <p style="margin: 0; font-size: 18px; font-weight: bold; color: #007bff;">
      קוד ההזמנה שלך: {{invitationCode}}
    </p>
  </div>
  
  {{#if customMessage}}
  <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0; font-style: italic;">{{customMessage}}</p>
  </div>
  {{/if}}
  
  <p style="font-size: 16px; line-height: 1.5;">
    כמדריכת שינה, תוכלי לנהל תיקי תינוקות, לעקוב אחר התקדמות, ולתת המלצות מותאמות אישית.
  </p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="{{signupUrl}}" 
       style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
      הצטרף עכשיו
    </a>
  </div>
  
  <p style="font-size: 14px; color: #666; margin-top: 30px;">
    הזמנה זו תפוג ב: <strong>{{expiryDate}}</strong>
  </p>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  
  <p style="font-size: 12px; color: #999; text-align: center;">
    אם לא ביקשת הזמנה זו, תוכל להתעלם מהאימייל הזה.
  </p>
</div>`
      }
    };
    
    return templates[role] || templates.parent;
  }

  /**
   * Populate template with data
   */
  static populateTemplate(
    template: InvitationTemplate, 
    data: Record<string, string>
  ): { subject: string; body: string } {
    let subject = template.subject;
    let body = template.bodyTemplate;
    
    // Simple template replacement
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, value);
      body = body.replace(regex, value);
    }
    
    return { subject, body };
  }

  /**
   * Get available template variables
   */
  static getAvailableVariables() {
    return [
      { key: 'inviterName', label: 'שם המזמין', description: 'שם המשתמש שיצר את ההזמנה' },
      { key: 'organizationName', label: 'שם הארגון', description: 'שם הארגון או החברה' },
      { key: 'invitationCode', label: 'קוד הזמנה', description: 'קוד ההזמנה הייחודי' },
      { key: 'expiryDate', label: 'תאריך תפוגה', description: 'תאריך תפוגת ההזמנה' },
      { key: 'customMessage', label: 'הודעה מותאמת', description: 'הודעה אישית מהמזמין' },
      { key: 'signupUrl', label: 'קישור הרשמה', description: 'קישור ישיר להרשמה' },
      { key: 'role', label: 'תפקיד', description: 'תפקיד המשתמש (הורה/מאמן)' },
    ];
  }
}
