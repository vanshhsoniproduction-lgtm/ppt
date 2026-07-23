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
  Layers,
  Sliders,
  Tv,
  HelpCircle,
  Play,
  RotateCcw
} from 'lucide-react';
import { SAMPLE_DECKS } from '../data/sampleDecks';

export default function PresentPage() {
  const [roomId, setRoomId] = useState('DEMO');
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedClients, setConnectedClients] = useState(0);

  // Deck & Slide State
  const [deckId, setDeckId] = useState('futuristic-tech');
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

  // UI HUD State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHUD, setShowHUD] = useState(true);

  const containerRef = useRef(null);

  // Find active deck and slide
  const activeDeck = SAMPLE_DECKS.find(d => d.id === deckId) || SAMPLE_DECKS[0];
  const slide = activeDeck.slides[currentSlide] || activeDeck.slides[0];
  const totalSlides = activeDeck.slides.length;

  useEffect(() => {
    // Read room query param if present
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room') || 'DEMO';
    setRoomId(roomParam.toUpperCase());

    // Initialize Socket.io connection
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

    newSocket.on('slide-updated', (data) => {
      setCurrentSlide(data.currentSlide);
      setIsZoomed(false);
      setZoomCoords({ x: 0, y: 0, width: 100, height: 100 });
    });

    newSocket.on('zoom-updated', (data) => {
      setIsZoomed(data.isZoomed);
      setZoomCoords(data.zoomCoords);
    });

    newSocket.on('zoom-reset', (data) => {
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
      setCurrentSlide(0);
      setIsZoomed(false);
    });

    newSocket.on('confetti-triggered', () => {
      confetti({
        particleCount: 120,
        spread: 80,
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

  // Keyboard navigation fallback on Host screen
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
      } else if (e.key === 'b' || e.key === 'B') {
        toggleBlackout();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide, totalSlides, socket]);

  const nextSlide = () => {
    if (currentSlide < totalSlides - 1) {
      const nextIdx = currentSlide + 1;
      setCurrentSlide(nextIdx);
      if (socket) {
        socket.emit('slide-change', { slideIndex: nextIdx, totalSlides });
      }
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      const prevIdx = currentSlide - 1;
      setCurrentSlide(prevIdx);
      if (socket) {
        socket.emit('slide-change', { slideIndex: prevIdx, totalSlides });
      }
    }
  };

  const resetZoom = () => {
    setIsZoomed(false);
    setZoomCoords({ x: 0, y: 0, width: 100, height: 100 });
    if (socket) socket.emit('reset-zoom');
  };

  const toggleBlackout = () => {
    setBlackout(!blackout);
    if (socket) socket.emit('toggle-blackout');
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => console.log(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(err => console.log(err));
      setIsFullscreen(false);
    }
  };

  // Calculate dynamic transform origin and scale for Smart Zoom
  const calcZoomTransform = () => {
    if (!isZoomed || !zoomCoords) {
      return {
        scale: 1,
        transformOrigin: '50% 50%',
      };
    }
    const { x, y, width, height } = zoomCoords;
    const centerX = Math.min(100, Math.max(0, parseFloat(x) + parseFloat(width) / 2));
    const centerY = Math.min(100, Math.max(0, parseFloat(y) + parseFloat(height) / 2));

    const maxDim = Math.max(parseFloat(width), parseFloat(height));
    const rawScale = maxDim > 0 ? 100 / maxDim : 1;
    const scale = Math.min(6, Math.max(1.2, rawScale));

    return {
      scale,
      transformOrigin: `${centerX}% ${centerY}%`,
    };
  };

  const zoomStyle = calcZoomTransform();

  // Framer Motion transition variants
  const getVariants = () => {
    switch (transitionType) {
      case 'fade':
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 }
        };
      case 'scale':
        return {
          initial: { opacity: 0, scale: 0.85 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 1.15 }
        };
      case 'flip':
        return {
          initial: { opacity: 0, rotateY: 90 },
          animate: { opacity: 1, rotateY: 0 },
          exit: { opacity: 0, rotateY: -90 }
        };
      case 'slide':
      default:
        return {
          initial: { opacity: 0, x: 100 },
          animate: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: -100 }
        };
    }
  };

  // Dynamic CSS filter string
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
      className="relative w-screen h-screen bg-[#080B10] text-white overflow-hidden select-none"
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
            <div className="text-center text-slate-500 font-mono text-sm tracking-widest uppercase">
              [ Presentation Blackout ]
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Presentation View Container with Dynamic CSS Filters & Area Zoom */}
      <div className="w-full h-full relative flex items-center justify-center p-4 md:p-8">
        <motion.div
          className="w-full h-full max-w-7xl max-h-[90vh] relative rounded-3xl overflow-hidden glass-panel border border-white/15 shadow-2xl flex flex-col"
          animate={{
            scale: zoomStyle.scale,
            transformOrigin: zoomStyle.transformOrigin
          }}
          transition={{
            type: 'spring',
            stiffness: 180,
            damping: 24
          }}
          style={{
            filter: cssFilterString,
          }}
        >
          {/* Slide Content Render Engine */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${deckId}-${currentSlide}`}
              variants={getVariants()}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="w-full h-full p-8 md:p-14 flex flex-col justify-between relative overflow-hidden"
            >
              {/* Decorative Glass Background Orbs */}
              <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

              {/* Slide Header */}
              <div className="flex items-center justify-between z-10">
                <div className="flex items-center space-x-3">
                  <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full backdrop-blur-md">
                    {slide.category || 'SLIDE'}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {currentSlide + 1} / {totalSlides}
                  </span>
                </div>
                <div className="text-xs font-medium text-slate-400 tracking-wide font-mono">
                  {activeDeck.title}
                </div>
              </div>

              {/* Slide Body Rendering Based on Slide Type */}
              <div className="my-auto z-10 space-y-6">
                {/* Title Slide */}
                {slide.type === 'title-slide' && (
                  <div className="space-y-6 max-w-4xl">
                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-blue-200 leading-tight">
                      {slide.title}
                    </h1>
                    <p className="text-lg md:text-2xl text-slate-300 font-light leading-relaxed max-w-2xl">
                      {slide.tagline}
                    </p>

                    {slide.metrics && (
                      <div className="grid grid-cols-3 gap-4 pt-6 max-w-xl">
                        {slide.metrics.map((m, idx) => (
                          <div key={idx} className="glass-card p-4 text-center">
                            <div className="text-2xl md:text-3xl font-bold text-blue-400">{m.value}</div>
                            <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-1">{m.label}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Architecture Diagram Slide */}
                {slide.type === 'diagram-slide' && (
                  <div className="space-y-6">
                    <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                      {slide.title}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                      {slide.architectureNodes.map((node, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.15 }}
                          className="glass-card p-6 relative group overflow-hidden border border-white/10"
                        >
                          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${node.color} flex items-center justify-center text-white font-bold text-lg mb-4 shadow-lg`}>
                            0{idx + 1}
                          </div>
                          <h3 className="text-xl font-semibold text-white mb-2">{node.name}</h3>
                          <p className="text-sm text-slate-300 leading-relaxed">{node.desc}</p>
                        </motion.div>
                      ))}
                    </div>

                    {slide.codeSnippet && (
                      <div className="glass-card p-4 rounded-2xl bg-black/40 border border-slate-700/50 font-mono text-xs text-emerald-400 overflow-x-auto">
                        <pre>{slide.codeSnippet}</pre>
                      </div>
                    )}
                  </div>
                )}

                {/* Metrics & Analytics Slide */}
                {slide.type === 'metrics-slide' && (
                  <div className="space-y-6">
                    <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                      {slide.title}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
                      <div className="glass-card p-6 space-y-4">
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Latency Benchmarks</h3>
                        <div className="space-y-4">
                          {slide.bars.map((bar, idx) => (
                            <div key={idx} className="space-y-1">
                              <div className="flex justify-between text-xs font-mono text-slate-300">
                                <span>{bar.name}</span>
                                <span className="font-bold text-white">{bar.latency}</span>
                              </div>
                              <div className="w-full bg-slate-800/80 rounded-full h-3 overflow-hidden p-0.5 border border-white/5">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${bar.pct}%` }}
                                  transition={{ duration: 0.8, delay: idx * 0.2 }}
                                  className={`h-full rounded-full ${bar.color}`}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {slide.stats.map((s, idx) => (
                          <div key={idx} className="glass-card p-5 flex flex-col justify-center items-center text-center">
                            <span className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
                              {s.number}
                            </span>
                            <span className="text-xs text-slate-400 mt-2 font-medium">{s.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Feature Slide */}
                {slide.type === 'feature-slide' && (
                  <div className="space-y-6">
                    <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                      {slide.title}
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                      {slide.cards.map((card, idx) => (
                        <div key={idx} className="glass-card p-5 space-y-3 flex flex-col justify-between">
                          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-white mb-1">{card.title}</h3>
                            <p className="text-xs text-slate-400 leading-normal">{card.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Design Philosophy Slide */}
                {slide.type === 'design-slide' && (
                  <div className="space-y-6">
                    <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                      {slide.title}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      {slide.tokens.map((token, idx) => (
                        <div key={idx} className="glass-card p-5 flex justify-between items-center">
                          <span className="text-sm font-medium text-slate-300">{token.label}</span>
                          <span className="text-xs font-mono px-3 py-1 rounded-lg bg-blue-500/20 border border-blue-400/30 text-blue-300">
                            {token.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Outro Slide */}
                {slide.type === 'outro-slide' && (
                  <div className="text-center space-y-6 my-auto py-8">
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200 }}
                      className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-glow-blue border border-white/30"
                    >
                      <Sparkles className="w-10 h-10 text-white" />
                    </motion.div>
                    <h2 className="text-4xl md:text-5xl font-extrabold text-white">
                      {slide.title}
                    </h2>
                    <p className="text-base md:text-xl text-slate-300 max-w-xl mx-auto font-light">
                      {slide.contact}
                    </p>
                  </div>
                )}
              </div>

              {/* Slide Footer Progress Bar */}
              <div className="z-10 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center space-x-2">
                  <span>Author: {activeDeck.author}</span>
                  {isZoomed && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-mono animate-pulse">
                      ZOOM ACTIVE ({Math.round(zoomStyle.scale * 100)}%)
                    </span>
                  )}
                </div>
                <div className="w-32 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full transition-all duration-300"
                    style={{ width: `${((currentSlide + 1) / totalSlides) * 100}%` }}
                  />
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Spotlight Effect Overlay Mask */}
      {spotlight.active && (
        <div
          className="absolute inset-0 pointer-events-none z-30 transition-all duration-300"
          style={{
            background: `radial-gradient(circle ${spotlight.radius || 180}px at ${spotlight.x}% ${spotlight.y}%, transparent 0%, rgba(0, 0, 0, 0.82) 100%)`,
            backdropFilter: 'blur(6px)',
          }}
        />
      )}

      {/* Real-Time Laser Pointer Dot Overlay */}
      {laser.active && (
        <motion.div
          className="absolute w-6 h-6 rounded-full pointer-events-none z-40 -ml-3 -mt-3 flex items-center justify-center"
          animate={{
            left: `${laser.x}%`,
            top: `${laser.y}%`,
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        >
          <div className="w-4 h-4 bg-red-500 rounded-full shadow-[0_0_15px_#ef4444,0_0_30px_#ef4444] animate-ping opacity-75" />
          <div className="absolute w-3 h-3 bg-red-400 rounded-full border border-white shadow-[0_0_10px_#ef4444]" />
        </motion.div>
      )}

      {/* Top Floating Glass HUD */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 flex items-center space-x-3">
        <div className="glass-dock px-4 py-2 flex items-center space-x-4 text-xs font-mono">
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <span className="flex items-center text-emerald-400">
                <Wifi className="w-3.5 h-3.5 mr-1 animate-pulse" />
                ROOM: <strong className="text-white font-bold ml-1">{roomId}</strong>
              </span>
            ) : (
              <span className="flex items-center text-rose-400">
                <WifiOff className="w-3.5 h-3.5 mr-1" />
                DISCONNECTED
              </span>
            )}
          </div>

          <div className="h-4 w-px bg-white/20" />

          <div className="flex items-center space-x-1 text-slate-300">
            <Smartphone className="w-3.5 h-3.5 text-blue-400" />
            <span>Remotes: <strong className="text-white">{connectedClients > 0 ? connectedClients - 1 : 0}</strong></span>
          </div>

          <div className="h-4 w-px bg-white/20" />

          <button
            onClick={toggleFullscreen}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors text-slate-300"
            title="Toggle Fullscreen (F)"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
