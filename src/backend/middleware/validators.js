/**
 * Middleware for validating user registration request
 */
const validateRegistration = (req, res, next) => {
  const { name, email, password } = req.body;
  
  // Validate name
  if (!name || name.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Name is required'
    });
  }
  
  // Validate email
  if (!email || !email.match(/^\S+@\S+\.\S+$/)) {
    return res.status(400).json({
      success: false,
      message: 'Valid email address is required'
    });
  }
  
  // Validate password
  if (!password || password.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters long'
    });
  }
  
  next();
};

/**
 * Middleware for validating user login request
 */
const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  
  // Validate email
  if (!email || !email.match(/^\S+@\S+\.\S+$/)) {
    return res.status(400).json({
      success: false,
      message: 'Valid email address is required'
    });
  }
  
  // Validate password
  if (!password) {
    return res.status(400).json({
      success: false,
      message: 'Password is required'
    });
  }
  
  next();
};

/**
 * Middleware for validating server creation request
 */
const validateServerCreation = (req, res, next) => {
  const { name, type } = req.body;
  
  // Validate name
  if (!name || name.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Server name is required'
    });
  }
  
  // Validate type
  const validTypes = ['brave-search', 'github', 'filesystem', 'custom'];
  if (!type || !validTypes.includes(type)) {
    return res.status(400).json({
      success: false,
      message: 'Valid server type is required'
    });
  }
  
  next();
};

/**
 * Middleware for validating API key request
 */
const validateApiKey = (req, res, next) => {
  const { key, value } = req.body;
  
  // Validate key name
  if (!key || key.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'API key name is required'
    });
  }
  
  // Validate value
  if (!value || value.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'API key value is required'
    });
  }
  
  next();
};

module.exports = {
  validateRegistration,
  validateLogin,
  validateServerCreation,
  validateApiKey
}; 