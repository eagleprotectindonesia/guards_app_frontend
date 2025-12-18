# EP Guard Scheduling

**EP Guard Scheduling** is a comprehensive Full-Stack application designed for managing security guard schedules, tracking attendance, and monitoring real-time check-ins. Built with **Next.js 16 (App Router)**, it provides a robust solution with a distinct separation between administrative control and guard operations.

## Features

-   **Admin Dashboard (`/admin`)**:
    -   Comprehensive scheduling management for shifts.
    -   Management of Guards, Sites, and Shift Types.
    -   **Real-time Monitoring**: Server-Sent Events (SSE) based dashboard for live alerts and active shift tracking.
    -   Alert resolution and management (Resolve/Forgive workflows).
-   **Guard Interface (`/guard`)**:
    -   Mobile-first design optimized for on-site use.
    -   Secure login and shift viewing.
    -   **Strict Check-in System**: Validates check-ins based on time windows and geolocation.
    -   Attendance recording with location verification.
-   **Automated Monitoring**:
    -   Background worker process (`worker.ts`) monitors all active shifts.
    -   Automatic alert generation for missed check-ins or attendance.
    -   Auto-resolution of alerts upon late check-ins.

## Tech Stack

-   **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
-   **Language:** TypeScript
-   **Database:** PostgreSQL
-   **ORM:** [Prisma](https://www.prisma.io/)
-   **Caching & Queue:** Redis (via `ioredis`)
-   **Styling:** [Tailwind CSS](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/)
-   **Validation:** [Zod](https://zod.dev/)
-   **Maps:** Google Maps Integration

## Prerequisites

Ensure you have the following installed:

-   **Node.js** (v20 or higher)
-   **PostgreSQL**
-   **Redis**

## Getting Started

1.  **Clone the repository** and install dependencies:

    ```bash
    npm install
    ```

2.  **Environment Setup**:
    Copy `.example-env` to `.env` and configure your database and Redis connections.

    ```bash
    cp .example-env .env
    ```

3.  **Database Setup**:
    Generate the Prisma client and push the schema to your database.

    ```bash
    # Generate Prisma Client
    npx prisma generate

    # Push schema to DB
    npx prisma db push
    ```

4.  **Run the Application**:
    Start the development server. This command runs both the Next.js app and the background worker concurrently.

    ```bash
    npm run dev
    ```

    -   **Admin Dashboard**: [http://localhost:3000/admin](http://localhost:3000/admin)
    -   **Guard Interface**: [http://localhost:3000/guard](http://localhost:3000/guard)

## Key Commands

-   `npm run dev`: Starts the Next.js development server and the background worker.
-   `npm run build`: Builds the application for production.
-   `npm run lint`: Runs ESLint for code quality and type checking.
-   `npx tsx --watch worker.ts`: Runs the background worker independently (useful for debugging worker logic).

## Architecture Overview

-   **`/app`**: Main Next.js application source.
    -   **`/app/admin`**: Admin dashboard routes and components.
    -   **`/app/guard`**: Guard interface routes and components.
    -   **`/app/api`**: Backend Route Handlers.
-   **`/lib`**: Shared utilities, including authentication (`admin-auth.ts`, `guard-auth.ts`) and database connections.
-   **`/prisma`**: Database schema (`schema.prisma`) and migrations.
-   **`worker.ts`**: The dedicated background Node.js process for monitoring shifts and generating alerts.

## Documentation

For more detailed information on the check-in logic and alerting system, please refer to [GUARD_CHECKIN_ALERTING.md](GUARD_CHECKIN_ALERTING.md).