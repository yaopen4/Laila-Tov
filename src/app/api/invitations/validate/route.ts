import { NextResponse } from 'next/server';
import { handleRoute } from '@/lib/apiAuth';
import { validateInvitationCode } from '@/lib/server/invitations';

export const runtime = 'nodejs';

/**
 * GET /api/invitations/validate?code=ABC12345&email=someone@example.com
 *
 * Deliberately unauthenticated: the caller is a visitor on the signup page who has no
 * token yet. firestore.rules correctly denies them any read of `invitations`, so this
 * check has to happen server-side — the previous client-side version always failed.
 *
 * Returns only whether the code is usable and the role it grants. It never echoes the
 * invited email address, so the endpoint cannot be used to enumerate who was invited.
 */
export async function GET(req: Request) {
  return handleRoute(async () => {
    const url = new URL(req.url);
    const code = url.searchParams.get('code')?.trim();
    const email = url.searchParams.get('email')?.trim() || undefined;

    if (!code) {
      return NextResponse.json({ valid: false, reason: 'נדרש קוד הזמנה.' }, { status: 400 });
    }

    const result = await validateInvitationCode(code, email);

    if (!result.valid || !result.invitation) {
      return NextResponse.json({ valid: false, reason: result.reason });
    }

    // Only whether the code works and what role it grants. Echoing the invited
    // address back would turn a guessed code into a way to learn who was invited,
    // and nothing on the client needs it -- the user types their own email, and the
    // server checks the match itself.
    return NextResponse.json({
      valid: true,
      role: result.invitation.role,
    });
  });
}
