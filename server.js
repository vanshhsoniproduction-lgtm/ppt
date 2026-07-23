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

// Store presentation state per room
const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      roomId,
      currentSlide: 0,
      totalSlides: 1,
      deckId: null,
      customDeck: null,
      userDecks: [], // Stores all presentation decks for this workspace room
      isZoomed: false,
      zoomCoords: { x: 0, y: 0, width: 100, height: 100 },
      transitionType: 'slide',
      filters: {
        blur: 0,
        grayscale: false,
        invert: false,
        sepia: false,
        contrast: 100,
        brightness: 100,
      },
      spotlight: {
        active: false,
        x: 50,
        y: 50,
        radius: 180,
      },
      laser: {
        active: false,
        x: 50,
        y: 50,
      },
      blackout: false,
      connectedClients: 0
    });
  }
  return rooms.get(roomId);
}

app.prepare().then(() => {
  const expressApp = express();

  expressApp.use(express.json({ limit: '150mb' }));
  expressApp.use(express.urlencoded({ limit: '150mb', extended: true }));

  const server = createServer(expressApp);

  const io = new Server(server, {
    maxHttpBufferSize: 1e8, // 100 MB payload buffer
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    let currentRoomId = null;
    let clientRole = 'remote';

    socket.on('join-room', ({ roomId, role }) => {
      const cleanRoomId = (roomId || 'default').toUpperCase().trim();
      currentRoomId = cleanRoomId;
      clientRole = role || 'remote';

      socket.join(cleanRoomId);
      const room = getOrCreateRoom(cleanRoomId);
      room.connectedClients++;

      // Send initial room state to newly joined client
      socket.emit('room-state', room);

      // Notify other clients in the room
      io.to(cleanRoomId).emit('client-joined', {
        role: clientRole,
        connectedClients: room.connectedClients
      });

      console.log(`[Socket] ${role} joined room: ${cleanRoomId} (connected: ${room.connectedClients})`);
    });

    socket.on('sync-user-decks', ({ roomId, userDecks }) => {
      const targetRoomId = (roomId || currentRoomId || 'default').toUpperCase().trim();
      if (!userDecks || !Array.isArray(userDecks)) return;

      const room = getOrCreateRoom(targetRoomId);
      room.userDecks = userDecks;
      if (userDecks.length > 0 && !room.customDeck) {
        room.customDeck = userDecks[0];
      }

      io.to(targetRoomId).emit('user-decks-synced', {
        userDecks: room.userDecks
      });
      console.log(`[Socket] Synced ${userDecks.length} presentation files to room: ${targetRoomId}`);
    });

    socket.on('upload-deck', ({ roomId, deck }) => {
      const targetRoomId = (roomId || currentRoomId || 'default').toUpperCase().trim();
      if (!deck) return;

      const room = getOrCreateRoom(targetRoomId);
      room.customDeck = deck;
      room.deckId = deck.id;
      room.currentSlide = 0;
      room.totalSlides = deck.slides ? deck.slides.length : 1;
      room.isZoomed = false;

      // Add to userDecks array if not present
      if (!room.userDecks) room.userDecks = [];
      const idx = room.userDecks.findIndex(d => d.id === deck.id);
      if (idx >= 0) {
        room.userDecks[idx] = deck;
      } else {
        room.userDecks.unshift(deck);
      }

      io.to(targetRoomId).emit('deck-uploaded', {
        deck,
        currentSlide: 0,
        totalSlides: room.totalSlides
      });
      io.to(targetRoomId).emit('user-decks-synced', {
        userDecks: room.userDecks
      });

      console.log(`[Socket] Presentation "${deck.title}" uploaded to room: ${targetRoomId}`);
    });

    socket.on('slide-change', ({ slideIndex, totalSlides }) => {
      if (!currentRoomId) return;
      const room = getOrCreateRoom(currentRoomId);
      room.currentSlide = slideIndex;
      if (totalSlides) room.totalSlides = totalSlides;

      room.isZoomed = false;
      room.zoomCoords = { x: 0, y: 0, width: 100, height: 100 };

      io.to(currentRoomId).emit('slide-updated', {
        currentSlide: room.currentSlide,
        totalSlides: room.totalSlides,
        isZoomed: false
      });
    });

    socket.on('zoom-area', (coords) => {
      if (!currentRoomId) return;
      const room = getOrCreateRoom(currentRoomId);
      room.isZoomed = true;
      room.zoomCoords = coords;

      io.to(currentRoomId).emit('zoom-updated', {
        isZoomed: true,
        zoomCoords: room.zoomCoords
      });
    });

    socket.on('reset-zoom', () => {
      if (!currentRoomId) return;
      const room = getOrCreateRoom(currentRoomId);
      room.isZoomed = false;
      room.zoomCoords = { x: 0, y: 0, width: 100, height: 100 };
      room.spotlight.active = false;

      io.to(currentRoomId).emit('zoom-reset', {
        isZoomed: false,
        zoomCoords: room.zoomCoords,
        spotlight: room.spotlight
      });
    });

    socket.on('apply-filter', (filterData) => {
      if (!currentRoomId) return;
      const room = getOrCreateRoom(currentRoomId);
      room.filters = { ...room.filters, ...filterData };

      io.to(currentRoomId).emit('filter-updated', {
        filters: room.filters
      });
    });

    socket.on('reset-filters', () => {
      if (!currentRoomId) return;
      const room = getOrCreateRoom(currentRoomId);
      room.filters = {
        blur: 0,
        grayscale: false,
        invert: false,
        sepia: false,
        contrast: 100,
        brightness: 100,
      };

      io.to(currentRoomId).emit('filter-updated', {
        filters: room.filters
      });
    });

    socket.on('toggle-spotlight', (spotlightData) => {
      if (!currentRoomId) return;
      const room = getOrCreateRoom(currentRoomId);
      room.spotlight = { ...room.spotlight, ...spotlightData };

      io.to(currentRoomId).emit('spotlight-updated', {
        spotlight: room.spotlight
      });
    });

    socket.on('laser-move', (laserData) => {
      if (!currentRoomId) return;
      const room = getOrCreateRoom(currentRoomId);
      room.laser = { ...room.laser, ...laserData };

      socket.to(currentRoomId).emit('laser-updated', {
        laser: room.laser
      });
    });

    socket.on('toggle-blackout', () => {
      if (!currentRoomId) return;
      const room = getOrCreateRoom(currentRoomId);
      room.blackout = !room.blackout;

      io.to(currentRoomId).emit('blackout-updated', {
        blackout: room.blackout
      });
    });

    socket.on('trigger-confetti', () => {
      if (!currentRoomId) return;
      io.to(currentRoomId).emit('confetti-triggered');
    });

    socket.on('disconnect', () => {
      if (currentRoomId && rooms.has(currentRoomId)) {
        const room = rooms.get(currentRoomId);
        room.connectedClients = Math.max(0, room.connectedClients - 1);
        io.to(currentRoomId).emit('client-left', {
          role: clientRole,
          connectedClients: room.connectedClients
        });
      }
    });
  });

  expressApp.all('*', (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Presentation Control System running on http://localhost:${port}`);
  });
});
