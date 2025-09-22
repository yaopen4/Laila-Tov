# Laila Tov App Features

This document outlines the features available in the application, based on the current state of the codebase.  
**Last update:** 20/7/2025

---

## Unfinished / Future Features

### Phase 1
- [ ] Buy domain  
- [ ] Make a website  
- [ ] Parent invite system 

### Phase 2
- [ ] Recovery mechanism  
- [ ] Make App Faster  
- [ ] Admin dashboard:  
  - Status and data  
  - Manage coaches/parents/baby pages  
  - Connect as other user types  
- [ ] Coach dashboard:  
  - Parent status dashboard for coach  
  - "Last night" dashboard for coach  
- [ ] Mobile version  
- [ ] Genkit library not yet implemented (not sure)  
- [ ] "About your coach" section in parent's page  
- [ ] Security  
- [ ] create and manage separate invite codes for 'coach' and 'parent' roles, accessible only by admin

### QA 
- [ ] 2 coaches 
- [ ] 2 parents same baby
- [ ] 

---

## Completed Features  
([V] = Completed, [C] = Check/Confirm)

### Core & Authentication
- [ ] New coach registration through a popup dialog, pending admin approval  
- [V] User login for registered coaches and parents  
- [V] Parent sign-up process is handled by redeeming a unique invite code  
- [V] System-wide dark mode support with a theme toggle button  
- [V] Toast notifications for user actions and system feedback  
- [V] Features file (done and to do)  

### Coach Functionality
- [V] Dashboard view displaying a list of all active babies  
- [V] Search functionality to filter babies on the dashboard  
- [V] Ability to create a unique invite code for parents by filling out baby details and parent emails  
- [V] Edit existing baby profiles and update consultant notes  
- [V] Export sleep data for selected babies to either individual CSV files or a consolidated PDF  
- [V] View a separate page for archived babies  
- [V] Restore a baby from the archive to the active list  
- [V] Permanently delete a baby and all their associated sleep data from the archive  

### Parent Functionality
- [V] Log daily sleep data for their baby, including multiple sleep cycles per day  
- [V] View and edit the most recent sleep record submitted  
- [V] Delete the most recent sleep record submitted  
- [V] View a history of all previously submitted sleep records  
- [V] See read-only recommendations and notes posted by their consultant  
- [V] View the baby's page, which is also accessible to the linked coach for data review  

### Admin Functionality
- [V] under the "הזמנות קיימות" status column, give the admin the power to revoke an invitaion. 
- [V] after opening the page of a coach data, let the admin get into the baby's bage by clicking on the baby's name.
- [V] make the default invitaion for coach 
- [V] Ensure that when an invitation code is generated in Firebase, a placeholder user record is created in the database with the assigned role ("parent" or "coach") and associated email. The invitation code must be valid only for that email, expire after one use or after 30 days, and assign the correct role upon successful sign-up. During sign-up, validate the provided email and code before activating the user account and granting access to the app.
- [V] make all the necesary changes to the firestore rules so all the admin functionality works. keep in mind the @User Access.md file and try to make as little changes to the firestore rules as possible.