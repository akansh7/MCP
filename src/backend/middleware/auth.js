const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware to authenticate JWT token and attach user to request
 */
const authenticate = async (req, res, next) => {
  // Get token from header
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token, authorization denied'
    });
  }
  
  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user by ID
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token: user not found'
      });
    }
    
    // Check if user is active
    if (!user.active) {
      return res.status(401).json({
        success: false,
        message: 'Account disabled'
      });
    }
    
    // Attach user to request
    req.user = {
      id: decoded.id,
      role: decoded.role
    };
    
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token is not valid',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Middleware to check if user is an admin
 * Must be used after authenticate
 */
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: admin role required'
    });
  }
  
  next();
};

/**
 * Middleware to limit rate of API requests
 */
const rateLimiter = async (req, res, next) => {
  try {
    // Get user by ID
    const user = await User.findById(req.user.id);
    
    // Get max requests from env
    const maxRequests = process.env.MAX_REQUESTS_PER_MINUTE || 100;
    
    // Increment request count
    user.apiRequestCount += 1;
    await user.save();
    
    // Check if limit exceeded
    if (user.apiRequestCount > maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Rate limit exceeded. Please try again later.'
      });
    }
    
    // Reset counter after a minute (this should ideally be handled by a cron job)
    setTimeout(async () => {
      user.apiRequestCount -= 1;
      await user.save();
    }, 60000);
    
    next();
  } catch (error) {
    console.error('Rate limiter error:', error);
    next(); // Continue even if rate limiting fails
  }
};

module.exports = {
  authenticate,
  isAdmin,
  rateLimiter
}; 