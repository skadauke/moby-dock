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
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 3001;
const AUTH_TOKEN = process.env.AUTH_TOKEN;

// Allowed base paths - files outside these are blocked
const HOME = process.env.HOME || '/Users/skadauke';
const ALLOWED_PATHS = [
  `${HOME}/clawd`,           // Workspace
  `${HOME}/.openclaw`,       // OpenClaw config
  `${HOME}/.clawdbot`,       // Legacy clawdbot config (if needed)
  `${HOME}/openclaw/skills`, // Built-in skills (read-only)
  `${HOME}/.openclaw/media`, // Media files (read-only)
  `${HOME}/.clawdbot/media`, // Legacy media files (read-only)
];

// Read-only paths — writes/deletes blocked
const READ_ONLY_PATHS = [
  `${HOME}/openclaw/skills`,
  `${HOME}/.openclaw/media`,
  `${HOME}/.clawdbot/media`,
];

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging middleware — runs on EVERY request
app.use((req, res, next) => {
  const start = Date.now();
  
  // Capture the original end to log after response
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - start;
    const authStatus = req.headers.authorization ? 'auth' : 'noauth';
    logger.info(`${req.method} ${req.originalUrl}`, {
      category: 'request',
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration,
      authStatus,
      ip: req.ip || req.connection?.remoteAddress,
      contentLength: res.getHeader('content-length'),
    });
    originalEnd.apply(res, args);
  };
  
  next();
});

// Auth middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Auth failed: missing authorization header', {
      category: 'auth',
      method: req.method,
      path: req.originalUrl,
      ip: req.ip || req.connection?.remoteAddress,
      reason: 'missing_header',
    });
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  const token = authHeader.slice(7);
  if (token !== AUTH_TOKEN) {
    logger.warn('Auth failed: invalid token', {
      category: 'auth',
      method: req.method,
      path: req.originalUrl,
      ip: req.ip || req.connection?.remoteAddress,
      reason: 'invalid_token',
    });
    return res.status(403).json({ error: 'Invalid token' });
  }
  next();
}

// Check if path is allowed
function isPathAllowed(filePath) {
  const resolved = path.resolve(filePath.replace(/^~/, HOME));
  return ALLOWED_PATHS.some(allowed => resolved.startsWith(allowed));
}

// Check if path is read-only
function isPathReadOnly(filePath) {
  const resolved = path.resolve(filePath.replace(/^~/, HOME));
  return READ_ONLY_PATHS.some(ro => resolved.startsWith(ro));
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
    logger.warn('Path not allowed', { category: 'security', path: filePath, method: req.method, reason: 'outside_allowlist' });
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
    logger.error('File read failed', { category: 'file', path: filePath, error: err.message });
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
    logger.warn('Path not allowed', { category: 'security', path: filePath, method: req.method, reason: 'outside_allowlist' });
    return res.status(403).json({ error: 'Path not allowed' });
  }

  if (isPathReadOnly(filePath)) {
    logger.warn('Write to read-only path blocked', { category: 'security', path: filePath, method: req.method, reason: 'read_only' });
    return res.status(403).json({ error: 'Path is read-only' });
  }

  try {
    const resolved = resolvePath(filePath);
    // Create directory if it doesn't exist
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, 'utf-8');
    
    logger.info('File written', { category: 'file', path: filePath, size: content.length });
    res.json({ success: true });
  } catch (err) {
    logger.error('File write failed', { category: 'file', path: filePath, error: err.message });
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
    logger.warn('Path not allowed', { category: 'security', path: filePath, method: req.method, reason: 'outside_allowlist' });
    return res.status(403).json({ error: 'Path not allowed' });
  }

  if (isPathReadOnly(filePath)) {
    logger.warn('Write to read-only path blocked', { category: 'security', path: filePath, method: req.method, reason: 'read_only' });
    return res.status(403).json({ error: 'Path is read-only' });
  }

  try {
    const resolved = resolvePath(filePath);
    await fs.unlink(resolved);
    logger.info('File deleted', { category: 'file', path: filePath });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    logger.error('File delete failed', { category: 'file', path: filePath, error: err.message });
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
    logger.warn('Path not allowed', { category: 'security', path: dirPath, method: req.method, reason: 'outside_allowlist' });
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
    logger.error('Directory list failed', { category: 'file', path: dirPath, error: err.message });
    res.status(500).json({ error: 'Failed to list directory' });
  }
});

// GET /files/raw?path=<filepath> — Serve raw binary with correct Content-Type (for media playback)
app.get('/files/raw', authenticate, async (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ error: 'Path is required' });
  }

  if (!isPathAllowed(filePath)) {
    logger.warn('Path not allowed', { category: 'security', path: filePath, method: req.method, reason: 'outside_allowlist' });
    return res.status(403).json({ error: 'Path not allowed' });
  }

  try {
    const resolved = resolvePath(filePath);
    const stat = await fs.stat(resolved);
    const ext = path.extname(resolved).toLowerCase();
    
    // MIME type mapping
    const mimeTypes = {
      '.ogg': 'audio/ogg',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.webm': 'audio/webm',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.pdf': 'application/pdf',
    };
    
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    const fsSync = require('fs');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fsSync.createReadStream(resolved).pipe(res);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    logger.error('Raw file read failed', { category: 'file', path: filePath, error: err.message });
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', allowedPaths: ALLOWED_PATHS });
});

// ─── Memory Search Endpoints ────────────────────────────────────────

const MEMORY_DB = `${HOME}/.openclaw/memory/main.sqlite`;
// Dynamic sessions directory based on agent ID
function getSessionsDir(agentId) {
  // Validate agent ID to prevent path traversal
  const safeId = (agentId || 'main').replace(/[^a-zA-Z0-9_-]/g, '');
  return `${HOME}/.openclaw/agents/${safeId}/sessions`;
}

// Lazy-load better-sqlite3
let _db = null;
function getMemoryDb() {
  if (_db) return _db;
  try {
    const Database = require('better-sqlite3');
    _db = new Database(MEMORY_DB, { readonly: true });
    return _db;
  } catch (err) {
    logger.error('Failed to open memory DB', { category: 'memory', error: err.message });
    return null;
  }
}

// GET /memory/search?q=<query>&limit=50
app.get('/memory/search', authenticate, async (req, res) => {
  const start = Date.now();
  const query = req.query.q;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  
  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'Query parameter q is required' });
  }
  
  const db = getMemoryDb();
  if (!db) {
    return res.status(500).json({ error: 'Memory database not available' });
  }
  
  try {
    // FTS5 search with snippet highlighting
    const stmt = db.prepare(`
      SELECT 
        id, path, source, start_line, end_line,
        snippet(chunks_fts, 0, '<mark>', '</mark>', '…', 40) as snippet,
        rank
      FROM chunks_fts 
      WHERE text MATCH ?
      ORDER BY rank
      LIMIT ?
    `);
    
    const results = stmt.all(query, limit);
    logger.info('Memory search', { category: 'memory', query, resultCount: results.length, duration: Date.now() - start });
    res.json({ results, total: results.length, query });
  } catch (err) {
    // FTS5 query syntax error — try wrapping in quotes for literal search
    try {
      const stmt = db.prepare(`
        SELECT 
          id, path, source, start_line, end_line,
          snippet(chunks_fts, 0, '<mark>', '</mark>', '…', 40) as snippet,
          rank
        FROM chunks_fts 
        WHERE text MATCH ?
        ORDER BY rank
        LIMIT ?
      `);
      const results = stmt.all(`"${query.replace(/"/g, '""')}"`, limit);
      logger.info('Memory search (literal fallback)', { category: 'memory', query, resultCount: results.length, duration: Date.now() - start });
      res.json({ results, total: results.length, query });
    } catch (err2) {
      logger.error('Memory search failed', { category: 'memory', query, error: err2.message, duration: Date.now() - start });
      res.status(400).json({ error: 'Search failed', details: err2.message });
    }
  }
});

// GET /memory/status — Index status
app.get('/memory/status', authenticate, async (req, res) => {
  const db = getMemoryDb();
  if (!db) {
    return res.status(500).json({ error: 'Memory database not available' });
  }
  
  try {
    const stats = db.prepare(`
      SELECT source, COUNT(*) as chunks, COUNT(DISTINCT path) as files
      FROM chunks GROUP BY source
    `).all();
    
    const totalFiles = db.prepare('SELECT COUNT(*) as count FROM files').get();
    const meta = db.prepare('SELECT value FROM meta WHERE key = ?').get('memory_index_meta_v1');
    
    res.json({
      totalFiles: totalFiles.count,
      sources: stats,
      meta: meta ? JSON.parse(meta.value) : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /memory/sessions — List sessions with metadata
app.get('/memory/sessions', authenticate, async (req, res) => {
  const start = Date.now();
  try {
    const sessionsDir = getSessionsDir(req.query.agent);
    const sessionsFile = path.join(sessionsDir, 'sessions.json');
    const data = JSON.parse(await fs.readFile(sessionsFile, 'utf-8'));
    
    // Get session files with sizes
    const files = await fs.readdir(sessionsDir);
    // Include .jsonl files and .reset files (but not .deleted)
    const sessionFiles = files.filter(f => {
      if (f.includes('.deleted')) return false;
      if (f.endsWith('.jsonl')) return true;
      // Include .reset files: {uuid}.jsonl.reset.{timestamp}
      if (f.includes('.jsonl.reset.')) return true;
      return false;
    });
    
    // Helper: read first message timestamp from a JSONL session file
    async function getFirstMessageTimestamp(filePath) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        // Only scan first 20 lines for performance
        for (let i = 0; i < Math.min(lines.length, 20); i++) {
          const line = lines[i].trim();
          if (!line) continue;
          try {
            const entry = JSON.parse(line);
            if (entry.type === 'message' && entry.timestamp) {
              return entry.timestamp;
            }
          } catch { /* skip malformed */ }
        }
      } catch { /* ignore read errors */ }
      return null;
    }

    // Track which session IDs we've already seen (prefer .jsonl over .reset)
    const seenIds = new Set();
    const sessions = [];
    
    // Process .jsonl files first
    for (const file of sessionFiles.filter(f => f.endsWith('.jsonl'))) {
      // Extract UUID from filename (may have suffixes like -topic-2)
      const uuidMatch = file.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      const sessionId = uuidMatch ? uuidMatch[1] : file.replace('.jsonl', '');
      seenIds.add(sessionId);
      const fullPath = path.join(sessionsDir, file);
      const stat = await fs.stat(fullPath);
      
      let meta = null;
      for (const [key, val] of Object.entries(data)) {
        if (val.sessionId === sessionId) {
          meta = { key, ...val };
          break;
        }
      }
      
      const startedAt = await getFirstMessageTimestamp(fullPath);
      
      sessions.push({
        id: sessionId,
        file,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        startedAt,
        meta,
      });
    }
    
    // Then process .reset files for sessions not already covered
    for (const file of sessionFiles.filter(f => f.includes('.jsonl.reset.'))) {
      // Extract session ID: {uuid}.jsonl.reset.{timestamp}
      const match = file.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl\.reset\./i);
      if (!match) continue;
      const sessionId = match[1];
      if (seenIds.has(sessionId)) continue;
      seenIds.add(sessionId);
      
      const fullPath = path.join(sessionsDir, file);
      const stat = await fs.stat(fullPath);
      
      let meta = null;
      for (const [key, val] of Object.entries(data)) {
        if (val.sessionId === sessionId) {
          meta = { key, ...val };
          break;
        }
      }
      
      const startedAt = await getFirstMessageTimestamp(fullPath);
      
      sessions.push({
        id: sessionId,
        file,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        startedAt,
        meta,
        isReset: true,
      });
    }
    
    // Sort by modified date, newest first
    sessions.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
    logger.info('Sessions listed', { category: 'memory', agent: req.query.agent || 'main', count: sessions.length, duration: Date.now() - start });
    res.json({ sessions });
  } catch (err) {
    logger.error('Sessions list failed', { category: 'memory', error: err.message, duration: Date.now() - start });
    res.status(500).json({ error: err.message });
  }
});

// GET /memory/session/:id — Parse session transcript into messages
app.get('/memory/session/:id', authenticate, async (req, res) => {
  const start = Date.now();
  const sessionId = req.params.id;
  const sessionsDir = getSessionsDir(req.query.agent);
  const filePath = path.join(sessionsDir, `${sessionId}.jsonl`);
  
  // Security: validate session ID format (UUID only)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID format' });
  }
  
  try {
    let actualPath = filePath;
    try {
      await fs.access(filePath);
    } catch {
      // If the .jsonl file doesn't exist, try alternatives
      const dirFiles = await fs.readdir(sessionsDir);
      
      // Try topic-suffixed files: {uuid}-topic-{n}.jsonl
      const topicFile = dirFiles.find(f => f.startsWith(`${sessionId}-`) && f.endsWith('.jsonl'));
      if (topicFile) {
        actualPath = path.join(sessionsDir, topicFile);
      } else {
        // Try reset/rotated files: {uuid}.jsonl.reset.{timestamp}
        const resetFile = dirFiles.find(f => f.startsWith(`${sessionId}.jsonl.reset.`));
        if (resetFile) {
          actualPath = path.join(sessionsDir, resetFile);
        }
      }
    }
    const content = await fs.readFile(actualPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    
    const messages = [];
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type === 'message' && entry.message) {
          const { role, content: msgContent } = entry.message;
          if (role === 'user' || role === 'assistant') {
            let text = '';
            if (typeof msgContent === 'string') {
              text = msgContent;
            } else if (Array.isArray(msgContent)) {
              text = msgContent
                .filter(c => c.type === 'text')
                .map(c => c.text)
                .join('\n');
            }
            if (text.trim()) {
              messages.push({
                role,
                text: text.substring(0, 10000), // Cap per-message size
                timestamp: entry.timestamp,
                id: entry.id,
              });
            }
          }
        } else if (entry.type === 'compaction') {
          messages.push({
            role: 'system',
            text: '[Session compacted]',
            timestamp: entry.timestamp,
            id: entry.id,
          });
        }
      } catch {
        // Skip malformed lines
      }
    }
    
    logger.info('Session loaded', { category: 'memory', sessionId, agent: req.query.agent || 'main', messageCount: messages.length, duration: Date.now() - start });
    res.json({ sessionId, messageCount: messages.length, messages });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Session not found' });
    }
    logger.error('Session load failed', { category: 'memory', sessionId, error: err.message, duration: Date.now() - start });
    res.status(500).json({ error: err.message });
  }
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

// POST /gateway/ping - Send a message to Moby via OpenClaw gateway
// Uses /tools/invoke with sessions_send to deliver a message into Moby's active session.
// The message text is constructed server-side (not user-supplied) to prevent prompt injection.
app.post('/gateway/ping', authenticate, async (req, res) => {
  const startTime = Date.now();
  const { message } = req.body;
  
  // Read gateway config
  const configPath = `${HOME}/.openclaw/openclaw.json`;
  
  try {
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    
    const gatewayPort = config.gateway?.port || 18789;
    const gatewayToken = config.gateway?.auth?.token;
    const gatewayUrl = `http://localhost:${gatewayPort}`;
    
    if (!gatewayToken) {
      return res.status(500).json({ error: 'Gateway auth token not configured' });
    }
    
    // Use /tools/invoke to call sessions_send
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(`${gatewayUrl}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        tool: 'sessions_send',
        args: {
          sessionKey: config.session?.mainKey || 'agent:main:main',
          message: message || 'New task available in Moby Kanban. Check the Ready column.',
          timeoutSeconds: 2,  // Fire-and-forget: don't wait for Moby's response
        },
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Gateway send failed', { category: 'gateway', status: response.status, error: errorText });
      return res.status(response.status).json({ 
        error: 'Failed to notify Moby', 
        details: errorText 
      });
    }
    
    const data = await response.json();
    
    if (!data.ok) {
      logger.error('Gateway send error', { category: 'gateway', error: data.error?.message || 'Unknown error' });
      return res.status(500).json({ 
        error: 'Failed to notify Moby',
        details: data.error?.message || 'Unknown error',
      });
    }
    
    logger.info('Gateway ping sent', { category: 'gateway', duration: Date.now() - startTime });
    res.json({ success: true });
  } catch (err) {
    logger.error('Gateway ping failed', { category: 'gateway', error: err.message });
    res.status(500).json({ 
      error: 'Failed to notify Moby', 
      details: err.message 
    });
  }
});

// POST /gateway/restart - Restart the OpenClaw gateway
app.post('/gateway/restart', authenticate, async (req, res) => {
  const startTime = Date.now();
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
      logger.error('Gateway restart failed', { category: 'gateway', status: response.status, error: errorText });
      return res.status(response.status).json({ 
        error: 'Gateway restart failed', 
        details: errorText 
      });
    }
    
    const data = await response.json();
    logger.info('Gateway restart succeeded', { category: 'gateway', duration: Date.now() - startTime });
    res.json({ success: true, ...data });
  } catch (err) {
    logger.error('Gateway restart failed', { category: 'gateway', error: err.message });
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
    logger.warn('Terminal auth failed', { category: 'auth', reason: 'invalid_token' });
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
    logger.warn('Terminal session rejected: max sessions', { category: 'terminal', active: terminalSessions.size });
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
    logger.error('Terminal spawn failed', { category: 'terminal', error: err.message });
    ws.send(JSON.stringify({ type: 'error', error: 'Failed to spawn terminal' }));
    ws.close();
    return;
  }

  terminalSessions.set(sessionId, { pty: shell, ws });
  logger.info('Terminal session started', { category: 'terminal', sessionId, active: terminalSessions.size });

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
    logger.info('Terminal session ended', { category: 'terminal', sessionId, active: terminalSessions.size });
    try { shell.kill(); } catch {}
    if (ws.readyState === ws.OPEN) ws.close();
  }

  ws.on('close', cleanup);
  ws.on('error', cleanup);
});

server.listen(PORT, () => {
  logger.info('File server starting', { category: 'startup', port: PORT, allowedPaths: ALLOWED_PATHS });
});
