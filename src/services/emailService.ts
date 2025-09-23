// Email Service for Invitation and Notification Management
import { AuditLogger } from './auditLogger';

export interface EmailParams {
  to: string;
  subject: string;
  html: string;
  priority?: 'low' | 'normal' | 'high';
  templateId?: string;
  templateData?: Record<string, any>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class EmailService {
  private static readonly SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  private static readonly FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@lailatov.com';
  
  /**
   * Send email using configured email service
   */
  static async sendEmail(params: EmailParams): Promise<EmailResult> {
    try {
      // Log email send attempt
      await AuditLogger.log({
        action: 'invitation_sent',
        userId: 'system',
        details: {
          to: params.to,
          subject: params.subject,
          priority: params.priority || 'normal'
        }
      });

      // Check if we're in development mode
      if (process.env.NODE_ENV === 'development') {
        return this.sendEmailDevelopment(params);
      }

      // Production email sending
      if (this.SENDGRID_API_KEY) {
        return await this.sendEmailSendGrid(params);
      } else {
        // Fallback to console logging if no email service configured
        console.warn('No email service configured. Email would be sent:', {
          to: params.to,
          subject: params.subject,
          html: params.html.substring(0, 200) + '...'
        });
        
        return {
          success: true,
          messageId: `dev-${Date.now()}`
        };
      }
      
    } catch (error) {
      console.error('Error sending email:', error);
      
      // Log email failure
      await AuditLogger.log({
        action: 'invitation_sent',
        userId: 'system',
        details: {
          to: params.to,
          subject: params.subject,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email'
      };
    }
  }
  
  /**
   * Development mode email sending (console output)
   */
  private static async sendEmailDevelopment(params: EmailParams): Promise<EmailResult> {
    console.log('\n📧 EMAIL (Development Mode):');
    console.log('To:', params.to);
    console.log('Subject:', params.subject);
    console.log('Priority:', params.priority || 'normal');
    console.log('HTML Content:');
    console.log('─'.repeat(50));
    console.log(params.html);
    console.log('─'.repeat(50));
    console.log('✅ Email would be sent in production\n');
    
    return {
      success: true,
      messageId: `dev-${Date.now()}`
    };
  }
  
  /**
   * SendGrid email sending implementation
   */
  private static async sendEmailSendGrid(params: EmailParams): Promise<EmailResult> {
    try {
      // Dynamic import for SendGrid (only load if needed)
      const sgMail = await import('@sendgrid/mail');
      sgMail.default.setApiKey(this.SENDGRID_API_KEY!);
      
      const msg = {
        to: params.to,
        from: this.FROM_EMAIL,
        subject: params.subject,
        html: params.html,
      };
      
      const response = await sgMail.default.send(msg);
      
      return {
        success: true,
        messageId: response[0].headers['x-message-id'] as string
      };
      
    } catch (error: any) {
      console.error('SendGrid error:', error);
      
      return {
        success: false,
        error: error.message || 'SendGrid send failed'
      };
    }
  }
  
  /**
   * Send invitation email with template
   */
  static async sendInvitationEmail(
    email: string,
    invitationCode: string,
    role: string,
    organizationName: string,
    inviterName: string,
    customMessage?: string
  ): Promise<EmailResult> {
    const template = this.getInvitationTemplate(role, {
      invitationCode,
      organizationName,
      inviterName,
      customMessage: customMessage || '',
      signupUrl: `${process.env.NEXT_PUBLIC_APP_URL}/signup?code=${invitationCode}`
    });
    
    return await this.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      priority: 'normal'
    });
  }
  
  /**
   * Get invitation email template
   */
  private static getInvitationTemplate(
    role: string,
    data: {
      invitationCode: string;
      organizationName: string;
      inviterName: string;
      customMessage: string;
      signupUrl: string;
    }
  ): { subject: string; html: string } {
    const templates = {
      parent: {
        subject: `הזמנה להצטרפות למערכת ${data.organizationName} לניהול שינה`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #007bff; margin-bottom: 10px;">לילה טוב</h1>
              <p style="color: #666; margin: 0;">מערכת ניהול שינה לתינוקות</p>
            </div>
            
            <h2 style="color: #333;">שלום,</h2>
            
            <p style="font-size: 16px; line-height: 1.5;">
              הוזמנת על ידי <strong>${data.inviterName}</strong> להצטרף למערכת 
              <strong>${data.organizationName}</strong> לניהול שינה של התינוק שלך.
            </p>
            
            ${data.customMessage ? `
              <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 0; font-style: italic;">${data.customMessage}</p>
              </div>
            ` : ''}
            
            <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; text-align: center; margin: 25px 0;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">קוד ההזמנה שלך:</p>
              <p style="font-size: 24px; font-weight: bold; color: #007bff; letter-spacing: 2px; margin: 0;">
                ${data.invitationCode}
              </p>
            </div>
            
            <p style="font-size: 16px; line-height: 1.5;">
              להשלמת הרשמה, לחץ על הכפתור למטה או היכנס לאתר ושים את קוד ההזמנה.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.signupUrl}" 
                 style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                הצטרף עכשיו
              </a>
            </div>
            
            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
              <p style="font-size: 12px; color: #999; text-align: center;">
                אם אינך יכול ללחוץ על הכפתור, העתק והדבק את הקישור הבא בדפדפן:<br>
                <span style="color: #007bff;">${data.signupUrl}</span>
              </p>
              <p style="font-size: 12px; color: #999; text-align: center; margin-top: 15px;">
                הזמנה זו תפוג תוך 7 ימים.
              </p>
            </div>
          </div>
        `
      },
      coach: {
        subject: `הזמנה להצטרפות כיועץ שינה ב${data.organizationName}`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #007bff; margin-bottom: 10px;">לילה טוב</h1>
              <p style="color: #666; margin: 0;">מערכת ניהול שינה לתינוקות</p>
            </div>
            
            <h2 style="color: #333;">שלום,</h2>
            
            <p style="font-size: 16px; line-height: 1.5;">
              הוזמנת להצטרף כיועץ שינה במערכת <strong>${data.organizationName}</strong>.
            </p>
            
            ${data.customMessage ? `
              <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 0; font-style: italic;">${data.customMessage}</p>
              </div>
            ` : ''}
            
            <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; text-align: center; margin: 25px 0;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">קוד ההזמנה שלך:</p>
              <p style="font-size: 24px; font-weight: bold; color: #28a745; letter-spacing: 2px; margin: 0;">
                ${data.invitationCode}
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.signupUrl}" 
                 style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                הצטרף עכשיו
              </a>
            </div>
            
            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
              <p style="font-size: 12px; color: #999; text-align: center;">
                הזמנה זו תפוג תוך 7 ימים.
              </p>
            </div>
          </div>
        `
      },
      admin: {
        subject: `הזמנה לניהול מערכת ${data.organizationName}`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #007bff; margin-bottom: 10px;">לילה טוב</h1>
              <p style="color: #666; margin: 0;">מערכת ניהול שינה לתינוקות</p>
            </div>
            
            <h2 style="color: #333;">שלום,</h2>
            
            <p style="font-size: 16px; line-height: 1.5;">
              הוזמנת להצטרף כמנהל מערכת ב<strong>${data.organizationName}</strong>.
            </p>
            
            <div style="background: #fff3cd; padding: 20px; border-radius: 8px; text-align: center; margin: 25px 0;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">קוד ההזמנה שלך:</p>
              <p style="font-size: 24px; font-weight: bold; color: #856404; letter-spacing: 2px; margin: 0;">
                ${data.invitationCode}
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.signupUrl}" 
                 style="background-color: #ffc107; color: #212529; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                הצטרף עכשיו
              </a>
            </div>
            
            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
              <p style="font-size: 12px; color: #999; text-align: center;">
                הזמנה זו תפוג תוך 7 ימים.
              </p>
            </div>
          </div>
        `
      }
    };
    
    return templates[role] || templates.parent;
  }
  
  /**
   * Send password reset email
   */
  static async sendPasswordResetEmail(
    email: string,
    resetLink: string
  ): Promise<EmailResult> {
    const template = {
      subject: 'איפוס סיסמה - לילה טוב',
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #007bff; margin-bottom: 10px;">לילה טוב</h1>
            <p style="color: #666; margin: 0;">מערכת ניהול שינה לתינוקות</p>
          </div>
          
          <h2 style="color: #333;">איפוס סיסמה</h2>
          
          <p style="font-size: 16px; line-height: 1.5;">
            קיבלנו בקשה לאיפוס הסיסמה עבור החשבון שלך.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="background-color: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              אפס סיסמה
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666;">
            אם לא ביקשת איפוס סיסמה, התעלם מהודעה זו.
          </p>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
            <p style="font-size: 12px; color: #999; text-align: center;">
              קישור זה יפוג תוך 24 שעות.
            </p>
          </div>
        </div>
      `
    };
    
    return await this.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      priority: 'high'
    });
  }
  
  /**
   * Send system notification email
   */
  static async sendSystemNotification(
    to: string,
    title: string,
    message: string,
    severity: 'info' | 'warning' | 'error' = 'info'
  ): Promise<EmailResult> {
    const colors = {
      info: '#007bff',
      warning: '#ffc107',
      error: '#dc3545'
    };
    
    const template = {
      subject: `התראת מערכת: ${title}`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #007bff; margin-bottom: 10px;">לילה טוב</h1>
            <p style="color: #666; margin: 0;">התראת מערכת</p>
          </div>
          
          <div style="background: ${colors[severity]}; color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h2 style="margin: 0; color: white;">${title}</h2>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 5px;">
            <p style="margin: 0; font-size: 16px; line-height: 1.5;">${message}</p>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
            <p style="font-size: 12px; color: #999; text-align: center;">
              הודעה אוטומטית ממערכת לילה טוב
            </p>
          </div>
        </div>
      `
    };
    
    return await this.sendEmail({
      to: to,
      subject: template.subject,
      html: template.html,
      priority: severity === 'error' ? 'high' : 'normal'
    });
  }
}
