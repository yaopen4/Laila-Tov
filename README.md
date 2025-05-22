# Laila Tov - Baby Sleep Tracking App

"Laila Tov" (לילה טוב - Good Night) is a Next.js application designed to help sleep coaches and parents track and manage baby sleep patterns. It provides a dashboard for coaches to manage multiple babies and a separate interface for parents to log sleep data.

## Key Features

*   **Coach Dashboard**: View and manage all active babies. Search and filter functionalities.
*   **Parent View**: Dedicated interface for parents to log daily sleep records for their baby.
*   **Baby Management**:
    *   Add new baby profiles with details like name, age, parent information, etc.
    *   Edit existing baby profiles.
    *   Archive and unarchive baby profiles.
    *   Permanently delete archived babies.
*   **Sleep Logging**:
    *   Parents can log detailed sleep cycles including bedtime, time to fall asleep, who put the baby to sleep, how they fell asleep, and wake time.
    *   Edit and delete existing sleep records.
*   **Coach Notes**: Coaches can add recommendations and notes for parents.
*   **Data Export**:
    *   Coaches can export sleep data for each active baby as a separate CSV file.
    *   Coaches can generate a consolidated PDF (via browser print) of all active babies' data.
*   **Responsive Design**: UI adapts for different screen sizes.
*   **Mock Data**: Uses in-memory mock data for easy setup and testing (no database required).

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

This project was bootstrapped for Firebase Studio.
