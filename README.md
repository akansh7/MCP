# MCP Server Hosting Platform

A platform that allows users to deploy and manage their own Model Context Protocol (MCP) servers for use with Claude Desktop and other compatible clients.

## Features

- User registration and authentication
- Deploy various types of MCP servers (Brave Search, GitHub, etc.)
- Secure API key management
- Automatic generation of Claude Desktop configuration
- Usage monitoring and rate limiting

## Architecture

The platform consists of:

1. **Web Frontend**: React-based UI for server management
2. **Backend API**: Express.js server handling deployments and authentication
3. **Server Manager**: Manages MCP server instances and routes requests
4. **Database**: Stores user information, server configurations, and usage data

## Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- MongoDB

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-hosting-platform.git
cd mcp-hosting-platform

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start the services
docker-compose up -d
```

## Usage

1. Register for an account
2. Create a new MCP server
3. Configure server settings and add any required API keys
4. Copy the generated Claude Desktop configuration to your local machine
5. Connect Claude Desktop to your hosted server

## Deployment to Railway.app

This project can be easily deployed to Railway.app:

1. Fork this repository to your GitHub account
2. Create a new project on Railway.app
3. Select "Deploy from GitHub repo" and choose your forked repository
4. Railway will automatically detect the configuration and build the project
5. Add the following environment variables in the Railway.app dashboard:
   - `JWT_SECRET` - Random string for JWT token signing
   - `SERVER_KEY_SECRET` - Random string for server key generation
   - `ENCRYPTION_KEY` - 32 character string for API key encryption
   - `MONGODB_URI` - Connection string to your MongoDB database
     (Railway can provision a MongoDB instance for you)

6. Once deployed, your MCP hosting platform will be available at the URL provided by Railway.app

## Security

This platform implements several security measures:
- Server keys for authenticating hosted servers
- Secure storage of API keys using encryption
- Rate limiting to prevent abuse
- Access controls for server management

## License

MIT
