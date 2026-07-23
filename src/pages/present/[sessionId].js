import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Maximize2,
  Minimize2,
  Wifi,
  WifiOff,
  Users,
  EyeOff,
  StopCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';

export default function HostScreen() {
  const router = useRouter();
  const { sessionId } = router.query;

  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedClients, setConnectedClients] = useState(0);
  const [sessionActive, setSessionActive] = useState(true);
  const [sessionError, setSessionError] = useState(null);

  // Deck info
  const [deckId, setDeckId] = useState(null);
  const [deckTitle, setDeckTitle] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [totalSlides, setTotalSlides] = useState(1);
  const [slideDirection, setSlideDirection] = useState(1); // 1 = Next (L->R), -1 = Prev (R->L)
  const currentSlideRef = useRef(0);

  // 100% In-Memory RAM Image Caching State
  const [cachedSlides, setCachedSlides] = useState([]);
  const [isPreloading, setIsPreloading] = useState(true);
  const [preloadProgress, setPreloadProgress] = useState(0);

  // Overlays
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomCoords, setZoomCoords] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [filters, setFilters] = useState({ blur: 0, grayscale: false, invert: false, sepia: false, contrast: 100, brightness: 100 });
  const [spotlight, setSpotlight] = useState({ active: false, x: 50, y: 50, radius: 180 });
  const [laser, setLaser] = useState({ active: false, x: 50, y: 50 });
  const [blackout, setBlackout] = useState(false);

  // UI modes
  const [cleanMode, setCleanMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef(null);

  useEffect(() => {
    currentSlideRef.current = currentSlide;
  }, [currentSlide]);

  // PRELOAD ALL SLIDES DIRECTLY INTO BLOB URLS IN RAM MEMORY
  useEffect(() => {
    if (!deckId || !totalSlides) return;

    let isMounted = true;
    const slideMap = new Array(totalSlides);
    let loadedCount = 0;

    const loadAllSlides = async () => {
      setIsPreloading(true);
      setPreloadProgress(0);

      for (let i = 0; i < totalSlides; i++) {
        try {
          const res = await fetch(`/api/slides/${deckId}/${i}`);
          const blob = await res.blob();
          const objectUrl = URL.createObjectURL(blob);
          slideMap[i] = objectUrl;
        } catch (e) {
          slideMap[i] = `/api/slides/${deckId}/${i}`;
        }
        loadedCount++;
        if (isMounted) {
          setPreloadProgress(Math.round((loadedCount / totalSlides) * 100));
        }
      }

      if (isMounted) {
        setCachedSlides(slideMap);
        setIsPreloading(false);
      }
    };

    loadAllSlides();

    return () => {
      isMounted = false;
    };
  }, [deckId, totalSlides]);

  // Socket connection
  useEffect(() => {
    if (!sessionId) return;

    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('join-session', { sessionId });
    });

    newSocket.on('disconnect', () => setIsConnected(false));

    newSocket.on('session-state', (state) => {
      setDeckId(state.deckId);
      setDeckTitle(state.deckTitle);
      setCurrentSlide(state.currentSlide);
      setTotalSlides(state.totalSlides);
      setIsZoomed(state.isZoomed);
      setZoomCoords(state.zoomCoords);
      setFilters(state.filters);
      setSpotlight(state.spotlight);
      setLaser(state.laser);
      setBlackout(state.blackout);
      setConnectedClients(state.connectedClients);
      setSessionActive(true);
    });

    newSocket.on('session-error', (data) => {
      setSessionError(data.error);
      setSessionActive(false);
    });

    newSocket.on('slide-updated', (data) => {
      const newIdx = data.currentSlide;
      setSlideDirection(newIdx >= currentSlideRef.current ? 1 : -1);
      setCurrentSlide(newIdx);
      setTotalSlides(data.totalSlides);
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

    newSocket.on('filter-updated', (data) => setFilters(data.filters));
    newSocket.on('spotlight-updated', (data) => setSpotlight(data.spotlight));
    newSocket.on('laser-updated', (data) => setLaser(data.laser));
    newSocket.on('blackout-updated', (data) => setBlackout(data.blackout));

    newSocket.on('confetti-triggered', () => {
      confetti({ particleCount: 160, spread: 100, origin: { y: 0.6 } });
    });

    newSocket.on('client-count-updated', (data) => setConnectedClients(data.connectedClients));

    newSocket.on('session-ended', () => {
      setSessionActive(false);
    });

    return () => newSocket.disconnect();
  }, [sessionId]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        if (currentSlide < totalSlides - 1) {
          const next = currentSlide + 1;
          setSlideDirection(1);
          setCurrentSlide(next);
          if (socket) socket.emit('slide-change', { slideIndex: next });
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentSlide > 0) {
          const prev = currentSlide - 1;
          setSlideDirection(-1);
          setCurrentSlide(prev);
          if (socket) socket.emit('slide-change', { slideIndex: prev });
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

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentSlide, totalSlides, socket]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
      setCleanMode(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
      setCleanMode(false);
    }
  };

  const handleEndSession = () => {
    if (socket) socket.emit('end-session');
    setSessionActive(false);
  };

  // Exact 16:9 Aspect Ratio Rectangular Zoom Calculation
  const calcZoom = () => {
    if (!isZoomed || !zoomCoords) return { scale: 1, transformOrigin: '50% 50%' };
    const { x, y, width, height } = zoomCoords;

    const pxX = parseFloat(x) || 0;
    const pxY = parseFloat(y) || 0;
    const pxW = Math.max(5, parseFloat(width) || 100);
    const pxH = Math.max(5, parseFloat(height) || 100);

    const cx = Math.min(100, Math.max(0, pxX + pxW / 2));
    const cy = Math.min(100, Math.max(0, pxY + pxH / 2));

    const scaleX = 100 / pxW;
    const scaleY = 100 / pxH;
    const scale = Math.min(6, Math.max(1.2, Math.min(scaleX, scaleY)));

    return { scale, transformOrigin: `${cx}% ${cy}%` };
  };

  const zoom = calcZoom();

  const cssFilter = `
    blur(${filters.blur}px)
    ${filters.grayscale ? 'grayscale(100%)' : ''}
    ${filters.invert ? 'invert(100%)' : ''}
    ${filters.sepia ? 'sepia(100%)' : ''}
    contrast(${filters.contrast}%)
    brightness(${filters.brightness}%)
  `.trim();

  // COOL 3D PARALLAX KEYNOTE SLIDE ANIMATION VARIANTS
  const slideVariants = {
    enter: (dir) => ({
      x: dir > 0 ? '100%' : '-100%',
      rotateY: dir > 0 ? 35 : -35,
      scale: 0.84,
      opacity: 0,
      filter: 'blur(12px)',
    }),
    center: {
      x: '0%',
      rotateY: 0,
      scale: 1,
      opacity: 1,
      filter: 'blur(0px)',
    },
    exit: (dir) => ({
      x: dir < 0 ? '100%' : '-100%',
      rotateY: dir < 0 ? 35 : -35,
      scale: 0.84,
      opacity: 0,
      filter: 'blur(12px)',
    }),
  };

  const currentSlideSrc = cachedSlides[currentSlide] || `/api/slides/${deckId}/${currentSlide}`;

  // Error / ended states
  if (sessionError || (!sessionActive && deckId)) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <StopCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h1 className="text-xl font-bold text-white">Session Ended</h1>
          <p className="text-sm text-slate-400">{sessionError || 'This presentation session has been closed.'}</p>
          <button onClick={() => router.push('/')} className="dc-btn dc-btn-primary text-sm py-2.5">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!deckId) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
          <p className="text-sm text-slate-400 font-mono">Connecting to session {sessionId}...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen bg-black text-white overflow-hidden select-none flex items-center justify-center"
      style={{ perspective: '1200px' }}
    >
      {/* Preloading HUD Progress Overlay */}
      <AnimatePresence>
        {isPreloading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 space-y-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/30">
              D
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white">Preloading High-Definition Slides</h3>
              <p className="text-xs text-slate-400">Caching {totalSlides} pages directly into ultra-fast RAM memory</p>
            </div>
            <div className="w-64 bg-slate-800 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-700">
              <motion.div
                className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 h-full rounded-full"
                animate={{ width: `${preloadProgress}%` }}
                transition={{ duration: 0.15 }}
              />
            </div>
            <span className="text-xs font-mono text-blue-400 font-bold">{preloadProgress}% Cached</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Blackout Overlay */}
      <AnimatePresence>
        {blackout && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black z-50 flex items-center justify-center"
          >
            <span className="text-xs text-slate-600 font-mono tracking-widest uppercase">
              [ Screen Blacked Out ]
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main 16:9 Presentation Canvas */}
      <div className="w-full h-full relative flex items-center justify-center">
        <motion.div
          className="w-full h-full relative overflow-hidden flex items-center justify-center"
          animate={{ scale: zoom.scale, transformOrigin: zoom.transformOrigin }}
          transition={{ type: 'spring', stiffness: 190, damping: 25 }}
          style={{ filter: cssFilter, transformStyle: 'preserve-3d' }}
        >
          <AnimatePresence mode="wait" custom={slideDirection}>
            <motion.div
              key={`slide-${currentSlide}`}
              custom={slideDirection}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                type: 'spring',
                stiffness: 220,
                damping: 24,
                mass: 0.8,
              }}
              className="w-full h-full flex items-center justify-center absolute inset-0"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <img
                src={currentSlideSrc}
                alt={`Slide ${currentSlide + 1}`}
                className="max-w-full max-h-full object-contain shadow-2xl"
                draggable={false}
              />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Spotlight Overlay */}
      {spotlight.active && (
        <div
          className="absolute inset-0 pointer-events-none z-30"
          style={{
            background: `radial-gradient(circle ${spotlight.radius || 180}px at ${spotlight.x}% ${spotlight.y}%, transparent 0%, rgba(0,0,0,0.88) 100%)`,
          }}
        />
      )}

      {/* Laser Pointer */}
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

      {/* Top HUD */}
      {!cleanMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40">
          <div className="dc-panel px-4 py-2 flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              {isConnected ? (
                <Wifi className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-red-500" />
              )}
              <span className="font-bold text-[var(--dc-blue)]">{sessionId}</span>
            </div>

            <div className="h-4 w-px bg-[var(--dc-border)]" />

            <div className="flex items-center gap-1 text-[var(--dc-text-secondary)]">
              <Users className="w-3.5 h-3.5" />
              {connectedClients}
            </div>

            <div className="h-4 w-px bg-[var(--dc-border)]" />

            <span className="text-[var(--dc-text-secondary)]">
              {currentSlide + 1} / {totalSlides}
            </span>

            <div className="h-4 w-px bg-[var(--dc-border)]" />

            <button onClick={handleEndSession} className="text-red-500 hover:text-red-400 font-bold flex items-center gap-1" title="End Session">
              <StopCircle className="w-3.5 h-3.5" />
              End
            </button>

            <button onClick={() => setCleanMode(true)} className="text-[var(--dc-text-secondary)] hover:text-[var(--dc-text)]" title="Hide HUD (H)">
              <EyeOff className="w-3.5 h-3.5" />
            </button>

            <button onClick={toggleFullscreen} className="text-[var(--dc-text-secondary)] hover:text-[var(--dc-text)]" title="Fullscreen (F)">
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
