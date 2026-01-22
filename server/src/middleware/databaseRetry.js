class DatabaseRetry {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 2000; // 2 seconds
    this.isHealthy = true;
  }

  async executeWithRetry(operation, operationName = 'Database operation') {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 ${operationName} - Attempt ${attempt}/${this.maxRetries}`);
        const result = await operation();
        this.isHealthy = true;
        return result;
        
      } catch (error) {
        lastError = error;
        console.log(`❌ ${operationName} failed (Attempt ${attempt}): ${error.message}`);
        
        // Don't retry for certain errors
        if (this.isFatalError(error)) {
          console.log('🚨 Fatal error, not retrying');
          break;
        }
        
        // Wait before retry (except on last attempt)
        if (attempt < this.maxRetries) {
          console.log(`⏳ Waiting ${this.retryDelay}ms before retry...`);
          await this.delay(this.retryDelay);
        }
      }
    }
    
    this.isHealthy = false;
    throw new Error(`${operationName} failed after ${this.maxRetries} attempts. Last error: ${lastError.message}`);
  }

  isFatalError(error) {
    // Don't retry authentication errors (wrong password, etc.)
    const fatalCodes = ['ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR'];
    return fatalCodes.some(code => error.code === code);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getHealth() {
    return {
      healthy: this.isHealthy,
      maxRetries: this.maxRetries,
      retryDelay: this.retryDelay
    };
  }
}

// Create singleton instance
const databaseRetry = new DatabaseRetry();
export default databaseRetry;