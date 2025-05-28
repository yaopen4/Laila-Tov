
# Laila Tov - Baby Sleep Tracking App

"Laila Tov" (לילה טוב - Good Night) is a Next.js application designed to help sleep coaches and parents track and manage baby sleep patterns. It provides a dashboard for coaches to manage multiple babies and a separate interface for parents to log sleep data.

**Important Note: This application currently uses in-memory mock data and client-side authentication for demonstration and development purposes only. It does not connect to a persistent database and is not suitable for production environments without significant modifications, including a secure backend, robust authentication, and proper data storage.**

## Key Features

*   **Coach Dashboard**:
    *   View and manage all active babies.
    *   Search and filter functionalities.
    *   Export data for selected babies (CSV per baby, or a consolidated PDF via browser print).
*   **Parent View**:
    *   Dedicated interface for parents to log daily sleep records for their baby.
    *   View coach recommendations.
    *   View history of sleep records, including the option to edit or delete the latest record.
*   **Baby Management (Coach)**:
    *   Add new baby profiles with details like name, age, parent information, coach notes, etc.
    *   Edit existing baby profiles.
    *   Archive baby profiles (removes them from the active dashboard).
    *   View archived babies, unarchive them, or permanently delete them.
*   **Sleep Logging (Parent)**:
    *   Parents can log detailed sleep cycles including bedtime, time to fall asleep, who put the baby to sleep, how they fell asleep, and wake time.
    *   Edit and delete existing sleep records.
*   **Coach Notes**: Coaches can add recommendations and notes for parents, which are displayed in the parent view.
*   **User Authentication (Client-Side Mock)**: Simple username-based distinction between "coach" and "parent" roles with client-side route protection.
*   **Responsive Design**: UI adapts for different screen sizes, including a mobile-friendly sidebar.

## Tech Stack

*   **Next.js**: React framework for server-side rendering and static site generation.
*   **React**: JavaScript library for building user interfaces.
*   **TypeScript**: Superset of JavaScript adding static typing.
*   **ShadCN UI**: Re-usable UI components.
*   **Tailwind CSS**: Utility-first CSS framework for styling.
*   **Lucide Icons**: Icon library.
*   **date-fns**: Library for date manipulation and formatting.
*   **Genkit (AI)**: (Boilerplate included, specific AI features can be built upon this).

## Getting Started

1.  **Clone the repository (if applicable) or ensure all project files are present.**
2.  **Install dependencies:**
    ```bash
    npm install
    # or
    # yarn install
    # or
    # pnpm install
    ```
3.  **Run the development server:**
    ```bash
    npm run dev
    # or
    # yarn dev
    # or
    # pnpm dev
    ```
    The application will typically be available at `http://localhost:9002`.

## Login Credentials (Mock)

*   **Coach**: Use username `coach`.
*   **Parent**: Use the `parentUsername` defined for a baby (e.g., `cohen-family`, `levi-family` for pre-populated mock data). This will log you into that specific baby's parent view.

## Security Considerations (Mock Application)

*   **Authentication & Authorization**: The current system uses client-side `localStorage` to simulate user sessions. This is **not secure** and is only for demonstration. Real-world applications require robust server-side authentication and authorization.
*   **Data Storage**: All data is stored in-memory within the browser and is lost upon page reload. Sensitive data should never be stored this way in a production application.
*   **Input Validation**: Basic input validation is performed using Zod on forms, but comprehensive server-side validation would be necessary for a production app.

## Future Enhancements & Considerations

While this application provides a solid foundation, areas for future engineering improvements include:
*   **Secure Backend & Database**: Implementing a proper backend service with a persistent, secure database.
*   **Robust Server-Side Authentication**: Moving beyond client-side mock authentication.
*   **Comprehensive Automated Testing**: Implementing unit, integration, and end-to-end tests.
*   **Advanced Performance Optimization**: Deeper analysis and optimization as the application scales.
*   **Centralized Logging**: Implementing a more formal logging solution for production environments.
*   **Accessibility (A11y) Audit**: Ensuring all components and interactions are fully accessible.

This project was bootstrapped for Firebase Studio.

