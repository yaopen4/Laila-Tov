
# Laila Tov - Baby Sleep Tracking App

"Laila Tov" (לילה טוב - Good Night) is a Next.js application designed to help sleep coaches and parents track and manage baby sleep patterns. It provides a dashboard for coaches to manage multiple babies and a separate interface for parents to log sleep data.

**Note:** This application currently uses in-memory mock data for demonstration and development purposes. It does not connect to a persistent database.

## Key Features

*   **Coach Dashboard**:
    *   View and manage all active babies.
    *   Search and filter functionalities.
    *   Export data for selected babies (CSV per baby, or a consolidated PDF via browser print).
*   **Parent View**:
    *   Dedicated interface for parents to log daily sleep records for their baby.
    *   View coach recommendations.
    *   View history of sleep records.
*   **Baby Management (Coach)**:
    *   Add new baby profiles with details like name, age, parent information, coach notes, etc.
    *   Edit existing baby profiles.
    *   Archive baby profiles (removes them from the active dashboard).
    *   View archived babies and unarchive them.
    *   Permanently delete archived babies.
*   **Sleep Logging (Parent)**:
    *   Parents can log detailed sleep cycles including bedtime, time to fall asleep, who put the baby to sleep, how they fell asleep, and wake time.
    *   Edit and delete existing sleep records.
*   **Coach Notes**: Coaches can add recommendations and notes for parents, which are displayed in the parent view.
*   **User Authentication (Mock)**: Simple username-based distinction between "coach" and "parent" roles with client-side route protection.
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

## Future Enhancements & Considerations

While this application provides a solid foundation, areas for future engineering improvements include:
*   **Comprehensive Automated Testing**: Implementing unit, integration, and end-to-end tests.
*   **Persistent Data Storage**: Replacing mock data with a real database solution.
*   **Robust Backend Authentication**: Moving beyond client-side authentication checks.
*   **Advanced Performance Optimization**: Deeper analysis and optimization as the application scales.
*   **Centralized Logging**: Implementing a more formal logging solution for production environments.

This project was bootstrapped for Firebase Studio.
