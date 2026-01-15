# Learning Management System (LMS)

A comprehensive full-stack Learning Management System built with modern web technologies.

## Features

- User Authentication & Authorization
- Course Management
- Student Enrollment System
- Content Delivery
- Progress Tracking
- Interactive Learning Tools
- Assessment System

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Redux Toolkit

### Backend

- Node.js
- Express
- MySQL Database
- JSON Web Tokens (JWT)

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MySQL
- npm or yarn

### Installation

1. Clone the repository

2. Navigate to the project directory:

3. Install the dependencies:

   ```bash
   npm install
   ```


4. Set up the environment variables:

   - Create a `.env` file in the root directory.
   - Add the necessary environment variables as specified in `.env.sample`.

5. Run the development server:

   ```bash
   npm run dev
   ```

6. Open your browser and visit `http://localhost:3000` to view the application.



### Database Setup

1. Ensure MySQL is running on your machine.

2. Create a new database for the project.

3. Update the database configuration in the `.env` file with your database credentials.

7. Run initial migration with plus seed:
```
   npm run db-setup
```

