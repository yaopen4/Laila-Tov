# Laila Tov App Features

This document outlines the features available in the application, based on the current state of the codebase.

## Unfinished / Future Features

[] Comprehensive and production-ready Firestore security rules are not yet defined.
[] An admin dashboard for user management and system oversight does not exist yet.
[] Coaches cannot see the status of invites they have created (e.g., pending, redeemed, expired).
[] Admin functionality to "connect as" (impersonate) another user is not implemented.
[] Performance enhancements for pages that handle large amounts of data have not been implemented.
[] AI features using the configured Genkit library are not yet implemented.

---

## Completed Features

### Core & Authentication
[V] User login for registered coaches and parents.
[V] New coach registration through a popup dialog, pending admin approval.
[V] Parent sign-up process is handled by redeeming a unique invite code.
[V] System-wide dark mode support with a theme toggle button.
[V] Responsive design for mobile and desktop use.
[V] Toast notifications for user actions and system feedback.

### Coach Functionality
[V] Dashboard view displaying a list of all active babies.
[V] Search functionality to filter babies on the dashboard.
[V] Ability to create a unique invite code for parents by filling out baby details and parent emails.
[V] Edit existing baby profiles and update consultant notes.
[V] Export sleep data for selected babies to either individual CSV files or a consolidated PDF.
[V] View a separate page for archived babies.
[V] Restore a baby from the archive to the active list.
[V] Permanently delete a baby and all their associated sleep data from the archive.

### Parent Functionality
[V] Log daily sleep data for their baby, including multiple sleep cycles per day.
[V] View and edit the most recent sleep record submitted.
[V] Delete the most recent sleep record submitted.
[V] View a history of all previously submitted sleep records.
[V] See read-only recommendations and notes posted by their consultant.
[V] View the baby's page, which is also accessible to the linked coach for data review.
