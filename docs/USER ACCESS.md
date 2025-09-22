# Access Rules by Role

---

## Parent User

### Authentication
  
- Signs up with email, password and a one-time invite code that connect them to the correct baby record. 
- After initial Sign up, each log in will direct to their baby record immediately.
- Access is tied to a unique `parentUsername` (or invitation code) associated with a baby profile.

### Baby Record Access

- **Read**: Full access to their own baby’s info and sleep records  
- **Write**:  
  - Can log, edit, and delete their own sleep records  
  - Cannot modify static baby info (e.g., name, age, parent info)  
  - Cannot edit or write consultant notes  
- **View**: Read-only display of the coach’s recommendations  
- No access to other babies or coach/parent data  

### Invitations

- Cannot generate or view invite codes  

---

## Coach User

### Authentication

- Signs up with email, password and a one-time invite code setting them up as a coach user. 
- Authenticated via Firebase and flagged as role: `coach`  

### Baby Record Access

- **Read/Write**:  
  - Can view, add, and edit any baby they created  
  - Can write or update consultant notes  
  - Can view and export all associated sleep records  
  - Can archive or restore a baby  
  - Cannot access babies created by other coaches  
  - Can access their own coach dashboard with the babies assigned to them

### Invitations

- Can create new baby profiles and generate invite codes for parents only 
- Get assigned as the baby’s coach  for baby records they created
- Can see whether a parent has redeemed an invite and submitted sleep logs  

---

## Admin User

### Authentication

- Logs in with email and password  
- Has role: `admin` (separate from coach)  
- the initial admin is manually entered in the firebase authenticaion

### Baby Record Access

- Full access to all data in the system:  
  - Can view, edit, or delete any baby or sleep record  
  - Can impersonate any user (coach or parent)  
  - Can restore or permanently delete any archived baby  

### Invitations & User Management

- Can manage coach and parent accounts  
- Can approve or reject new coach registrations  
- Can generate invite codes (for coaches or parents seperatly)  
- Can connect as other users for debugging/support  
