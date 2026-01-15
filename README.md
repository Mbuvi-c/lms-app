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

- Node.js (v20 or higher)
- MySQL
- npm or yarn

### Frontend

### Installation

1. Navigate to the project directory:
```
   cd server
```   
2. Install the dependencies:

   ```bash
   npm install
   ```
3. Run the development server:

   ```bash
   npm run dev
   ```
4. Open your browser and visit `http://localhost:5173` to view the application.



### Server

### Installation

1. Navigate to the project directory:
```
   cd server
```   

2. Install the dependencies:

   ```bash
   npm install
   ```


3. Set up the environment variables:

   - Create a `.env` file in the root directory.
   - Add the necessary environment variables as specified in `.env.sample`.

4. Run the development server:

   ```bash
   npm run dev
   ```

5. Open your browser and visit `http://localhost:3000` to view the application.



### Database Setup

1. Ensure MySQL is running on your machine.

2. Create a new database for the project.

3. Update the database configuration in the `.env` file with your database credentials.

4. Run initial migration with plus seed:
```
   npm run db-setup
```


### PM2
1. Open terminal and install globally
```   
   npm install -g pm2
```
2. How to run it
```
   pm2 monitor
```
3. Follow instructions from their website
or 
Navigate to server directory in separate terminal
```
   cd server
```

```   
   pm2 start server.js --name "lms"
```
How to check status

```
   pm2 list
```

