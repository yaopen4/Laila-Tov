// Invitation flow structure
const invitationSchema = {
  id: string,
  email: string,
  role: 'admin' | 'coach' | 'parent',
  organizationId: string,
  createdBy: string,
  status: 'pending' | 'accepted' | 'expired',
  metadata: {
    babyProfileIds?: string[],
    assignedCoach?: string
  }
}