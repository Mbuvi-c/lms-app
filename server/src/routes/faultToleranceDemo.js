import express from 'express';
import databaseRetry from '../middleware/databaseRetry.js';
import { Sequelize } from 'sequelize';

const router = express.Router();

// Store connected SSE clients
const clients = [];

// SSE endpoint for real-time updates
router.get('/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);
  
  const clientId = Date.now();
  clients.push({ id: clientId, res });
  
  // Check database status every 2 seconds
  const checkDatabase = async () => {
    try {
      const sequelize = new Sequelize(
        process.env.DB_NAME,
        process.env.DB_USER,
        process.env.DB_PASSWORD,
        {
          host: process.env.DB_HOST,
          dialect: 'mysql',
          logging: false,
          pool: { max: 1, min: 0, idle: 10000 }
        }
      );
      
      const startTime = Date.now();
      await sequelize.authenticate();
      const responseTime = Date.now() - startTime;
      await sequelize.close();
      
      const data = {
        type: 'database-status',
        status: 'healthy',
        responseTime,
        timestamp: new Date().toISOString(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        },
        uptime: process.uptime()
      };
      
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      
    } catch (error) {
      const data = {
        type: 'database-status',
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        },
        uptime: process.uptime()
      };
      
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };
  
  // Initial check
  await checkDatabase();
  
  // Check every 2 seconds
  const interval = setInterval(checkDatabase, 2000);
  
  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(`: keepalive\n\n`);
  }, 30000);
  
  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(interval);
    clearInterval(keepAlive);
    const index = clients.findIndex(client => client.id === clientId);
    if (index !== -1) clients.splice(index, 1);
  });
});

// Broadcast to all clients (for manual triggers)
function broadcast(data) {
  clients.forEach(client => {
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

// Main Dashboard
router.get('/dashboard', (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Real-time Fault Tolerance Dashboard</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      
      body {
        font-family: 'Segoe UI', system-ui, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
        color: #333;
        transition: background 0.3s;
      }
      
      [data-theme="dark"] body {
        background: linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%);
        color: #e0e0e0;
      }
      
      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
      }
      
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 40px;
        padding: 20px;
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        border-radius: 20px;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      
      [data-theme="dark"] .header {
        background: rgba(0, 0, 0, 0.2);
      }
      
      .header h1 {
        font-size: 2.5rem;
        background: linear-gradient(45deg, #fff, #a8edea);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      
      [data-theme="dark"] .header h1 {
        background: linear-gradient(45deg, #a8edea, #fed6e3);
        -webkit-background-clip: text;
      }
      
      .theme-toggle {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        padding: 12px 24px;
        border-radius: 50px;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 1rem;
        transition: all 0.3s;
      }
      
      .theme-toggle:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: translateY(-2px);
      }
      
      .dashboard {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 30px;
        margin-bottom: 30px;
      }
      
      @media (max-width: 768px) {
        .dashboard { grid-template-columns: 1fr; }
      }
      
      .main-panel, .side-panel {
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 20px;
        padding: 30px;
        border: 1px solid rgba(255, 255, 255, 0.3);
        box-shadow: 0 20px 60px rgba(0,0,0,0.1);
      }
      
      [data-theme="dark"] .main-panel,
      [data-theme="dark"] .side-panel {
        background: rgba(0, 0, 0, 0.5);
        border-color: rgba(255, 255, 255, 0.1);
      }
      
      .metric-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin-top: 20px;
      }
      
      .metric-card {
        background: rgba(255, 255, 255, 0.8);
        padding: 20px;
        border-radius: 15px;
        text-align: center;
        transition: all 0.3s;
        border: 2px solid transparent;
      }
      
      [data-theme="dark"] .metric-card {
        background: rgba(255, 255, 255, 0.1);
      }
      
      .metric-card:hover {
        transform: translateY(-5px);
        border-color: #667eea;
      }
      
      .metric-value {
        font-size: 2.5rem;
        font-weight: bold;
        margin: 10px 0;
      }
      
      .status-indicator {
        display: inline-block;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        margin-right: 10px;
        animation: pulse 2s infinite;
      }
      
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
      }
      
      .live-log {
        height: 300px;
        overflow-y: auto;
        background: rgba(0, 0, 0, 0.8);
        border-radius: 10px;
        padding: 15px;
        margin-top: 20px;
        font-family: 'Consolas', monospace;
        font-size: 0.9rem;
      }
      
      .log-entry {
        padding: 8px;
        margin-bottom: 5px;
        border-left: 3px solid;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 5px;
      }
      
      .controls {
        display: flex;
        gap: 15px;
        margin-top: 30px;
        justify-content: center;
      }
      
      .btn {
        padding: 15px 30px;
        border: none;
        border-radius: 50px;
        font-size: 1rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all 0.3s;
        font-weight: 600;
      }
      
      .btn-primary {
        background: linear-gradient(45deg, #4CAF50, #8BC34A);
        color: white;
      }
      
      .btn-primary:hover {
        transform: translateY(-3px);
        box-shadow: 0 10px 20px rgba(76, 175, 80, 0.3);
      }
      
      .btn-danger {
        background: linear-gradient(45deg, #FF5252, #FF4081);
        color: white;
      }
      
      .btn-danger:hover {
        transform: translateY(-3px);
        box-shadow: 0 10px 20px rgba(255, 82, 82, 0.3);
      }
      
      .connection-status {
        padding: 15px;
        border-radius: 10px;
        margin: 20px 0;
        font-weight: bold;
        text-align: center;
        transition: all 0.3s;
      }
      
      .connected { background: rgba(76, 175, 80, 0.2); color: #4CAF50; }
      .disconnected { background: rgba(244, 67, 54, 0.2); color: #F44336; }
      
      .footer {
        text-align: center;
        margin-top: 40px;
        padding-top: 20px;
        border-top: 1px solid rgba(255, 255, 255, 0.2);
        color: rgba(255, 255, 255, 0.7);
      }
    </style>
  </head>
  <body data-theme="light">
    <div class="container">
      <div class="header">
        <h1>🛡️ Real-time Fault Tolerance Monitor</h1>
        <button class="theme-toggle" onclick="toggleTheme()">
          <span id="themeIcon">🌙</span>
          <span>Toggle Theme</span>
        </button>
      </div>
      
      <div class="dashboard">
        <div class="main-panel">
          <h2>Live System Metrics</h2>
          <div class="connection-status" id="connectionStatus">
            <span class="status-indicator" id="statusIndicator"></span>
            <span id="statusText">Connecting to real-time stream...</span>
          </div>
          
          <div class="metric-grid">
            <div class="metric-card">
              <div>Database Status</div>
              <div class="metric-value" id="dbStatus">--</div>
              <div id="dbResponseTime">Response time: -- ms</div>
            </div>
            
            <div class="metric-card">
              <div>Memory Usage</div>
              <div class="metric-value" id="memoryUsage">-- MB</div>
              <div id="memoryPercent">--% used</div>
            </div>
            
            <div class="metric-card">
              <div>Server Uptime</div>
              <div class="metric-value" id="uptime">--</div>
              <div>Since last restart</div>
            </div>
            
            <div class="metric-card">
              <div>Last Update</div>
              <div class="metric-value" id="lastUpdate">--:--</div>
              <div>Real-time streaming</div>
            </div>
          </div>
          
          <div class="controls">
            <button class="btn btn-primary" onclick="location.href='/api/health'">
              📊 View Health Dashboard
            </button>
            <button class="btn btn-danger" onclick="simulateFailure()">
              🧪 Test Fault Tolerance
            </button>
          </div>
        </div>
        
        <div class="side-panel">
          <h2>Live Event Log</h2>
          <div class="live-log" id="liveLog">
            <div class="log-entry" style="border-left-color: #2196F3">
              [${new Date().toLocaleTimeString()}] Connecting to real-time stream...
            </div>
          </div>
          
          <div style="margin-top: 20px; text-align: center; color: #666;">
            <small>Stop/Start MySQL service to see real-time updates</small>
          </div>
        </div>
      </div>
      
      <div class="footer">
        <p>Real-time monitoring active • Updates every 2 seconds • Auto-recovery enabled</p>
      </div>
    </div>
    
    <script>
      // Theme Management
      function toggleTheme() {
        const body = document.body;
        const currentTheme = body.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        document.getElementById('themeIcon').textContent = newTheme === 'light' ? '🌙' : '☀️';
      }
      
      // Load saved theme
      const savedTheme = localStorage.getItem('theme') || 'light';
      document.body.setAttribute('data-theme', savedTheme);
      document.getElementById('themeIcon').textContent = savedTheme === 'light' ? '🌙' : '☀️';
      
      // Real-time SSE Connection
      const eventSource = new EventSource('/api/fault-tolerance/stream');
      const liveLog = document.getElementById('liveLog');
      const maxLogEntries = 20;
      
      eventSource.onopen = () => {
        addLog('✅ Connected to real-time stream', '#4CAF50');
      };
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'database-status') {
            updateMetrics(data);
          }
          
          // Add log entry for status changes
          if (data.status === 'healthy') {
            addLog(\`✅ Database healthy (\${data.responseTime}ms)\`, '#4CAF50');
          } else {
            addLog(\`❌ Database error: \${data.error}\`, '#F44336');
          }
          
        } catch (error) {
          console.error('Error parsing SSE data:', error);
        }
      };
      
      eventSource.onerror = (error) => {
        addLog('⚠️ Connection lost. Reconnecting...', '#FF9800');
        setTimeout(() => {
          location.reload();
        }, 3000);
      };
      
      // Update UI with real-time data
      function updateMetrics(data) {
        // Update database status
        const dbStatus = document.getElementById('dbStatus');
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        const connectionStatus = document.getElementById('connectionStatus');
        
        if (data.status === 'healthy') {
          dbStatus.textContent = '✅';
          dbStatus.style.color = '#4CAF50';
          statusIndicator.style.background = '#4CAF50';
          statusText.textContent = 'Database Connected';
          connectionStatus.className = 'connection-status connected';
          document.getElementById('dbResponseTime').textContent = \`Response time: \${data.responseTime}ms\`;
        } else {
          dbStatus.textContent = '❌';
          dbStatus.style.color = '#F44336';
          statusIndicator.style.background = '#F44336';
          statusText.textContent = 'Database Disconnected';
          connectionStatus.className = 'connection-status disconnected';
          document.getElementById('dbResponseTime').textContent = 'Retrying connection...';
        }
        
        // Update memory
        const memoryUsage = document.getElementById('memoryUsage');
        const memoryPercent = document.getElementById('memoryPercent');
        const usedMB = data.memory.used;
        const totalMB = data.memory.total;
        const percent = Math.round((usedMB / totalMB) * 100);
        
        memoryUsage.textContent = \`\${usedMB} MB\`;
        memoryPercent.textContent = \`\${percent}% used\`;
        memoryUsage.style.color = percent > 80 ? '#F44336' : percent > 60 ? '#FF9800' : '#4CAF50';
        
        // Update uptime
        const uptime = document.getElementById('uptime');
        const hours = Math.floor(data.uptime / 3600);
        const minutes = Math.floor((data.uptime % 3600) / 60);
        uptime.textContent = \`\${hours}h \${minutes}m\`;
        
        // Update timestamp
        document.getElementById('lastUpdate').textContent = 
          new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
      
      // Add log entry
      function addLog(message, color) {
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        logEntry.style.borderLeftColor = color;
        logEntry.innerHTML = \`[\${new Date().toLocaleTimeString()}] \${message}\`;
        
        liveLog.prepend(logEntry);
        
        // Limit number of log entries
        if (liveLog.children.length > maxLogEntries) {
          liveLog.removeChild(liveLog.lastChild);
        }
      }
      
      // Simulate failure (client-side)
      function simulateFailure() {
        addLog('🧪 Simulating database failure...', '#FF9800');
        
        // Simulate failure sequence
        setTimeout(() => {
          addLog('❌ Database connection lost', '#F44336');
          document.getElementById('dbStatus').textContent = '❌';
          document.getElementById('dbStatus').style.color = '#F44336';
          document.getElementById('statusIndicator').style.background = '#F44336';
          document.getElementById('statusText').textContent = 'Simulated Failure';
          document.getElementById('connectionStatus').className = 'connection-status disconnected';
          
          // Simulate recovery after 3 seconds
          setTimeout(() => {
            addLog('🔄 Attempting automatic recovery...', '#2196F3');
            
            setTimeout(() => {
              addLog('✅ Recovery successful!', '#4CAF50');
              document.getElementById('dbStatus').textContent = '✅';
              document.getElementById('dbStatus').style.color = '#4CAF50';
              document.getElementById('statusIndicator').style.background = '#4CAF50';
              document.getElementById('statusText').textContent = 'Database Connected';
              document.getElementById('connectionStatus').className = 'connection-status connected';
              document.getElementById('dbResponseTime').textContent = 'Response time: 45ms (simulated)';
            }, 1500);
          }, 1500);
        }, 1000);
      }
    </script>
  </body>
  </html>
  `;
  
  res.send(html);
});

export default router;