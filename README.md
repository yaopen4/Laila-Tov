# Laila Tov – Baby Sleep Tracking App

**Laila Tov** (לילה טוב – “Good Night”) is a web application that helps sleep consultants and parents track and manage baby sleep patterns.  
It provides an organized, collaborative environment where consultants can monitor multiple families while parents record daily sleep data.

---

## Overview

The platform enables consultants to follow each baby's sleep history and provide personalized feedback, while parents easily log sleep cycles and view their coach’s notes — all in one secure, real-time system.

The application is built on **Next.js**, **React**, and **Firebase** (Authentication + Firestore) for data storage and real-time synchronization.

---

## Key Features

### For Coaches
- Dashboard showing all assigned babies and their latest sleep updates.  
- Add, edit, archive, or restore baby profiles.  
- Write consultant notes visible to parents.  
- Generate unique invite codes for new parent accounts.  
- Export baby sleep data to CSV or PDF.  

### For Parents
- Log daily sleep cycles (bedtime, wake time, and other details).  
- Edit or delete recent sleep records.  
- View full sleep history for their baby.  
- See consultant notes and recommendations (read-only).  

### System
- Real-time updates between parents and coaches.  
- Secure Firebase Authentication and Firestore data storage.  
- Responsive design with full Hebrew right-to-left support.  

---

## User Roles & Permissions

| Role | Access | Description |
|------|---------|-------------|
| **Parent** | Read/write only their own baby's records | Can log, edit, and delete personal sleep data. Can view coach notes but cannot modify them or see other families. |
| **Coach** | Read/write for babies they created | Can manage assigned babies, add notes, and invite parents. Cannot access other coaches’ data. |
| **Admin** | Full system access | Can manage all users and data, approve new coaches, and impersonate any account for support. |

All data is synchronized securely through Firebase. Each user’s permissions are enforced both in the interface and at the database level.

---

## Technology

- **Next.js + React** – Front-end framework and UI logic  
- **TypeScript** – Type-safe development  
- **Firebase (Auth + Firestore)** – Authentication, database, and hosting  
- **Tailwind CSS + ShadCN UI** – Responsive design system  
- **Lucide Icons**, **date-fns** – Utilities and visuals  

---

## Security

The app uses Firebase Authentication for identity and Firestore rules to enforce data isolation:  
- Parents can only access their own baby’s records.  
- Coaches can access only their assigned babies.  
- Admins have full control for maintenance and oversight.

Before deployment, appropriate Firestore security rules must be applied to protect user data.

---