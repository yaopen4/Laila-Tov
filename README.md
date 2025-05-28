
# Laila Tov - Baby Sleep Tracking App

"Laila Tov" (לילה טוב - Good Night) is a Next.js application designed to help sleep consultants and parents track and manage baby sleep patterns. It provides a dashboard for consultants to manage multiple babies and a separate interface for parents to log sleep data.

**IMPORTANT: This application is configured to work with Firebase (Authentication and Firestore) for data persistence and real-time updates. You MUST set up your own Firebase project and configure the application accordingly.**

## Key Features

*   **Consultant Dashboard**:
    *   View and manage all active babies.
    *   Search and filter functionalities.
    *   Export data for selected babies (CSV per baby, or a consolidated PDF via browser print).
*   **Parent View**:
    *   Dedicated interface for parents to log daily sleep records for their baby.
    *   View consultant recommendations.
    *   View history of sleep records, including the option to edit or delete the latest record.
*   **Baby Management (Consultant)**:
    *   Add new baby profiles with details like name, age, parent information, consultant notes, etc.
    *   Edit existing baby profiles.
    *   Archive baby profiles (removes them from the active dashboard).
    *   View archived babies, unarchive them, or permanently delete them.
*   **Sleep Logging (Parent)**:
    *   Parents can log detailed sleep cycles including bedtime, time to fall asleep, who put the baby to sleep, how they fell asleep, and wake time.
    *   Edit and delete existing sleep records.
*   **Consultant Notes**: Consultants can add recommendations and notes for parents, which are displayed in the parent view.
*   **User Authentication (Firebase)**: Uses Firebase Authentication. Parents are identified by an email derived from their username (e.g., `parentUsername@lailatov.app`). The consultant uses a predefined email (e.g., `coach@lailatov.app`).
*   **Data Storage (Firestore)**: All data (babies, sleep records) is stored in Firestore, enabling persistence and real-time updates.
*   **Real-time Updates**: Changes made by parents or consultants are reflected in real-time across devices.
*   **Responsive Design**: UI adapts for different screen sizes, including a mobile-friendly sidebar.

## Tech Stack

*   **Next.js**: React framework for server-side rendering and static site generation.
*   **React**: JavaScript library for building user interfaces.
*   **TypeScript**: Superset of JavaScript adding static typing.
*   **Firebase**: Backend-as-a-Service for Authentication and Firestore database.
*   **ShadCN UI**: Re-usable UI components.
*   **Tailwind CSS**: Utility-first CSS framework for styling.
*   **Lucide Icons**: Icon library.
*   **date-fns**: Library for date manipulation and formatting.
*   **Genkit (AI)**: (Boilerplate included, specific AI features can be built upon this).

## Getting Started

1.  **Clone the repository (if applicable) or ensure all project files are present.**
2.  **Set up Firebase Project**:
    *   Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project (or use an existing one).
    *   **Enable Authentication**: In your Firebase project, go to Authentication -> Sign-in method, and enable "Email/Password".
    *   **Enable Firestore**: In your Firebase project, go to Firestore Database and create a database. Start in **test mode** for initial development (this allows open read/write access - **IMPORTANT: Secure your database with Firestore Security Rules before going to production**).
    *   **Register your Web App**: In your Firebase project settings, add a new Web App. Firebase will provide you with a configuration object.
3.  **Configure Firebase in the App**:
    *   Create a file named `.env.local` in the root of your project.
    *   Add your Firebase configuration keys to this file, prefixed with `NEXT_PUBLIC_`:
        ```env
        NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_API_KEY"
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
        NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_STORAGE_BUCKET"
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_MESSAGING_SENDER_ID"
        NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID"
        ```
    *   Replace `"YOUR_..."` with your actual Firebase project configuration values.
4.  **Install dependencies:**
    ```bash
    npm install
    # or
    # yarn install
    # or
    # pnpm install
    ```
5.  **Run the development server:**
    ```bash
    npm run dev
    # or
    # yarn dev
    # or
    # pnpm dev
    ```
    The application will typically be available at `http://localhost:9002`.

## Login Credentials & User Creation

*   **Consultant**: Sign up using the email `coach@lailatov.app` (or any other email you designate for the coach) and a password of your choice. The application identifies the coach by this email.
*   **Parent**:
    *   When a consultant adds a new baby, they specify a "Parent Username".
    *   Parents will sign up using an email formatted as `[Parent Username]@lailatov.app` (e.g., if username is `cohen-family`, signup email is `cohen-family@lailatov.app`) and a password of their choice.
    *   After signing up, they can log in with these credentials. The application will then associate them with the baby profile matching their `parentUsername`.

## Security Considerations

*   **Firebase Security Rules**: **CRITICAL!** The default Firestore setup in test mode allows open access. **You MUST write and deploy appropriate Firestore Security Rules** to protect your data before deploying to production. Rules should ensure:
    *   Users can only read/write data they are authorized for (e.g., a parent can only access their own baby's data).
    *   Coaches have appropriate access to manage babies.
    *   Proper input validation and data sanitization at the database level.
*   **Authentication & Authorization**: Firebase Authentication handles user identity. Authorization logic (who can access what) is enforced through Firestore Security Rules and potentially within Next.js API routes if you build them.
*   **Input Validation**: Zod is used for client-side form validation. Server-side validation (e.g., in Firebase Cloud Functions or your backend API if you build one) is crucial for production.
*   **Sensitive Data**: Review how and where sensitive data is stored and ensure it complies with privacy regulations.

## Mobile Compatibility

The application is designed to be responsive and mobile-friendly. Key aspects include:
*   A collapsible sidebar that transitions to an off-canvas menu on mobile devices.
*   Responsive grid layouts for forms and lists.
*   Use of Tailwind CSS, which facilitates responsive design.

However, for a production-ready mobile experience, **comprehensive testing on a variety of mobile devices, screen sizes, and operating systems is crucial.** This ensures an optimal user experience, identifies any touch-specific issues, and verifies performance on mobile networks.

## Future Enhancements & Considerations

*   **Advanced Firestore Security Rules**: Implement comprehensive and granular security rules.
*   **Server-Side Logic (Cloud Functions)**: For more complex operations, data validation, or tasks that shouldn't be client-driven (e.g., creating a parent user in Auth when a coach adds a baby, if desired).
*   **Comprehensive Automated Testing**: Implementing unit, integration, and end-to-end tests.
*   **Advanced Performance Optimization**: Deeper analysis and optimization as the application scales.
*   **Centralized Logging**: Implementing a more formal logging solution for production environments (e.g., Firebase Functions logs, or a third-party service).
*   **Accessibility (A11y) Audit**: Ensuring all components and interactions are fully accessible.

This project was bootstrapped for Firebase Studio.
