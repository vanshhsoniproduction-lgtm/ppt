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
  Sparkles,
  EyeOff,
  Eye
} from 'lucide-react';
import { SAMPLE_DECKS } from '../data/sampleDecks';

export default function PresentPage() {
  const [roomId, setRoomId] = useState('DEMO');
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedClients, setConnectedClients] = useState(0);

  // Deck & Slide State
  const [deckId, setDeckId] = useState('futuristic-tech');
  const [customDeck, setCustomDeck] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [transitionType, setTransitionType] = useState('slide');

  // Zoom State
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomCoords, setZoomCoords] = useState({ x: 0, y: 0, width: 100, height: 100 });

  // Filters State
  const [filters, setFilters] = useState({
    blur: 0,
    grayscale: false,
    invert: false,
    sepia: false,
    contrast: 100,
    brightness: 100,
  });

  // Spotlight & Laser Pointer State
  const [spotlight, setSpotlight] = useState({ active: false, x: 50, y: 50, radius: 180 });
  const [laser, setLaser] = useState({ active: false, x: 50, y: 50 });
  const [blackout, setBlackout] = useState(false);

  // Pure Fullscreen Clean View Toggle (Hides all UI chrome)
  const [cleanMode, setCleanMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef(null);

  // Determine active deck (custom uploaded or sample)
  let activeDeck = customDeck || SAMPLE_DECKS.find(d => d.id === deckId) || SAMPLE_DECKS[0];
  const slide = activeDeck.slides ? (activeDeck.slides[currentSlide] || activeDeck.slides[0]) : activeDeck;
  const totalSlides = activeDeck.slides ? activeDeck.slides.length : 1;

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room') || 'DEMO';
    const deckParam = urlParams.get('deck');
    setRoomId(roomParam.toUpperCase());

    // Check if custom deck exists in localStorage
    if (deckParam && localStorage.getItem(`custom_deck_${deckParam}`)) {
      try {
        const saved = JSON.parse(localStorage.getItem(`custom_deck_${deckParam}`));
        setCustomDeck(saved);
      } catch (e) {}
    }

    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('join-room', { roomId: roomParam, role: 'host' });
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('room-state', (state) => {
      if (state.customDeck) setCustomDeck(state.customDeck);
      if (state.currentSlide !== undefined) setCurrentSlide(state.currentSlide);
      if (state.deckId) setDeckId(state.deckId);
      if (state.isZoomed !== undefined) setIsZoomed(state.isZoomed);
      if (state.zoomCoords) setZoomCoords(state.zoomCoords);
      if (state.filters) setFilters(state.filters);
      if (state.spotlight) setSpotlight(state.spotlight);
      if (state.laser) setLaser(state.laser);
      if (state.transitionType) setTransitionType(state.transitionType);
      if (state.blackout !== undefined) setBlackout(state.blackout);
      if (state.connectedClients) setConnectedClients(state.connectedClients);
    });

    newSocket.on('deck-uploaded', (data) => {
      setCustomDeck(data.deck);
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

    newSocket.on('transition-updated', (data) => {
      setTransitionType(data.transitionType);
    });

    newSocket.on('deck-updated', (data) => {
      setDeckId(data.deckId);
      setCustomDeck(null);
      setCurrentSlide(0);
      setIsZoomed(false);
    });

    newSocket.on('confetti-triggered', () => {
      confetti({
        particleCount: 140,
        spread: 90,
        origin: { y: 0.6 }
      });
    });

    newSocket.on('client-joined', (data) => {
      setConnectedClients(data.connectedClients);
    });

    newSocket.on('client-left', (data) => {
      setConnectedClients(data.connectedClients);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        prevSlide();
      } else if (e.key === 'Escape') {
        resetZoom();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'h' || e.key === 'H') {
        setCleanMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide, totalSlides, socket]);

  const nextSlide = () => {
    if (currentSlide < totalSlides - 1) {
      const nextIdx = currentSlide + 1;
      setCurrentSlide(nextIdx);
      if (socket) socket.emit('slide-change', { slideIndex: nextIdx, totalSlides });
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      const prevIdx = currentSlide - 1;
      setCurrentSlide(prevIdx);
      if (socket) socket.emit('slide-change', { slideIndex: prevIdx, totalSlides });
    }
  };

  const resetZoom = () => {
    setIsZoomed(false);
    setZoomCoords({ x: 0, y: 0, width: 100, height: 100 });
    if (socket) socket.emit('reset-zoom');
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => console.log(err));
      setIsFullscreen(true);
      setCleanMode(true); // Automatically enter pure full slide view in fullscreen!
    } else {
      document.exitFullscreen().catch(err => console.log(err));
      setIsFullscreen(false);
      setCleanMode(false);
    }
  };

  // Zoom Transform Calculation
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
      className="relative w-screen h-screen bg-[#F2F2F7] text-[#1C1C1E] overflow-hidden select-none"
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

      {/* Main Presentation Screen Canvas */}
      <div className="w-full h-full relative flex items-center justify-center p-0 md:p-4">
        <motion.div
          className={`w-full h-full relative overflow-hidden bg-white shadow-2xl flex flex-col justify-center items-center ${cleanMode ? 'rounded-none border-0' : 'md:rounded-3xl border border-white/80'}`}
          animate={{
            scale: zoomStyle.scale,
            transformOrigin: zoomStyle.transformOrigin
          }}
          transition={{ type: 'spring', stiffness: 190, damping: 25 }}
          style={{ filter: cssFilterString }}
        >
          {/* Render PDF / Image Slide OR Standard Slide */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeDeck.id}-${currentSlide}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="w-full h-full flex items-center justify-center relative overflow-hidden"
            >
              {/* Uploaded PDF / Image Slide Presentation */}
              {slide.image ? (
                <img
                  src={slide.image}
                  alt={slide.title || 'PDF Slide'}
                  className="w-full h-full object-contain max-h-screen max-w-full"
                />
              ) : (
                /* Standard Rich Text Slide */
                <div className="w-full h-full p-8 md:p-16 flex flex-col justify-between relative bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
                  <div className="flex items-center justify-between z-10">
                    <span className="px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-500/10 border border-blue-500/20 rounded-full">
                      {slide.category || 'PRESENTATION'}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {currentSlide + 1} / {totalSlides}
                    </span>
                  </div>

                  <div className="my-auto z-10 space-y-6 max-w-4xl">
                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-[#1C1C1E] leading-tight">
                      {slide.title}
                    </h1>
                    <p className="text-lg md:text-2xl text-slate-600 font-light leading-relaxed">
                      {slide.tagline || slide.notes}
                    </p>

                    {slide.metrics && (
                      <div className="grid grid-cols-3 gap-4 pt-6 max-w-xl">
                        {slide.metrics.map((m, idx) => (
                          <div key={idx} className="glass-card-light p-4 text-center border border-slate-200">
                            <div className="text-2xl md:text-3xl font-bold text-blue-600">{m.value}</div>
                            <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">{m.label}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="z-10 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400">
                    <span>{activeDeck.title}</span>
                    <div className="w-32 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full transition-all duration-300"
                        style={{ width: `${((currentSlide + 1) / totalSlides) * 100}%` }}
                      />
                    </div>
                  </div>
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
            background: `radial-gradient(circle ${spotlight.radius || 180}px at ${spotlight.x}% ${spotlight.y}%, transparent 0%, rgba(0, 0, 0, 0.85) 100%)`,
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
          <div className="w-4 h-4 bg-red-500 rounded-full shadow-[0_0_15px_#ef4444] animate-ping opacity-75" />
          <div className="absolute w-3 h-3 bg-red-500 rounded-full border border-white shadow-md" />
        </motion.div>
      )}

      {/* Top Floating Glass HUD (Hidden when in pure clean presentation mode) */}
      {!cleanMode && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 flex items-center space-x-3">
          <div className="glass-dock-light px-4 py-2 flex items-center space-x-4 text-xs font-mono text-slate-700">
            <div className="flex items-center space-x-2">
              {isConnected ? (
                <span className="flex items-center text-emerald-600 font-semibold">
                  <Wifi className="w-3.5 h-3.5 mr-1 animate-pulse" />
                  ROOM: <strong className="text-[#1C1C1E] ml-1">{roomId}</strong>
                </span>
              ) : (
                <span className="flex items-center text-rose-500">
                  <WifiOff className="w-3.5 h-3.5 mr-1" />
                  DISCONNECTED
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
              className="p-1 rounded-lg hover:bg-slate-200/60 transition-colors text-slate-600 flex items-center space-x-1"
              title="Hide UI Chrome (H)"
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
