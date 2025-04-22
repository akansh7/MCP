require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.SERVER_MANAGER_PORT || 3001;

// MongoDB models (we'll redefine them here for simplicity)
const serverSchema = new mongoose.Schema({
  name: String,
  type: String,
  owner: mongoose.Schema.Types.ObjectId,
  status: String,
  serverKey: String,
  endpoint: String,
  apiKeys: Object,
  config: Object,
  requestCount: Number,
  lastActivity: Date
}, { timestamps: true });

const Server = mongoose.model('Server', serverSchema);

// Map to store running server processes
const runningServers = new Map();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(express.json());

// Verify server authentication
const verifyServerAuth = (req, res, next) => {
  const serverKey = req.header('X-Server-Key');
  
  if (!serverKey) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // This is where you would verify the server key
  // For now, we'll assume it's valid if it exists
  next();
};

// Routes

/**
 * Route to handle MCP requests
 * This endpoint receives requests from Claude Desktop and forwards them to the appropriate MCP server
 */
app.post('/mcp/:userId/:serverId', verifyServerAuth, async (req, res) => {
  try {
    const { userId, serverId } = req.params;
    
    // Find server in database
    const server = await Server.findOne({
      owner: userId,
      endpoint: {
        $regex: serverId
      }
    });
    
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }
    
    if (server.status !== 'running') {
      return res.status(503).json({ error: 'Server is not running' });
    }
    
    // Get the process from running servers
    const serverProcess = runningServers.get(server._id.toString());
    if (!serverProcess) {
      return res.status(503).json({ error: 'Server process not found' });
    }
    
    // Forward the request to the MCP server
    // The actual implementation depends on how you're managing the server processes
    // For this example, we'll just return a stub
    
    // Update request count
    server.requestCount += 1;
    server.lastActivity = Date.now();
    await server.save();
    
    res.json({
      // MCP server response would go here
      server: server.name,
      message: 'Request processed successfully'
    });
  } catch (error) {
    console.error('MCP request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// WebSocket connection to handle server management commands
wss.on('connection', (ws) => {
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      // Handle different command types
      switch (data.command) {
        case 'start':
          await startServer(data.serverId, ws);
          break;
        case 'stop':
          await stopServer(data.serverId, ws);
          break;
        case 'status':
          await getServerStatus(data.serverId, ws);
          break;
        default:
          ws.send(JSON.stringify({
            success: false,
            message: 'Unknown command'
          }));
      }
    } catch (error) {
      console.error('WebSocket error:', error);
      ws.send(JSON.stringify({
        success: false,
        message: 'Error processing command',
        error: error.message
      }));
    }
  });
});

// Server management functions

/**
 * Start an MCP server instance
 */
async function startServer(serverId, ws) {
  try {
    // Find server in database
    const server = await Server.findById(serverId);
    
    if (!server) {
      ws.send(JSON.stringify({
        success: false,
        message: 'Server not found'
      }));
      return;
    }
    
    // Check if server is already running
    if (runningServers.has(serverId)) {
      ws.send(JSON.stringify({
        success: true,
        message: 'Server is already running'
      }));
      return;
    }
    
    // Start the appropriate server type
    let serverProcess;
    
    switch (server.type) {
      case 'brave-search':
        serverProcess = startBraveSearchServer(server);
        break;
      case 'github':
        serverProcess = startGithubServer(server);
        break;
      case 'filesystem':
        serverProcess = startFilesystemServer(server);
        break;
      case 'custom':
        serverProcess = startCustomServer(server);
        break;
      default:
        ws.send(JSON.stringify({
          success: false,
          message: 'Unsupported server type'
        }));
        return;
    }
    
    // Store the process
    runningServers.set(serverId, serverProcess);
    
    // Update server status
    server.status = 'running';
    await server.save();
    
    ws.send(JSON.stringify({
      success: true,
      message: 'Server started successfully'
    }));
  } catch (error) {
    console.error('Start server error:', error);
    ws.send(JSON.stringify({
      success: false,
      message: 'Failed to start server',
      error: error.message
    }));
  }
}

/**
 * Stop an MCP server instance
 */
async function stopServer(serverId, ws) {
  try {
    // Find server in database
    const server = await Server.findById(serverId);
    
    if (!server) {
      ws.send(JSON.stringify({
        success: false,
        message: 'Server not found'
      }));
      return;
    }
    
    // Check if server is running
    if (!runningServers.has(serverId)) {
      ws.send(JSON.stringify({
        success: true,
        message: 'Server is not running'
      }));
      return;
    }
    
    // Get the process
    const serverProcess = runningServers.get(serverId);
    
    // Kill the process
    serverProcess.kill();
    
    // Remove from running servers
    runningServers.delete(serverId);
    
    // Update server status
    server.status = 'stopped';
    await server.save();
    
    ws.send(JSON.stringify({
      success: true,
      message: 'Server stopped successfully'
    }));
  } catch (error) {
    console.error('Stop server error:', error);
    ws.send(JSON.stringify({
      success: false,
      message: 'Failed to stop server',
      error: error.message
    }));
  }
}

/**
 * Get the status of an MCP server instance
 */
async function getServerStatus(serverId, ws) {
  try {
    // Find server in database
    const server = await Server.findById(serverId);
    
    if (!server) {
      ws.send(JSON.stringify({
        success: false,
        message: 'Server not found'
      }));
      return;
    }
    
    const isRunning = runningServers.has(serverId);
    
    ws.send(JSON.stringify({
      success: true,
      status: isRunning ? 'running' : 'stopped',
      server: {
        id: server._id,
        name: server.name,
        type: server.type,
        requestCount: server.requestCount,
        lastActivity: server.lastActivity
      }
    }));
  } catch (error) {
    console.error('Get status error:', error);
    ws.send(JSON.stringify({
      success: false,
      message: 'Failed to get server status',
      error: error.message
    }));
  }
}

// Start specific server types

function startBraveSearchServer(server) {
  const apiKey = getDecryptedApiKey(server, 'BRAVE_API_KEY');
  
  const process = spawn('npx', [
    '-y',
    '@modelcontextprotocol/server-brave-search'
  ], {
    env: {
      ...process.env,
      BRAVE_API_KEY: apiKey
    }
  });
  
  setupProcessHandlers(process, server._id);
  
  return process;
}

function startGithubServer(server) {
  const apiKey = getDecryptedApiKey(server, 'GITHUB_PERSONAL_ACCESS_TOKEN');
  
  const process = spawn('npx', [
    '-y',
    '@modelcontextprotocol/server-github'
  ], {
    env: {
      ...process.env,
      GITHUB_PERSONAL_ACCESS_TOKEN: apiKey
    }
  });
  
  setupProcessHandlers(process, server._id);
  
  return process;
}

function startFilesystemServer(server) {
  // Get allowed directories from config
  const allowedDirs = server.config.allowedDirectories || ['/tmp'];
  
  const process = spawn('npx', [
    '-y',
    '@modelcontextprotocol/server-filesystem',
    ...allowedDirs
  ]);
  
  setupProcessHandlers(process, server._id);
  
  return process;
}

function startCustomServer(server) {
  // For custom servers, the command and args should be in the config
  const { command, args = [], env = {} } = server.config;
  
  // Get API keys
  const decryptedKeys = {};
  for (const [key, value] of Object.entries(server.apiKeys)) {
    decryptedKeys[key] = getDecryptedApiKey(server, key);
  }
  
  const process = spawn(command, args, {
    env: {
      ...process.env,
      ...env,
      ...decryptedKeys
    }
  });
  
  setupProcessHandlers(process, server._id);
  
  return process;
}

// Helper functions

function setupProcessHandlers(process, serverId) {
  process.on('error', async (error) => {
    console.error(`Server ${serverId} process error:`, error);
    
    try {
      // Update server status on error
      const server = await Server.findById(serverId);
      server.status = 'failed';
      await server.save();
      
      // Remove from running servers
      runningServers.delete(serverId.toString());
    } catch (dbError) {
      console.error('Database update error:', dbError);
    }
  });
  
  process.on('exit', async (code) => {
    console.log(`Server ${serverId} process exited with code ${code}`);
    
    try {
      // Update server status on exit
      const server = await Server.findById(serverId);
      server.status = code === 0 ? 'stopped' : 'failed';
      await server.save();
      
      // Remove from running servers
      runningServers.delete(serverId.toString());
    } catch (dbError) {
      console.error('Database update error:', dbError);
    }
  });
  
  // Log output for debugging
  process.stdout.on('data', (data) => {
    console.log(`Server ${serverId} stdout: ${data}`);
  });
  
  process.stderr.on('data', (data) => {
    console.error(`Server ${serverId} stderr: ${data}`);
  });
}

function getDecryptedApiKey(server, key) {
  if (!server.apiKeys || !server.apiKeys[key]) {
    return '';
  }
  
  try {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    return crypto.AES.decrypt(server.apiKeys[key], encryptionKey).toString(crypto.enc.Utf8);
  } catch (error) {
    console.error(`Error decrypting key ${key}:`, error);
    return '';
  }
}

// Start the server
server.listen(PORT, () => {
  console.log(`Server Manager running on port ${PORT}`);
}); 