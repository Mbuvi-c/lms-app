import express from 'express';
import databaseRetry from '../middleware/databaseRetry.js';
import { Sequelize } from 'sequelize';

const router = express.Router();

// Test database connection with retry logic
router.get('/test-retry', async (req, res) => {
  try {
    const result = await databaseRetry.executeWithRetry(
      async () => {
        // Your existing database operation
        const sequelize = new Sequelize(
          process.env.DB_NAME,
          process.env.DB_USER,
          process.env.DB_PASSWORD,
          {
            host: process.env.DB_HOST,
            dialect: 'mysql'
          }
        );
        await sequelize.authenticate();
        return { message: 'Database connected!', timestamp: new Date() };
      },
      'Database Connection Test'
    );
    
    res.json({
      success: true,
      message: 'Operation succeeded with retry logic',
      data: result,
      health: databaseRetry.getHealth()
    });
    
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable',
      error: error.message,
      health: databaseRetry.getHealth(),
      instruction: 'Try turning MySQL service on/off to see retry logic in action'
    });
  }
});

// Simulate failure demo
router.get('/simulate-failure', async (req, res) => {
  let attemptLog = [];
  
  const fakeOperation = async () => {
    attemptLog.push(`Attempt at ${new Date().toLocaleTimeString()}`);
    throw new Error('Simulated database failure');
  };

  try {
    await databaseRetry.executeWithRetry(fakeOperation, 'Simulated Operation');
    res.json({ success: true });
  } catch (error) {
    res.json({
      success: false,
      message: 'Demonstration complete',
      attempts: attemptLog.length,
      attemptLog: attemptLog,
      finalError: error.message,
      note: 'This shows retry logic working - 3 attempts were made before failing'
    });
  }
});

export default router;