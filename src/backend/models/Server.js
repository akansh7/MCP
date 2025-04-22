const mongoose = require('mongoose');
const crypto = require('crypto-js');

const ServerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Server name is required'],
    trim: true
  },
  type: {
    type: String,
    required: [true, 'Server type is required'],
    enum: ['brave-search', 'github', 'filesystem', 'custom']
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['creating', 'running', 'stopped', 'failed'],
    default: 'creating'
  },
  serverKey: {
    type: String,
    required: true,
    unique: true
  },
  endpoint: {
    type: String,
    required: true,
    unique: true
  },
  apiKeys: {
    type: Object,
    default: {}
  },
  config: {
    type: Object,
    default: {}
  },
  requestCount: {
    type: Number,
    default: 0
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Encrypt API keys before saving
ServerSchema.pre('save', function(next) {
  if (this.isModified('apiKeys') && Object.keys(this.apiKeys).length > 0) {
    // Get the encryption key from environment
    const encryptionKey = process.env.ENCRYPTION_KEY;
    
    // Encrypt each API key
    const encryptedKeys = {};
    for (const [key, value] of Object.entries(this.apiKeys)) {
      encryptedKeys[key] = crypto.AES.encrypt(value, encryptionKey).toString();
    }
    
    this.apiKeys = encryptedKeys;
  }
  next();
});

// Method to decrypt API keys
ServerSchema.methods.getDecryptedApiKeys = function() {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  const decryptedKeys = {};
  
  for (const [key, value] of Object.entries(this.apiKeys)) {
    try {
      decryptedKeys[key] = crypto.AES.decrypt(value, encryptionKey).toString(crypto.enc.Utf8);
    } catch (error) {
      console.error(`Error decrypting key ${key}:`, error);
      decryptedKeys[key] = '';
    }
  }
  
  return decryptedKeys;
};

// Generate Claude Desktop configuration
ServerSchema.methods.generateClaudeConfig = function() {
  const serverKey = this.serverKey;
  const endpoint = this.endpoint;
  const type = this.type;
  
  return {
    mcpServers: {
      [type]: {
        command: "curl",
        args: [
          "-s",
          endpoint
        ],
        env: {
          SERVER_KEY: serverKey
        }
      }
    }
  };
};

module.exports = mongoose.model('Server', ServerSchema); 