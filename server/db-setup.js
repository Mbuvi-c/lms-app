#!/usr/bin/env node
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Configure environment
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

// Database configuration
const config = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 3306,
};

// Unified SQL statements
const SQL = [
  `CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `USE ${process.env.DB_NAME}`,

  // 1. Users table (Corrected with status, first/last names)
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('student', 'instructor', 'admin') NOT NULL,
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    is_first_login BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role)
  )`,

  // 2. Courses table
  `CREATE TABLE IF NOT EXISTS courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    course_type ENUM('General Education', 'Major-Specific', 'Elective', 'Faculty-Specific') NOT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_created_by (created_by),
    FULLTEXT idx_search (title, description)
  )`,

  // 3. Enrollments table (Corrected with role)
  `CREATE TABLE IF NOT EXISTS enrollments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    course_id INT NOT NULL,
    role ENUM('student', 'instructor') NOT NULL,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_enrollment (user_id, course_id),
    INDEX idx_user (user_id),
    INDEX idx_course (course_id)
  )`,

  // 4. Posts table (Corrected with default title)
  `CREATE TABLE IF NOT EXISTS posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    author_id INT NOT NULL,
    title VARCHAR(255) NOT NULL DEFAULT 'Untitled Post',
    content TEXT NOT NULL,
    file_url VARCHAR(512),
    link_url VARCHAR(512),
    is_pinned BOOLEAN DEFAULT FALSE,
    allow_submissions BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_course (course_id),
    INDEX idx_author (author_id)
  )`,

  // 5. Submissions table
  `CREATE TABLE IF NOT EXISTS submissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    student_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_post_student (post_id, student_id)
  )`,

  // 6. Token Blacklist
  `CREATE TABLE IF NOT EXISTS token_blacklist (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token VARCHAR(512) NOT NULL,
    user_id INT,
    reason VARCHAR(50) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_token (token),
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at)
  )`,

  // 7. Analytics table
  `CREATE TABLE IF NOT EXISTS analytics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    metric_name VARCHAR(255) NOT NULL,
    value INT NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_metric (metric_name),
    INDEX idx_recorded (recorded_at)
  )`,
];

async function setupDatabase() {
  let conn;
  try {
    conn = await mysql.createConnection(config);
    console.log("🔌 Connected to MySQL server");

    for (const sql of SQL) {
      await conn.query(sql);
      console.log(`✓ Executed table setup step...`);
    }

    // --- SEEDING LOGIC ---
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const defaultPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || "Admin@2026", saltRounds);

    // Seed Kenyan Users
    const users = [
      ['admin@jkuat.ac.ke', defaultPassword, 'admin', 'active', 'Otieno', 'Manyora', 'Otieno Manyora'],
      ['registrar@strathmore.edu', defaultPassword, 'admin', 'active', 'Catherine', 'Mutua', 'Catherine Mutua'],
      ['dr.mwenesi@ku.ac.ke', defaultPassword, 'instructor', 'active', 'Faith', 'Mwenesi', 'Dr. Faith Mwenesi'],
      ['prof.kamau@jkuat.ac.ke', defaultPassword, 'instructor', 'active', 'David', 'Kamau', 'Prof. David Kamau'],
      ['kwame.njoroge@student.com', defaultPassword, 'student', 'active', 'Kwame', 'Njoroge', 'Kwame Njoroge'],
      ['amani.cherono@student.com', defaultPassword, 'student', 'active', 'Amani', 'Cherono', 'Amani Cherono']
    ];

    console.log("🌱 Seeding Users...");
    for (const user of users) {
      await conn.query(
        `INSERT IGNORE INTO users (email, password, role, status, first_name, last_name, name) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        user
      );
    }

    // Seed Kenyan Courses
    console.log("🌱 Seeding Courses...");
    const courses = [
      ['Swahili Literature', 'Uchambuzi wa fasihi simulizi.', 'Major-Specific', 1],
      ['Agriculture in Arid Lands', 'Sustainable farming in Northern Kenya.', 'General Education', 3],
      ['Kenyan Law 101', 'Constitution of Kenya 2010 overview.', 'Elective', 1],
      ['Mobile Money Systems', 'Evolution of M-Pesa.', 'Major-Specific', 4]
    ];
    for (const c of courses) {
      await conn.query(`INSERT IGNORE INTO courses (title, description, course_type, created_by) VALUES (?, ?, ?, ?)`, c);
    }

    console.log("✅ Database setup and Kenyan seed completed successfully");
    console.log(`Admin login: admin@jkuat.ac.ke / ${process.env.ADMIN_PASSWORD || "Admin@2026"}`);

  } catch (err) {
    console.error("❌ Database setup failed:", err);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

setupDatabase();