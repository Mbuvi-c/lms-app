import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

// Helper function to parse DATABASE_URL
function getDbConfigFromUrl() {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    return {
      database: url.pathname.substring(1),
      username: url.username,
      password: url.password,
      host: url.hostname,
      port: url.port || 3306
    };
  }
  
  // Fallback to individual env vars for local development
  return {
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306
  };
}

const dbConfig = getDbConfigFromUrl();
console.log("🔗 Database Config:", {
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  user: dbConfig.username
});

// Create Sequelize instance
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: "mysql",
    logging: process.env.NODE_ENV === "development" ? console.log : false,
    pool: {
      max: parseInt(process.env.DB_POOL_MAX) || 10,
      min: 0,
      acquire: 30000,
      idle: parseInt(process.env.DB_POOL_IDLE) || 10000,
    },
    timezone: "+00:00",
    dialectOptions: {
      decimalNumbers: true,
      ssl: process.env.NODE_ENV === "production" ? { require: true } : false
    },
  }
);

// Create a MySQL pool for raw queries
const pool = mysql.createPool({
  host: dbConfig.host,
  user: dbConfig.username,
  password: dbConfig.password,
  database: dbConfig.database,
  port: dbConfig.port,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_POOL_MAX) || 10,
  queueLimit: 0,
  timezone: "+00:00",
  decimalNumbers: true,
  namedPlaceholders: true,
  idleTimeout: parseInt(process.env.DB_POOL_IDLE) || 10000,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined
});

// Test database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connection has been established successfully.");
  } catch (error) {
    console.error("❌ Unable to connect to the database:", error.message);
    console.error("Full error:", error);
  }
};

testConnection();

// Helper function for transactions
export const transaction = async (callback) => {
  const t = await sequelize.transaction();
  try {
    const result = await callback(t);
    await t.commit();
    return result;
  } catch (error) {
    await t.rollback();
    throw error;
  }
};

export { sequelize, pool };