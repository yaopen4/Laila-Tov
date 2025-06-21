# Laila Tov App Features

This document outlines the features available in the application, based on the current state of the codebase.

## Completed Features

### Core & Authentication
- User login for registered coaches and parents.
- New coach registration through a popup dialog, pending admin approval.
- Parent sign-up process is handled by redeeming a unique invite code.
- System-wide dark mode support with a theme toggle button.
- Responsive design for mobile and desktop use.
- Toast notifications for user actions and system feedback.

### Coach Functionality
- Dashboard view displaying a list of all active babies.
- Search functionality to filter babies on the dashboard.
- Ability to create a unique invite code for parents by filling out baby details and parent emails.
- Edit existing baby profiles and update consultant notes.
- Export sleep data for selected babies to either individual CSV files or a consolidated PDF.
- View a separate page for archived babies.
- Restore a baby from the archive to the active list.
- Permanently delete a baby and all their associated sleep data from the archive.

### Parent Functionality
- Log daily sleep data for their baby, including multiple sleep cycles per day.
- View and edit the most recent sleep record submitted.
- Delete the most recent sleep record submitted.
- View a history of all previously submitted sleep records.
- See read-only recommendations and notes posted by their consultant.
- View the baby's page, which is also accessible to the linked coach for data review.

## Unfinished / Future Features

- An admin dashboard for user management and system oversight does not exist yet.
- Coaches cannot see the status of invites they have created (e.g., pending, redeemed, expired).
- Admin functionality to "connect as" (impersonate) another user is not implemented.
- Comprehensive and production-ready Firestore security rules are not yet defined.
- Performance enhancements for pages that handle large amounts of data have not been implemented.
- AI features using the configured Genkit library are not yet implemented.
