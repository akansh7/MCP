const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { authenticate, rateLimiter } = require('../middleware/auth');
const { validateServerCreation, validateApiKey } = require('../middleware/validators');
const Server = require('../models/Server');
const User = require('../models/User');
const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * @route   POST /api/servers
 * @desc    Create a new MCP server
 * @access  Private
 */
router.post('/', validateServerCreation, async (req, res) => {
  try {
    const { name, type, config = {} } = req.body;
    
    // Get user from DB
    const user = await User.findById(req.user.id);
    
    // Check if user has reached the server limit
    const maxServers = process.env.MAX_SERVERS_PER_USER || 5;
    if (user.servers.length >= maxServers) {
      return res.status(400).json({
        success: false,
        message: `You have reached the maximum limit of ${maxServers} servers.`
      });
    }
    
    // Generate a unique server key
    const serverKey = crypto.createHmac('sha256', process.env.SERVER_KEY_SECRET)
      .update(uuidv4())
      .digest('hex');
    
    // Generate unique endpoint
    const endpoint = `https://${process.env.HOSTNAME || 'localhost:3001'}/mcp/${req.user.id}/${uuidv4()}`;
    
    // Create server
    const server = new Server({
      name,
      type,
      owner: req.user.id,
      serverKey,
      endpoint,
      config
    });
    
    // Save server
    await server.save();
    
    // Add server to user's servers
    user.servers.push(server._id);
    await user.save();
    
    // Send notification to server-manager to create the server
    // This part would integrate with your server-manager service
    // You would need to implement a way to notify the server-manager that a new server needs to be created
    
    res.status(201).json({
      success: true,
      message: 'Server created successfully',
      server: {
        id: server._id,
        name: server.name,
        type: server.type,
        status: server.status,
        endpoint: server.endpoint,
        createdAt: server.createdAt
      }
    });
  } catch (error) {
    console.error('Server creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create server',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/servers
 * @desc    Get all user's servers
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    // Find all servers owned by user
    const servers = await Server.find({ owner: req.user.id })
      .select('-serverKey -apiKeys');
    
    res.json({
      success: true,
      count: servers.length,
      servers
    });
  } catch (error) {
    console.error('Get servers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve servers',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/servers/:id
 * @desc    Get a server by ID
 * @access  Private
 */
router.get('/:id', async (req, res) => {
  try {
    // Find server by ID
    const server = await Server.findById(req.params.id)
      .select('-serverKey -apiKeys');
    
    // Check if server exists
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Server not found'
      });
    }
    
    // Check if user owns the server
    if (server.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this server'
      });
    }
    
    res.json({
      success: true,
      server
    });
  } catch (error) {
    console.error('Get server error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve server',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   PUT /api/servers/:id/apikey
 * @desc    Add or update API key for a server
 * @access  Private
 */
router.put('/:id/apikey', validateApiKey, async (req, res) => {
  try {
    const { key, value } = req.body;
    
    // Find server by ID
    const server = await Server.findById(req.params.id);
    
    // Check if server exists
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Server not found'
      });
    }
    
    // Check if user owns the server
    if (server.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this server'
      });
    }
    
    // Add or update API key
    // Note: The actual encryption happens in the pre-save middleware
    server.apiKeys = {
      ...server.apiKeys,
      [key]: value
    };
    
    await server.save();
    
    res.json({
      success: true,
      message: 'API key saved successfully'
    });
  } catch (error) {
    console.error('API key update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update API key',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/servers/:id/config
 * @desc    Get Claude Desktop configuration for a server
 * @access  Private
 */
router.get('/:id/config', async (req, res) => {
  try {
    // Find server by ID
    const server = await Server.findById(req.params.id);
    
    // Check if server exists
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Server not found'
      });
    }
    
    // Check if user owns the server
    if (server.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this server'
      });
    }
    
    // Generate Claude Desktop configuration
    const config = server.generateClaudeConfig();
    
    res.json({
      success: true,
      config
    });
  } catch (error) {
    console.error('Get config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate configuration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   DELETE /api/servers/:id
 * @desc    Delete a server
 * @access  Private
 */
router.delete('/:id', async (req, res) => {
  try {
    // Find server by ID
    const server = await Server.findById(req.params.id);
    
    // Check if server exists
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Server not found'
      });
    }
    
    // Check if user owns the server
    if (server.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this server'
      });
    }
    
    // Remove server from user's servers
    await User.updateOne(
      { _id: server.owner },
      { $pull: { servers: server._id } }
    );
    
    // Delete server
    await server.remove();
    
    // Send notification to server-manager to stop and remove the server
    // This part would integrate with your server-manager service
    
    res.json({
      success: true,
      message: 'Server deleted successfully'
    });
  } catch (error) {
    console.error('Delete server error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete server',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   PUT /api/servers/:id/status
 * @desc    Update server status (start/stop)
 * @access  Private
 */
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    // Validate status
    const validStatuses = ['running', 'stopped'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required (running/stopped)'
      });
    }
    
    // Find server by ID
    const server = await Server.findById(req.params.id);
    
    // Check if server exists
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Server not found'
      });
    }
    
    // Check if user owns the server
    if (server.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this server'
      });
    }
    
    // Update status
    server.status = status;
    await server.save();
    
    // Send notification to server-manager to start/stop the server
    // This part would integrate with your server-manager service
    
    res.json({
      success: true,
      message: `Server ${status === 'running' ? 'started' : 'stopped'} successfully`,
      server: {
        id: server._id,
        status: server.status
      }
    });
  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update server status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router; 