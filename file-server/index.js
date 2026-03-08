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
const http = require('http');
const { WebSocketServer } = require('ws');
const pty = require('node-pty');
const crypto = require('crypto');

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

// ─── Credential Test Endpoint ───────────────────────────────────────
// POST /credentials/test — Execute an HTTP probe to verify a credential
const ALLOWED_PROTOCOLS = ['https:'];
const BLOCKED_PATTERNS = [
  /^https?:\/\/localhost/i,
  /^https?:\/\/127\./,
  /^https?:\/\/10\./,
  /^https?:\/\/192\.168\./,
  /^https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^https?:\/\/\[::1\]/,
  /^https?:\/\/0\.0\.0\.0/,
];

function validateTestUrl(url) {
  try {
    const parsed = new URL(url);
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return { valid: false, error: `Protocol ${parsed.protocol} not allowed. Use HTTPS.` };
    }
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(url)) {
        return { valid: false, error: 'Internal/localhost URLs not allowed' };
      }
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

app.post('/credentials/test', authenticate, async (req, res) => {
  const { test: testConfig, value } = req.body;

  if (!testConfig || !value) {
    return res.status(400).json({ error: 'Missing test config or value' });
  }

  // Validate URL
  const urlCheck = validateTestUrl(testConfig.url);
  if (!urlCheck.valid) {
    return res.json({
      success: false, status: 0, message: `URL validation failed: ${urlCheck.error}`,
      testedAt: new Date().toISOString(), durationMs: 0,
    });
  }

  const startTime = Date.now();

  try {
    // Substitute $VALUE placeholders
    const sub = (s) => s.replace(/\$VALUE/g, value);
    const url = sub(testConfig.url);
    const headers = {};
    if (testConfig.headers) {
      for (const [k, v] of Object.entries(testConfig.headers)) {
        headers[k] = sub(v);
      }
    }

    const fetchOpts = { method: testConfig.method, headers };
    if (testConfig.body && ['POST', 'PUT'].includes(testConfig.method)) {
      fetchOpts.body = sub(testConfig.body);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, { ...fetchOpts, signal: controller.signal });
    clearTimeout(timeoutId);

    const durationMs = Date.now() - startTime;
    const expectedStatuses = Array.isArray(testConfig.expectStatus)
      ? testConfig.expectStatus
      : [testConfig.expectStatus];
    const statusMatch = expectedStatuses.includes(response.status);

    let bodyMatch = true;
    if (testConfig.expectBodyContains && statusMatch) {
      const body = await response.text();
      bodyMatch = body.includes(testConfig.expectBodyContains);
    }

    const success = statusMatch && bodyMatch;
    let message;
    if (success) message = `Valid - received ${response.status}`;
    else if (!statusMatch) message = `Invalid - expected ${expectedStatuses.join(' or ')}, got ${response.status}`;
    else message = 'Invalid - response body did not contain expected content';

    res.json({ success, status: response.status, message, testedAt: new Date().toISOString(), durationMs });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    let message = 'Test failed';
    if (error.name === 'AbortError') message = 'Request timed out (30s)';
    else if (error.message) message = `Network error: ${error.message}`;

    res.json({ success: false, status: 0, message, testedAt: new Date().toISOString(), durationMs });
  }
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
    
    // Call the gateway's wake endpoint with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(`${gatewayUrl}/api/cron/wake`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, mode }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
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
    
    // Call the gateway's restart endpoint with timeout (correct path is /api/restart)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(`${gatewayUrl}/api/restart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
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

// ─── WebSocket Terminal ─────────────────────────────────────────────
const MAX_TERMINAL_SESSIONS = 5;
const terminalSessions = new Map(); // id -> { pty, ws }

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname !== '/terminal') {
    socket.destroy();
    return;
  }

  // Auth check
  const token = url.searchParams.get('token');
  if (token !== AUTH_TOKEN) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', (ws, request) => {
  if (terminalSessions.size >= MAX_TERMINAL_SESSIONS) {
    ws.send(JSON.stringify({ type: 'error', error: 'Too many sessions' }));
    ws.close();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);
  const cols = parseInt(url.searchParams.get('cols')) || 80;
  const rows = parseInt(url.searchParams.get('rows')) || 24;
  const sessionId = crypto.randomUUID();

  let shell;
  try {
    shell = pty.spawn('zsh', [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: process.env.HOME || '/Users/skadauke',
      env: { ...process.env, TERM: 'xterm-256color' },
    });
  } catch (err) {
    console.error('Failed to spawn PTY:', err);
    ws.send(JSON.stringify({ type: 'error', error: 'Failed to spawn terminal' }));
    ws.close();
    return;
  }

  terminalSessions.set(sessionId, { pty: shell, ws });
  console.log(`Terminal session ${sessionId} started (${terminalSessions.size} active)`);

  ws.send(JSON.stringify({ type: 'connected', id: sessionId }));

  // Keepalive ping every 30s to prevent Cloudflare tunnel idle timeout
  const pingInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.ping();
    }
  }, 30000);

  // PTY → WebSocket
  shell.onData((data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'data', data }));
    }
  });

  shell.onExit(({ exitCode }) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
    }
    cleanup();
  });

  // WebSocket → PTY
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'data' && typeof msg.data === 'string') {
        shell.write(msg.data);
      } else if (msg.type === 'resize' && msg.cols && msg.rows) {
        shell.resize(Math.max(1, msg.cols), Math.max(1, msg.rows));
      }
    } catch {
      // ignore malformed messages
    }
  });

  function cleanup() {
    clearInterval(pingInterval);
    terminalSessions.delete(sessionId);
    console.log(`Terminal session ${sessionId} ended (${terminalSessions.size} active)`);
    try { shell.kill(); } catch {}
    if (ws.readyState === ws.OPEN) ws.close();
  }

  ws.on('close', cleanup);
  ws.on('error', cleanup);
});

server.listen(PORT, () => {
  console.log(`File server running on port ${PORT}`);
  console.log('Allowed paths:', ALLOWED_PATHS);
});
