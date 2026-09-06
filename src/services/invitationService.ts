import { apiFetch, apiFetchPublic } from '@/lib/apiClient';
import type { UserRole } from '@/lib/permissions';

/**
 * Invitations, client side.
 *
 * A thin wrapper over the server API routes. Creating, redeeming and cancelling an
 * invitation are all privileged operations that require the Admin SDK, so they cannot
 * happen in the browser: firestore.rules denies clients any write to `invitations`,
 * and validating a code happens before the visitor has a token at all.
 *
 * This replaces two near-identical client services (InvitationService and
 * ManualInvitationService, ~85% copy-paste) that both wrote the collection directly
 * with divergent history and audit vocabularies. One path, one vocabulary.
 *
 * Delivery is manual: the coach or admin shares the code directly. There is no email
 * provider — see src/lib/server/invitations.ts.
 */

export interface InvitationSummary {
  id: string;
  invitationCode: string;
  email: string;
  role: UserRole;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  createdAt: string | null;
  expiresAt: string | null;
  createdBy: string;
  babyProfileId: string | null;
  assignedCoachId?: string | null;
  welcomeMessage?: string | null;
}

export interface CreateInvitationParams {
  email: string;
  role: UserRole;
  /** Accepted for call-site compatibility; the server derives it from the caller. */
  organizationId?: string;
  createdBy?: string;
  metadata?: {
    welcomeMessage?: string;
    babyProfileId?: string;
    assignedCoachId?: string;
  };
}

export interface CreateInvitationResult {
  success: boolean;
  invitationCode?: string;
  invitation?: { id: string; expiresAt: string };
  error?: string;
}

export interface PrevalidationResult {
  isValid: boolean;
  reason?: string;
  role?: UserRole;
}

export class InvitationService {
  /**
   * Check a code before the user submits the signup form.
   *
   * Unauthenticated by necessity: the visitor has no token, and the rules correctly
   * refuse them any read of `invitations`. The old client-side version queried
   * Firestore directly and so always failed with a permission error, which surfaced
   * as "invalid code" for every code.
   */
  async prevalidateInvitation(code: string, email?: string): Promise<PrevalidationResult> {
    try {
      const params = new URLSearchParams({ code });
      if (email) params.set('email', email);

      const result = await apiFetchPublic<{
        valid: boolean;
        reason?: string;
        role?: UserRole;
      }>(`/api/invitations/validate?${params.toString()}`);

      return { isValid: result.valid, reason: result.reason, role: result.role };
    } catch (error) {
      return {
        isValid: false,
        reason: error instanceof Error ? error.message : 'לא ניתן לאמת את קוד ההזמנה.',
      };
    }
  }

  /** Mint an invitation code for manual delivery. */
  async createInvitation(params: CreateInvitationParams): Promise<CreateInvitationResult> {
    try {
      const result = await apiFetch<{
        id: string;
        invitationCode: string;
        expiresAt: string;
      }>('/api/invitations', {
        method: 'POST',
        body: JSON.stringify({
          email: params.email,
          role: params.role,
          babyProfileId: params.metadata?.babyProfileId,
          welcomeMessage: params.metadata?.welcomeMessage,
        }),
      });

      return {
        success: true,
        invitationCode: result.invitationCode,
        invitation: { id: result.id, expiresAt: result.expiresAt },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'יצירת ההזמנה נכשלה.',
      };
    }
  }

  /**
   * Kept as an alias so the manual-invitation admin screen keeps working.
   * Every invitation is a manual code now, so there is nothing else it could mean.
   */
  async createManualInvitation(params: CreateInvitationParams): Promise<CreateInvitationResult> {
    return this.createInvitation(params);
  }

  /** Invitations the caller may see: an admin's whole org, or a coach's own. */
  async getInvitations(): Promise<InvitationSummary[]> {
    const result = await apiFetch<{ invitations: InvitationSummary[] }>('/api/invitations');
    return result.invitations;
  }

  async getPendingInvitations(_organizationId?: string): Promise<InvitationSummary[]> {
    const invitations = await this.getInvitations();
    return invitations.filter((invitation) => invitation.status === 'pending');
  }

  /** Soft cancel: the record and its history are kept for the audit trail. */
  async cancelInvitation(invitationId: string, _performedBy?: string): Promise<void> {
    await apiFetch(`/api/invitations/${invitationId}/cancel`, { method: 'POST' });
  }
}

export const invitationService = new InvitationService();

/**
 * Deprecated alias. Manual codes are the only delivery mechanism, so this is the
 * same class; kept so existing imports keep resolving.
 */
export const ManualInvitationService = InvitationService;
