import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import fs from  "fs";
import path from "path";
import { fileURLToPath } from "url";
import routes from "./src/routes/index.js";
import errorHandler, {
  notFoundHandler,
} from "./src/middleware/errorHandler.js";
import TokenBlacklist from "./src/models/TokenBlacklist.js";
import os from "os";  

// Initialize environment
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' });

// Create Express app
const app = express();

// ======================
//  Middleware Pipeline
// ======================
app.use(helmet());

app.use(
    cors({
        origin: ["http://localhost:5173", "http://localhost:5175" , "https://diligent-trust-production.up.railway.app" ], // Array of allowed origins
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: accessLogStream }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));



// ======================
//  Routes
// ======================

// Health Check (for Heroku/Cloud) - 
app.get("/health", (req, res) => {
  const healthData = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: "connected",
    environment: process.env.NODE_ENV || "development",
    region: process.env.HEROKU_REGION || "local",
    version: process.env.npm_package_version || "1.0.0"
  };
  res.json(healthData);
});

// Temporary database setup route (remove after tables created)
app.get("/setup-db", async (req, res) => {
  try {
    console.log("Running database setup...");
    const { exec } = await import('child_process');
    
    exec('cd /app && node db-setup.js', (error, stdout, stderr) => {
      if (error) {
        console.error("Setup error:", error);
        return res.json({ 
          success: false, 
          error: error.message,
          stderr: stderr 
        });
      }
      console.log("Setup output:", stdout);
      res.json({ 
        success: true, 
        message: "Database tables created successfully",
        output: stdout.substring(0, 500) // First 500 chars
      });
    });
  } catch (err) {
    console.error("Route error:", err);
    res.json({ success: false, error: err.message });
  }
});

// ... your existing /setup-db route ends here ...

// Add this route here - DIRECT TABLE CREATION
app.get("/create-tables-direct", async (req, res) => {
  try {
    console.log("Creating tables directly...");
    
    // Import mysql2 and bcryptjs
    const mysql = (await import("mysql2/promise")).default;
    const bcrypt = (await import("bcryptjs")).default;
    
    // Get database config from your DATABASE_URL
    const dbUrl = process.env.DATABASE_URL;
    console.log("Using DATABASE_URL:", dbUrl ? "Present" : "Missing");
    
    if (!dbUrl) {
      return res.json({ success: false, error: "DATABASE_URL not found" });
    }
    
    // Parse the DATABASE_URL
    const url = new URL(dbUrl);
    const config = {
      host: url.hostname,
      user: url.username,
      password: url.password,
      database: url.pathname.substring(1),
      port: url.port || 3306,
      multipleStatements: true
    };
    
    console.log("Connecting to:", config.host, "database:", config.database);
    
    // Create connection
    const conn = await mysql.createConnection(config);
    
    // Create users table only (for now)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('student', 'instructor', 'admin') NOT NULL,
        status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    console.log("✅ Users table created");
    
    // Insert admin user
    const saltRounds = 12;
    const defaultPassword = await bcrypt.hash("Admin@2026", saltRounds);
    
    await conn.query(
      `INSERT IGNORE INTO users (email, password, role, status, first_name, last_name, name) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['admin@jkuat.ac.ke', defaultPassword, 'admin', 'active', 'System', 'Admin', 'System Admin']
    );
    
    console.log("✅ Admin user created");
    
    await conn.end();
    
    res.json({ 
      success: true, 
      message: "Users table created and admin user added",
      login: "admin@jkuat.ac.ke / Admin@2026"
    });
    
  } catch (err) {
    console.error("Direct table creation error:", err);
    res.json({ 
      success: false, 
      error: err.message,
      code: err.code,
      sqlState: err.sqlState
    });
  }
});


// Performance Demo Endpoint
app.get("/api/performance", (req, res) => {
  const start = Date.now();
  // Simulate some processing
  const simulatedDelay = Math.random() * 100;
  
  setTimeout(() => {
    const responseTime = Date.now() - start;
    res.json({
      endpoint: "/api/performance",
      responseTime: `${responseTime}ms`,
      serverLoad: os.loadavg()[0],
      memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      timestamp: new Date().toISOString(),
      server: process.env.HEROKU_APP_NAME || "local-dev",
      region: process.env.HEROKU_REGION || "local"
    });
  }, simulatedDelay);
});

// Root route (KEEP ONLY THIS ONE)
app.get("/", (req, res) =>
  res.json({
    status: "running",
    api: `${process.env.API_PREFIX || "/api"}/v1`,
    docs: "/api-docs",
    health: "/health",
    performance: "/api/performance"
  })
);

// Your API routes
app.use(process.env.API_PREFIX || "/api", routes);
app.use(notFoundHandler);
app.use(errorHandler);

// ======================
//  Server Startup
// ======================
const PORT = process.env.PORT || 3000;

// DEBUG LOGS - ADD THESE LINES
console.log("🚀 Server starting...");
console.log("🌍 NODE_ENV:", process.env.NODE_ENV);
console.log("🔗 DATABASE_URL exists:", !!process.env.DATABASE_URL);
console.log("🚪 PORT:", PORT);
console.log("📁 __dirname:", __dirname);
// END DEBUG LOGS

const server = app.listen(PORT, () => {
  console.log(`
  🚀 Server running in ${process.env.NODE_ENV || "development"} mode
  🔗 http://localhost:${PORT}
  ⏱️ ${new Date().toLocaleString()}
  `);

  // Safe route logging attempt
  try {
    if (process.env.NODE_ENV === "development") {
      console.log("\nAvailable Routes:");
      const routeList = getRouteList(app);
      routeList.forEach((route) => console.log(route));
    }
  } catch (err) {
    console.log("\nRoute listing unavailable for this Express version");
  }

  // Set up scheduled tasks
  setupScheduledTasks();
});

// ======================
//  Safe Route Listing
// ======================
function getRouteList(app) {
  try {
    // Modern Express versions
    if (app._router && app._router.stack) {
      return extractRoutes(app._router.stack);
    }

    // Alternative approach for some Express versions
    const routes = [];
    app._router.stack.forEach((layer) => {
      if (layer.route) {
        routes.push(
          `${Object.keys(layer.route.methods).join(",").toUpperCase()} ${
            layer.route.path
          }`
        );
      }
    });
    return routes;
  } catch (err) {
    return ["Route listing not supported"];
  }
}

function extractRoutes(stack, path = "") {
  const routes = [];

  stack.forEach((layer) => {
    if (layer.route) {
      routes.push(
        `${Object.keys(layer.route.methods).join(",").toUpperCase()} ${path}${
          layer.route.path
        }`
      );
    } else if (layer.name === "router") {
      const routerPath =
        path +
        (layer.regexp.source === "^\\/?$"
          ? ""
          : layer.regexp.source
              .replace("^\\", "")
              .replace("\\/?$", "")
              .replace("(?=\\/|$)", ""));
      routes.push(...extractRoutes(layer.handle.stack, routerPath));
    }
  });

  return routes.sort();
}

// Set up scheduled tasks
const setupScheduledTasks = () => {
  // Clean up expired blacklisted tokens every day at midnight
  setInterval(async () => {
    const now = new Date();
    // Only run at approximately midnight
    if (now.getHours() === 0 && now.getMinutes() < 5) {
      console.log("Running scheduled cleanup of token blacklist...");
      const deletedCount = await TokenBlacklist.cleanupExpired();
      console.log(`Cleaned up ${deletedCount} expired tokens from blacklist`);
    }
  }, 1000 * 60 * 5); // Check every 5 minutes
};

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("\nServer shutting down...");
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  console.log("\nServer interrupted...");
  server.close(() => process.exit(0));
});