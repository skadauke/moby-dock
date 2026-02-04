/**
 * Moby Dock File Server
 * Simple Express server for reading/writing files with authentication.
 * Used by moby-dock web app to access local files securely.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const AUTH_TOKEN = process.env.AUTH_TOKEN;

// Allowed base paths - files outside these are blocked
const HOME = process.env.HOME || '/Users/skadauke';
const ALLOWED_PATHS = [
  `${HOME}/clawd`,           // Workspace
  `${HOME}/.openclaw`,       // OpenClaw config
  `${HOME}/.clawdbot`,       // Legacy clawdbot config (if needed)
];

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Auth middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  const token = authHeader.slice(7);
  if (token !== AUTH_TOKEN) {
    return res.status(403).json({ error: 'Invalid token' });
  }
  next();
}

// Check if path is allowed
function isPathAllowed(filePath) {
  const resolved = path.resolve(filePath.replace(/^~/, HOME));
  return ALLOWED_PATHS.some(allowed => resolved.startsWith(allowed));
}

// Resolve path (handle ~ and relative paths)
function resolvePath(filePath) {
  return path.resolve(filePath.replace(/^~/, HOME));
}

// GET /files?path=<filepath> - Read a file
app.get('/files', authenticate, async (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ error: 'Path is required' });
  }

  if (!isPathAllowed(filePath)) {
    return res.status(403).json({ error: 'Path not allowed' });
  }

  try {
    const resolved = resolvePath(filePath);
    const stat = await fs.stat(resolved);
    const content = await fs.readFile(resolved, 'utf-8');
    
    res.json({
      content,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    console.error('Read error:', err);
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// POST /files - Write a file
app.post('/files', authenticate, async (req, res) => {
  const { path: filePath, content } = req.body;
  if (!filePath || content === undefined) {
    return res.status(400).json({ error: 'Path and content are required' });
  }

  if (!isPathAllowed(filePath)) {
    return res.status(403).json({ error: 'Path not allowed' });
  }

  try {
    const resolved = resolvePath(filePath);
    // Create directory if it doesn't exist
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, 'utf-8');
    
    res.json({ success: true });
  } catch (err) {
    console.error('Write error:', err);
    res.status(500).json({ error: 'Failed to write file' });
  }
});

// DELETE /files?path=<filepath> - Delete a file
app.delete('/files', authenticate, async (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ error: 'Path is required' });
  }

  if (!isPathAllowed(filePath)) {
    return res.status(403).json({ error: 'Path not allowed' });
  }

  try {
    const resolved = resolvePath(filePath);
    await fs.unlink(resolved);
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// GET /files/list?dir=<dirpath> - List directory
app.get('/files/list', authenticate, async (req, res) => {
  const dirPath = req.query.dir || req.query.path; // Support both 'dir' and 'path'
  if (!dirPath) {
    return res.status(400).json({ error: 'Path is required' });
  }

  if (!isPathAllowed(dirPath)) {
    return res.status(403).json({ error: 'Path not allowed' });
  }

  try {
    const resolved = resolvePath(dirPath);
    const entries = await fs.readdir(resolved, { withFileTypes: true });
    
    const files = entries.map(entry => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      path: path.join(dirPath, entry.name),
    }));
    
    // Return in expected format: { files: [...], count: N }
    res.json({ files, count: files.length });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Directory not found' });
    }
    console.error('List error:', err);
    res.status(500).json({ error: 'Failed to list directory' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', allowedPaths: ALLOWED_PATHS });
});

// POST /gateway/ping - Send wake event to OpenClaw gateway
app.post('/gateway/ping', authenticate, async (req, res) => {
  const { text = "Check Ready queue for tasks", mode = "now" } = req.body;
  
  // Read gateway config to get the gateway URL
  const configPath = `${HOME}/.openclaw/openclaw.json`;
  
  try {
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    
    // Get gateway URL from config (default to localhost:3377)
    const gatewayPort = config.gateway?.port || 3377;
    const gatewayUrl = `http://localhost:${gatewayPort}`;
    
    // Call the gateway's wake endpoint
    const response = await fetch(`${gatewayUrl}/api/cron/wake`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, mode }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gateway ping failed:', response.status, errorText);
      return res.status(response.status).json({ 
        error: 'Gateway ping failed', 
        details: errorText 
      });
    }
    
    const data = await response.json();
    console.log('Gateway ping succeeded:', data);
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('Gateway ping error:', err);
    res.status(500).json({ 
      error: 'Failed to ping gateway', 
      details: err.message 
    });
  }
});

// POST /gateway/restart - Restart the OpenClaw gateway
app.post('/gateway/restart', authenticate, async (req, res) => {
  // Read gateway config to get the gateway URL
  const configPath = `${HOME}/.openclaw/openclaw.json`;
  
  try {
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    
    const gatewayPort = config.gateway?.port || 3377;
    const gatewayUrl = `http://localhost:${gatewayPort}`;
    
    // Call the gateway's restart endpoint
    const response = await fetch(`${gatewayUrl}/api/gateway/restart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gateway restart failed:', response.status, errorText);
      return res.status(response.status).json({ 
        error: 'Gateway restart failed', 
        details: errorText 
      });
    }
    
    const data = await response.json();
    console.log('Gateway restart succeeded:', data);
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('Gateway restart error:', err);
    res.status(500).json({ 
      error: 'Failed to restart gateway', 
      details: err.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`File server running on port ${PORT}`);
  console.log('Allowed paths:', ALLOWED_PATHS);
});
