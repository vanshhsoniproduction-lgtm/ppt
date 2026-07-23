import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Maximize2,
  Minimize2,
  Wifi,
  WifiOff,
  Smartphone,
  EyeOff
} from 'lucide-react';
import { getDeckByIdFromDB } from '../utils/db';
import { SAMPLE_DECKS } from '../data/sampleDecks';

export default function PresentPage() {
  const [roomId, setRoomId] = useState('DEMO');
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedClients, setConnectedClients] = useState(0);

  // Active Presentation State
  const [activeDeck, setActiveDeck] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Zoom State
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomCoords, setZoomCoords] = useState({ x: 0, y: 0, width: 100, height: 100 });

  // Filters & Overlay State
  const [filters, setFilters] = useState({
    blur: 0,
    grayscale: false,
    invert: false,
    sepia: false,
    contrast: 100,
    brightness: 100,
  });

  const [spotlight, setSpotlight] = useState({ active: false, x: 50, y: 50, radius: 180 });
  const [laser, setLaser] = useState({ active: false, x: 50, y: 50 });
  const [blackout, setBlackout] = useState(false);

  // UI Modes
  const [cleanMode, setCleanMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room') || 'DEMO';
    const deckParam = urlParams.get('deck');
    setRoomId(roomParam.toUpperCase());

    const newSocket = io();
    setSocket(newSocket);

    // Function to broadcast deck to server room once loaded
    const broadcastDeck = (loadedDeck) => {
      setActiveDeck(loadedDeck);
      if (newSocket && loadedDeck) {
        newSocket.emit('upload-deck', { deck: loadedDeck });
      }
    };

    // Load actual deck from IndexedDB
    if (deckParam) {
      getDeckByIdFromDB(deckParam).then(deck => {
        if (deck) {
          broadcastDeck(deck);
        } else {
          broadcastDeck(SAMPLE_DECKS[0]);
        }
      });
    } else {
      broadcastDeck(SAMPLE_DECKS[0]);
    }

    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('join-room', { roomId: roomParam, role: 'host' });
      // If deck is already loaded locally, broadcast to room immediately upon socket connect
      if (activeDeck) {
        newSocket.emit('upload-deck', { deck: activeDeck });
      }
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('room-state', (state) => {
      if (state.customDeck) setActiveDeck(state.customDeck);
      if (state.currentSlide !== undefined) setCurrentSlide(state.currentSlide);
      if (state.isZoomed !== undefined) setIsZoomed(state.isZoomed);
      if (state.zoomCoords) setZoomCoords(state.zoomCoords);
      if (state.filters) setFilters(state.filters);
      if (state.spotlight) setSpotlight(state.spotlight);
      if (state.laser) setLaser(state.laser);
      if (state.blackout !== undefined) setBlackout(state.blackout);
      if (state.connectedClients) setConnectedClients(state.connectedClients);
    });

    newSocket.on('deck-uploaded', (data) => {
      setActiveDeck(data.deck);
      setCurrentSlide(0);
      setIsZoomed(false);
    });

    newSocket.on('slide-updated', (data) => {
      setCurrentSlide(data.currentSlide);
      setIsZoomed(false);
      setZoomCoords({ x: 0, y: 0, width: 100, height: 100 });
    });

    newSocket.on('zoom-updated', (data) => {
      setIsZoomed(data.isZoomed);
      setZoomCoords(data.zoomCoords);
    });

    newSocket.on('zoom-reset', () => {
      setIsZoomed(false);
      setZoomCoords({ x: 0, y: 0, width: 100, height: 100 });
      setSpotlight(prev => ({ ...prev, active: false }));
    });

    newSocket.on('filter-updated', (data) => {
      setFilters(data.filters);
    });

    newSocket.on('spotlight-updated', (data) => {
      setSpotlight(data.spotlight);
    });

    newSocket.on('laser-updated', (data) => {
      setLaser(data.laser);
    });

    newSocket.on('blackout-updated', (data) => {
      setBlackout(data.blackout);
    });

    newSocket.on('confetti-triggered', () => {
      confetti({ particleCount: 140, spread: 90, origin: { y: 0.6 } });
    });

    newSocket.on('client-joined', (data) => { setConnectedClients(data.connectedClients); });
    newSocket.on('client-left', (data) => { setConnectedClients(data.connectedClients); });

    return () => { newSocket.disconnect(); };
  }, []);

  // Make sure to re-broadcast if socket connects after deck is loaded
  useEffect(() => {
    if (socket && isConnected && activeDeck) {
      socket.emit('upload-deck', { deck: activeDeck });
    }
  }, [socket, isConnected, activeDeck]);

  const slideDeck = activeDeck || SAMPLE_DECKS[0];
  const slides = slideDeck.slides || [];
  const slide = slides[currentSlide] || slides[0] || {};
  const totalSlides = slides.length || 1;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        if (currentSlide < totalSlides - 1) {
          const next = currentSlide + 1;
          setCurrentSlide(next);
          if (socket) socket.emit('slide-change', { slideIndex: next, totalSlides });
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentSlide > 0) {
          const prev = currentSlide - 1;
          setCurrentSlide(prev);
          if (socket) socket.emit('slide-change', { slideIndex: prev, totalSlides });
        }
      } else if (e.key === 'Escape') {
        setIsZoomed(false);
        setZoomCoords({ x: 0, y: 0, width: 100, height: 100 });
        if (socket) socket.emit('reset-zoom');
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'h' || e.key === 'H') {
        setCleanMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide, totalSlides, socket]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => console.log(err));
      setIsFullscreen(true);
      setCleanMode(true);
    } else {
      document.exitFullscreen().catch(err => console.log(err));
      setIsFullscreen(false);
      setCleanMode(false);
    }
  };

  const calcZoomTransform = () => {
    if (!isZoomed || !zoomCoords) {
      return { scale: 1, transformOrigin: '50% 50%' };
    }
    const { x, y, width, height } = zoomCoords;
    const centerX = Math.min(100, Math.max(0, parseFloat(x) + parseFloat(width) / 2));
    const centerY = Math.min(100, Math.max(0, parseFloat(y) + parseFloat(height) / 2));

    const maxDim = Math.max(parseFloat(width), parseFloat(height));
    const rawScale = maxDim > 0 ? 100 / maxDim : 1;
    const scale = Math.min(6, Math.max(1.2, rawScale));

    return { scale, transformOrigin: `${centerX}% ${centerY}%` };
  };

  const zoomStyle = calcZoomTransform();

  const cssFilterString = `
    blur(${filters.blur}px)
    ${filters.grayscale ? 'grayscale(100%)' : ''}
    ${filters.invert ? 'invert(100%)' : ''}
    ${filters.sepia ? 'sepia(100%)' : ''}
    contrast(${filters.contrast}%)
    brightness(${filters.brightness}%)
  `.trim();

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen bg-[#000000] text-white overflow-hidden select-none flex items-center justify-center"
    >
      {/* Blackout Overlay */}
      <AnimatePresence>
        {blackout && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black z-50 flex items-center justify-center"
          >
            <div className="text-center text-slate-500 font-mono text-xs tracking-widest uppercase">
              [ Presentation Blackout ]
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main 16:9 Presentation Canvas */}
      <div className="w-full h-full relative flex items-center justify-center p-0">
        <motion.div
          className="w-full h-full relative overflow-hidden bg-black flex items-center justify-center"
          animate={{
            scale: zoomStyle.scale,
            transformOrigin: zoomStyle.transformOrigin
          }}
          transition={{ type: 'spring', stiffness: 190, damping: 25 }}
          style={{ filter: cssFilterString }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`${slideDeck.id}-${currentSlide}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full flex items-center justify-center relative overflow-hidden"
            >
              {/* Actual Uploaded Slide Image */}
              {slide && slide.image ? (
                <img
                  src={slide.image}
                  alt={slide.title || 'Slide'}
                  className="w-full h-full object-contain max-h-screen max-w-full"
                />
              ) : (
                /* Fallback Slide Layout */
                <div className="w-full h-full p-12 flex flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-800 to-black text-white">
                  <div className="flex justify-between items-center text-xs font-mono text-blue-400">
                    <span>{slide.category || 'PRESENTATION'}</span>
                    <span>{currentSlide + 1} / {totalSlides}</span>
                  </div>
                  <div className="my-auto space-y-4 max-w-3xl">
                    <h1 className="text-4xl md:text-6xl font-bold">{slide.title}</h1>
                    <p className="text-lg text-slate-300">{slide.tagline || slide.notes}</p>
                  </div>
                  <div className="text-xs text-slate-500">{slideDeck.title}</div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Spotlight Effect Overlay Mask */}
      {spotlight.active && (
        <div
          className="absolute inset-0 pointer-events-none z-30 transition-all duration-300"
          style={{
            background: `radial-gradient(circle ${spotlight.radius || 180}px at ${spotlight.x}% ${spotlight.y}%, transparent 0%, rgba(0, 0, 0, 0.88) 100%)`,
            backdropFilter: 'blur(4px)',
          }}
        />
      )}

      {/* Real-Time Laser Pointer Dot Overlay */}
      {laser.active && (
        <motion.div
          className="absolute w-6 h-6 rounded-full pointer-events-none z-40 -ml-3 -mt-3 flex items-center justify-center"
          animate={{ left: `${laser.x}%`, top: `${laser.y}%` }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        >
          <div className="w-4 h-4 bg-red-500 rounded-full shadow-[0_0_20px_#ef4444] animate-ping opacity-80" />
          <div className="absolute w-3 h-3 bg-red-500 rounded-full border border-white shadow-lg" />
        </motion.div>
      )}

      {/* Top Floating Glass HUD (Hidden when cleanMode is active) */}
      {!cleanMode && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 flex items-center space-x-3">
          <div className="glass-dock-light px-4 py-2 flex items-center space-x-4 text-xs font-mono text-slate-800">
            <div className="flex items-center space-x-2">
              {isConnected ? (
                <span className="flex items-center text-emerald-600 font-bold">
                  <Wifi className="w-3.5 h-3.5 mr-1 animate-pulse" />
                  ROOM: <strong className="ml-1 text-[#1C1C1E]">{roomId}</strong>
                </span>
              ) : (
                <span className="flex items-center text-rose-500">
                  <WifiOff className="w-3.5 h-3.5 mr-1" />
                  OFFLINE
                </span>
              )}
            </div>

            <div className="h-4 w-px bg-slate-300" />

            <div className="flex items-center space-x-1 text-slate-600">
              <Smartphone className="w-3.5 h-3.5 text-blue-600" />
              <span>Remotes: <strong>{connectedClients > 0 ? connectedClients - 1 : 0}</strong></span>
            </div>

            <div className="h-4 w-px bg-slate-300" />

            <button
              onClick={() => setCleanMode(true)}
              className="p-1 rounded-lg hover:bg-slate-200/60 transition-colors text-slate-600"
              title="Hide UI Overlay (H)"
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-1 rounded-lg hover:bg-slate-200/60 transition-colors text-slate-600"
              title="Toggle Fullscreen (F)"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
