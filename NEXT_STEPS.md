# Next Steps for Laila Tov App Development

This document outlines the upcoming tasks and potential enhancements for the Laila Tov application.

## To-Do Items:

- [ ] **Fix Permission Issue:**
    -   Thoroughly review and test Firestore security rules to ensure all user roles (admin, coach, parent) have the correct access permissions for all intended operations. Address any "Missing or insufficient permissions" errors.

- [ ] **Make App Faster:**
    -   Analyze application performance, especially for data-heavy pages like dashboards.
    -   Optimize Firestore queries (e.g., use more specific queries, consider denormalization where appropriate).
    -   Implement pagination or infinite scrolling for long lists (e.g., baby list for admins/coaches, sleep history for parents).
    -   Review Next.js build outputs and optimize client-side JavaScript bundles.
    -   Leverage Next.js features like Server Components and Route Handlers effectively for data fetching.

- [ ] **Buy a URL:**
    -   Purchase a custom domain name for the application (e.g., `lailatov.com`).
    -   Configure DNS settings to point the custom domain to your Firebase Hosting deployment.

- [ ] **Add 'Connect As' Functionality (Admin):**
    -   For administrators, implement a feature to temporarily impersonate a coach or a parent.
    -   This would be useful for troubleshooting or providing support without needing the user's direct credentials.
    -   Requires careful security considerations and clear UI indicators when an admin is impersonating.

- [ ] **Add 'Buy Me a Coffee' / 'About' Button:**
    -   Integrate a button or link (e.g., in the footer or a settings page) that directs users to an external "Buy Me a Coffee" page or an "About Us/App" website.
    -   This could be a static informational site hosted separately or a page within the app if appropriate.

- [ ] **Allow Coaches to See the Status of Their Invites:**
    -   Enhance the Coach Dashboard to display a list of invites they have created.
    -   Show the status of each invite (e.g., "Pending - Email 1 redeemed", "Pending - Email 2 redeemed", "Completed", "Expired").
    -   *(Optional Enhancement):* Allow coaches to resend or revoke pending invites.

- [ ] **Build Admin Dashboard (Further Enhancements):**
    -   While a basic admin dashboard exists for reassigning babies and managing users/coaches, consider adding more features:
        -   Viewing system statistics (e.g., number of active users, babies, coaches).
        -   Managing coach applications/approvals directly from the dashboard instead of Firestore console.
        -   Content management features if applicable.
        -   Viewing audit logs or activity feeds.
        -   Tools for managing user data (e.g., resetting parent passwords if needed, editing user profiles).

## General Considerations:

-   **Testing:** Continuously test all new features and fixes across different roles and devices.
-   **Security:** Regularly review security rules and authentication/authorization logic as the app evolves.
-   **User Feedback:** Gather feedback from early users (coaches, parents) to guide further development.
