const express = require('express');
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT, 10) || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ────────────────────────────────────────────────────────
// IN-MEMORY DATA STORES
// ────────────────────────────────────────────────────────

// decks: Map<deckId, { id, title, owner, slideCount, uploadDate, slides: string[] (base64 JPEGs), notes: string[] }>
const decks = new Map();

// sessions: Map<sessionId, { id, deckId, owner, currentSlide, totalSlides, isZoomed, zoomCoords, filters, spotlight, laser, blackout, createdAt, active, connectedClients }>
const sessions = new Map();

// ────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────

function generateSessionId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 to avoid confusion
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  // Ensure uniqueness
  return sessions.has(id) ? generateSessionId() : id;
}

function generateDeckId() {
  return 'deck-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
}

function createSessionState(sessionId, deckId, owner, totalSlides) {
  return {
    id: sessionId,
    deckId,
    owner,
    currentSlide: 0,
    totalSlides,
    isZoomed: false,
    zoomCoords: { x: 0, y: 0, width: 100, height: 100 },
    filters: { blur: 0, grayscale: false, invert: false, sepia: false, contrast: 100, brightness: 100 },
    spotlight: { active: false, x: 50, y: 50, radius: 180 },
    laser: { active: false, x: 50, y: 50 },
    blackout: false,
    createdAt: new Date().toISOString(),
    active: true,
    connectedClients: 0,
  };
}

// ────────────────────────────────────────────────────────
// BOOT
// ────────────────────────────────────────────────────────

app.prepare().then(() => {
  const expressApp = express();

  expressApp.use(express.json({ limit: '100mb' }));
  expressApp.use(express.urlencoded({ limit: '100mb', extended: true }));

  // ── REST API ──────────────────────────────────────────

  // Upload a processed deck (client sends JSON with base64 slide images)
  expressApp.post('/api/upload', (req, res) => {
    try {
      const { title, owner, slides, notes } = req.body;
      if (!slides || !Array.isArray(slides) || slides.length === 0) {
        return res.status(400).json({ error: 'No slides provided' });
      }

      const deckId = generateDeckId();
      const deck = {
        id: deckId,
        title: title || 'Untitled Presentation',
        owner: (owner || 'guest').toLowerCase(),
        slideCount: slides.length,
        uploadDate: new Date().toISOString(),
        slides, // array of base64 JPEG strings
        notes: notes || slides.map(() => ''),
      };

      decks.set(deckId, deck);
      console.log(`[API] Deck "${deck.title}" uploaded (${deck.slideCount} slides) by ${deck.owner} → ${deckId}`);

      res.json({
        id: deckId,
        title: deck.title,
        slideCount: deck.slideCount,
        uploadDate: deck.uploadDate,
      });
    } catch (err) {
      console.error('[API] Upload error:', err);
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  // Get deck metadata (without images — lightweight)
  expressApp.get('/api/decks/:deckId', (req, res) => {
    const deck = decks.get(req.params.deckId);
    if (!deck) return res.status(404).json({ error: 'Deck not found' });
    res.json({
      id: deck.id,
      title: deck.title,
      owner: deck.owner,
      slideCount: deck.slideCount,
      uploadDate: deck.uploadDate,
      notes: deck.notes,
    });
  });

  // List all decks for a user
  expressApp.get('/api/decks', (req, res) => {
    const owner = (req.query.owner || '').toLowerCase();
    const userDecks = [];
    decks.forEach(deck => {
      if (deck.owner === owner) {
        userDecks.push({
          id: deck.id,
          title: deck.title,
          owner: deck.owner,
          slideCount: deck.slideCount,
          uploadDate: deck.uploadDate,
          // Include first slide as thumbnail
          thumbnail: deck.slides[0] || null,
        });
      }
    });
    userDecks.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
    res.json(userDecks);
  });

  // Serve individual slide image
  expressApp.get('/api/slides/:deckId/:index', (req, res) => {
    const deck = decks.get(req.params.deckId);
    if (!deck) return res.status(404).json({ error: 'Deck not found' });

    const index = parseInt(req.params.index, 10);
    if (isNaN(index) || index < 0 || index >= deck.slides.length) {
      return res.status(404).json({ error: 'Slide not found' });
    }

    const base64 = deck.slides[index];
    // If it's a data URL, strip the prefix and send as image
    if (base64.startsWith('data:image/')) {
      const matches = base64.match(/^data:image\/(.*?);base64,(.*)$/);
      if (matches) {
        const buffer = Buffer.from(matches[2], 'base64');
        res.set('Content-Type', `image/${matches[1]}`);
        res.set('Cache-Control', 'public, max-age=3600');
        return res.send(buffer);
      }
    }
    // Fallback: send as JPEG
    const buffer = Buffer.from(base64, 'base64');
    res.set('Content-Type', 'image/jpeg');
    res.send(buffer);
  });

  // Delete a deck
  expressApp.delete('/api/decks/:deckId', (req, res) => {
    const deckId = req.params.deckId;
    if (!decks.has(deckId)) return res.status(404).json({ error: 'Deck not found' });
    decks.delete(deckId);
    // Also end any sessions using this deck
    sessions.forEach((session, sid) => {
      if (session.deckId === deckId && session.active) {
        session.active = false;
      }
    });
    console.log(`[API] Deck ${deckId} deleted`);
    res.json({ success: true });
  });

  // Create a presentation session
  expressApp.post('/api/sessions', (req, res) => {
    const { deckId, owner } = req.body;
    const deck = decks.get(deckId);
    if (!deck) return res.status(404).json({ error: 'Deck not found' });

    const sessionId = generateSessionId();
    const session = createSessionState(sessionId, deckId, (owner || 'guest').toLowerCase(), deck.slideCount);
    sessions.set(sessionId, session);

    console.log(`[API] Session ${sessionId} created for deck "${deck.title}" by ${session.owner}`);
    res.json({
      id: sessionId,
      deckId: session.deckId,
      deckTitle: deck.title,
      totalSlides: session.totalSlides,
      createdAt: session.createdAt,
    });
  });

  // List active sessions for a user
  expressApp.get('/api/sessions', (req, res) => {
    const owner = (req.query.owner || '').toLowerCase();
    const userSessions = [];
    sessions.forEach(session => {
      if (session.owner === owner && session.active) {
        const deck = decks.get(session.deckId);
        userSessions.push({
          id: session.id,
          deckId: session.deckId,
          deckTitle: deck ? deck.title : 'Unknown',
          currentSlide: session.currentSlide,
          totalSlides: session.totalSlides,
          connectedClients: session.connectedClients,
          createdAt: session.createdAt,
        });
      }
    });
    res.json(userSessions);
  });

  // Get single session info
  expressApp.get('/api/sessions/:sessionId', (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const deck = decks.get(session.deckId);
    res.json({
      id: session.id,
      deckId: session.deckId,
      deckTitle: deck ? deck.title : 'Unknown',
      deckSlideCount: deck ? deck.slideCount : 0,
      currentSlide: session.currentSlide,
      totalSlides: session.totalSlides,
      active: session.active,
      connectedClients: session.connectedClients,
      createdAt: session.createdAt,
      notes: deck ? deck.notes : [],
    });
  });

  // End a session
  expressApp.delete('/api/sessions/:sessionId', (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    session.active = false;
    // Notify all connected clients via socket
    io.to(`session:${req.params.sessionId}`).emit('session-ended', { sessionId: req.params.sessionId });
    console.log(`[API] Session ${req.params.sessionId} ended`);
    res.json({ success: true });
  });

  // Update slide notes for a deck
  expressApp.put('/api/decks/:deckId/notes', (req, res) => {
    const deck = decks.get(req.params.deckId);
    if (!deck) return res.status(404).json({ error: 'Deck not found' });
    const { slideIndex, note } = req.body;
    if (typeof slideIndex !== 'number' || slideIndex < 0 || slideIndex >= deck.slideCount) {
      return res.status(400).json({ error: 'Invalid slide index' });
    }
    deck.notes[slideIndex] = note || '';
    res.json({ success: true });
  });

  // ── SOCKET.IO ─────────────────────────────────────────

  const server = createServer(expressApp);

  const io = new Server(server, {
    maxHttpBufferSize: 5e6, // 5MB — only control messages now, no slide payloads
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    let currentSessionId = null;

    socket.on('join-session', ({ sessionId }) => {
      const session = sessions.get(sessionId);
      if (!session || !session.active) {
        socket.emit('session-error', { error: 'Session not found or ended' });
        return;
      }

      // Leave previous session room if any
      if (currentSessionId) {
        socket.leave(`session:${currentSessionId}`);
        const prev = sessions.get(currentSessionId);
        if (prev) prev.connectedClients = Math.max(0, prev.connectedClients - 1);
      }

      currentSessionId = sessionId;
      socket.join(`session:${sessionId}`);
      session.connectedClients++;

      const deck = decks.get(session.deckId);

      // Send full session state to the joining client
      socket.emit('session-state', {
        sessionId: session.id,
        deckId: session.deckId,
        deckTitle: deck ? deck.title : 'Unknown',
        currentSlide: session.currentSlide,
        totalSlides: session.totalSlides,
        isZoomed: session.isZoomed,
        zoomCoords: session.zoomCoords,
        filters: session.filters,
        spotlight: session.spotlight,
        laser: session.laser,
        blackout: session.blackout,
        connectedClients: session.connectedClients,
        notes: deck ? deck.notes : [],
      });

      // Notify others
      socket.to(`session:${sessionId}`).emit('client-count-updated', {
        connectedClients: session.connectedClients,
      });

      console.log(`[Socket] Client joined session:${sessionId} (${session.connectedClients} connected)`);
    });

    socket.on('slide-change', ({ slideIndex }) => {
      if (!currentSessionId) return;
      const session = sessions.get(currentSessionId);
      if (!session || !session.active) return;

      session.currentSlide = Math.max(0, Math.min(slideIndex, session.totalSlides - 1));
      session.isZoomed = false;
      session.zoomCoords = { x: 0, y: 0, width: 100, height: 100 };

      io.to(`session:${currentSessionId}`).emit('slide-updated', {
        currentSlide: session.currentSlide,
        totalSlides: session.totalSlides,
      });
    });

    socket.on('zoom-area', (coords) => {
      if (!currentSessionId) return;
      const session = sessions.get(currentSessionId);
      if (!session || !session.active) return;

      session.isZoomed = true;
      session.zoomCoords = coords;

      io.to(`session:${currentSessionId}`).emit('zoom-updated', {
        isZoomed: true,
        zoomCoords: session.zoomCoords,
      });
    });

    socket.on('reset-zoom', () => {
      if (!currentSessionId) return;
      const session = sessions.get(currentSessionId);
      if (!session) return;

      session.isZoomed = false;
      session.zoomCoords = { x: 0, y: 0, width: 100, height: 100 };
      session.spotlight.active = false;

      io.to(`session:${currentSessionId}`).emit('zoom-reset');
    });

    socket.on('apply-filter', (filterData) => {
      if (!currentSessionId) return;
      const session = sessions.get(currentSessionId);
      if (!session) return;

      session.filters = { ...session.filters, ...filterData };
      io.to(`session:${currentSessionId}`).emit('filter-updated', { filters: session.filters });
    });

    socket.on('reset-filters', () => {
      if (!currentSessionId) return;
      const session = sessions.get(currentSessionId);
      if (!session) return;

      session.filters = { blur: 0, grayscale: false, invert: false, sepia: false, contrast: 100, brightness: 100 };
      io.to(`session:${currentSessionId}`).emit('filter-updated', { filters: session.filters });
    });

    socket.on('toggle-spotlight', (data) => {
      if (!currentSessionId) return;
      const session = sessions.get(currentSessionId);
      if (!session) return;

      session.spotlight = { ...session.spotlight, ...data };
      io.to(`session:${currentSessionId}`).emit('spotlight-updated', { spotlight: session.spotlight });
    });

    socket.on('laser-move', (data) => {
      if (!currentSessionId) return;
      const session = sessions.get(currentSessionId);
      if (!session) return;

      session.laser = { ...session.laser, ...data };
      socket.to(`session:${currentSessionId}`).emit('laser-updated', { laser: session.laser });
    });

    socket.on('toggle-blackout', () => {
      if (!currentSessionId) return;
      const session = sessions.get(currentSessionId);
      if (!session) return;

      session.blackout = !session.blackout;
      io.to(`session:${currentSessionId}`).emit('blackout-updated', { blackout: session.blackout });
    });

    socket.on('trigger-confetti', () => {
      if (!currentSessionId) return;
      io.to(`session:${currentSessionId}`).emit('confetti-triggered');
    });

    socket.on('end-session', () => {
      if (!currentSessionId) return;
      const session = sessions.get(currentSessionId);
      if (!session) return;

      session.active = false;
      io.to(`session:${currentSessionId}`).emit('session-ended', { sessionId: currentSessionId });
      console.log(`[Socket] Session ${currentSessionId} ended via socket`);
    });

    socket.on('disconnect', () => {
      if (currentSessionId) {
        const session = sessions.get(currentSessionId);
        if (session) {
          session.connectedClients = Math.max(0, session.connectedClients - 1);
          io.to(`session:${currentSessionId}`).emit('client-count-updated', {
            connectedClients: session.connectedClients,
          });
        }
      }
    });
  });

  // ── NEXT.JS CATCH-ALL ─────────────────────────────────

  expressApp.all('*', (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> DeckCast running on http://localhost:${port}`);
  });
});
