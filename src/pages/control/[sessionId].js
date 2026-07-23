import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  RotateCcw,
  Sliders,
  MousePointer,
  FileText,
  Clock,
  Sparkles,
  Power,
  Sun,
  Moon,
  Eye,
  Loader2,
  StopCircle,
  ArrowLeft,
} from 'lucide-react';

export default function ControlPage() {
  const router = useRouter();
  const { sessionId } = router.query;

  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionActive, setSessionActive] = useState(true);
  const [sessionError, setSessionError] = useState(null);

  // Session state
  const [deckId, setDeckId] = useState(null);
  const [deckTitle, setDeckTitle] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [totalSlides, setTotalSlides] = useState(1);
  const [isZoomed, setIsZoomed] = useState(false);
  const [notes, setNotes] = useState([]);

  // Instant Slide Cache URLs
  const [cachedSlides, setCachedSlides] = useState([]);

  // Active tab: 'nav' | 'zoom' | 'effects' | 'laser' | 'notes'
  const [activeTab, setActiveTab] = useState('nav');

  // Filters
  const [filters, setFilters] = useState({ blur: 0, grayscale: false, invert: false, sepia: false, contrast: 100, brightness: 100 });
  const [spotlightActive, setSpotlightActive] = useState(false);
  const [blackoutActive, setBlackoutActive] = useState(false);

  // Zoom selection (16:9 Aspect Ratio Enforced)
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectionBox, setSelectionBox] = useState(null);
  const zoomCanvasRef = useRef(null);

  // Laser
  const laserTrackpadRef = useRef(null);

  // Timer
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const triggerHaptic = () => {
    if (typeof window !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(15); } catch (e) {}
    }
  };

  // INSTANT PARALLEL SLIDE IMAGE PRELOADING FOR MOBILE
  useEffect(() => {
    if (!deckId || !totalSlides) return;

    const urls = Array.from({ length: totalSlides }, (_, i) => `/api/slides/${deckId}/${i}`);
    setCachedSlides(urls);

    // Preload into browser image cache in parallel
    urls.forEach((url) => {
      const img = new Image();
      img.src = url;
    });
  }, [deckId, totalSlides]);

  // ── Socket Connection ──
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
      setFilters(state.filters);
      setSpotlightActive(state.spotlight?.active || false);
      setBlackoutActive(state.blackout || false);
      setNotes(state.notes || []);
      setSessionActive(true);
    });

    newSocket.on('session-error', (data) => {
      setSessionError(data.error);
      setSessionActive(false);
    });

    newSocket.on('slide-updated', (data) => {
      setCurrentSlide(data.currentSlide);
      setTotalSlides(data.totalSlides);
      setIsZoomed(false);
      setSelectionBox(null);
    });

    newSocket.on('zoom-updated', (data) => setIsZoomed(data.isZoomed));

    newSocket.on('zoom-reset', () => {
      setIsZoomed(false);
      setSelectionBox(null);
      setSpotlightActive(false);
    });

    newSocket.on('filter-updated', (data) => setFilters(data.filters));
    newSocket.on('blackout-updated', (data) => setBlackoutActive(data.blackout));

    newSocket.on('session-ended', () => {
      setSessionActive(false);
    });

    return () => newSocket.disconnect();
  }, [sessionId]);

  // Timer
  useEffect(() => {
    let interval = null;
    if (isTimerRunning) interval = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // ── Slide Controls ──
  const handlePrev = () => {
    triggerHaptic();
    if (currentSlide > 0) {
      const idx = currentSlide - 1;
      setCurrentSlide(idx);
      if (socket) socket.emit('slide-change', { slideIndex: idx });
    }
  };

  const handleNext = () => {
    triggerHaptic();
    if (currentSlide < totalSlides - 1) {
      const idx = currentSlide + 1;
      setCurrentSlide(idx);
      if (socket) socket.emit('slide-change', { slideIndex: idx });
    }
  };

  const handleReset = () => {
    triggerHaptic();
    setIsZoomed(false);
    setSelectionBox(null);
    setSpotlightActive(false);
    if (socket) { socket.emit('reset-zoom'); socket.emit('reset-filters'); }
  };

  // ── PERFECT 16:9 RECTANGULAR ENFORCED DRAG-TO-ZOOM SELECTION ──
  const getCanvasCoords = (e) => {
    if (!zoomCanvasRef.current) return { pctX: 0, pctY: 0 };
    const rect = zoomCanvasRef.current.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      pctX: Math.min(100, Math.max(0, ((cx - rect.left) / rect.width) * 100)),
      pctY: Math.min(100, Math.max(0, ((cy - rect.top) / rect.height) * 100)),
    };
  };

  const onZoomStart = (e) => {
    triggerHaptic();
    const c = getCanvasCoords(e);
    setIsDrawing(true);
    const w = 16;
    const h = w / (16 / 9); // 16:9 Aspect Ratio
    setSelectionBox({
      startX: c.pctX,
      startY: c.pctY,
      width: w,
      height: h,
    });
  };

  const onZoomMove = (e) => {
    if (!isDrawing) return;
    const c = getCanvasCoords(e);
    setSelectionBox(prev => {
      if (!prev) return null;
      const rawW = Math.abs(c.pctX - prev.startX);
      const width = Math.max(10, rawW);
      const height = width / (16 / 9); // 16:9 Presentation Ratio

      const startX = c.pctX < prev.startX ? c.pctX : prev.startX;
      const startY = c.pctY < prev.startY ? Math.max(0, prev.startY - height) : prev.startY;

      return { startX, startY, width, height };
    });
  };

  const onZoomEnd = () => {
    if (!isDrawing || !selectionBox) return;
    setIsDrawing(false);
    triggerHaptic();

    const zoomCoords = {
      x: selectionBox.startX,
      y: selectionBox.startY,
      width: selectionBox.width,
      height: selectionBox.height,
    };

    setIsZoomed(true);
    if (socket) socket.emit('zoom-area', zoomCoords);
  };

  // ── Laser ──
  const onLaserMove = (e) => {
    if (!laserTrackpadRef.current) return;
    const rect = laserTrackpadRef.current.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    const pctX = Math.min(100, Math.max(0, ((cx - rect.left) / rect.width) * 100));
    const pctY = Math.min(100, Math.max(0, ((cy - rect.top) / rect.height) * 100));
    if (socket) socket.emit('laser-move', { active: true, x: pctX, y: pctY });
  };

  const onLaserEnd = () => {
    if (socket) socket.emit('laser-move', { active: false, x: 50, y: 50 });
  };

  // ── Confetti ──
  const triggerConfetti = () => {
    triggerHaptic();
    if (socket) socket.emit('trigger-confetti');
  };

  // Slide image source
  const slideImgSrc = cachedSlides[currentSlide] || (deckId ? `/api/slides/${deckId}/${currentSlide}` : null);
  const currentNote = notes[currentSlide] || '';

  // ── Error / Ended States ──
  if (sessionError || !sessionActive) {
    return (
      <div className="fixed inset-0 h-[100dvh] bg-[var(--dc-bg)] flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-xs">
          <StopCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h1 className="text-lg font-bold">Session Ended</h1>
          <p className="text-sm text-[var(--dc-text-secondary)]">
            {sessionError || 'This presentation session has been closed by the host.'}
          </p>
          <button onClick={() => router.push('/')} className="dc-btn dc-btn-primary text-sm py-2.5 w-full">
            <ArrowLeft className="w-4 h-4" />
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!deckId) {
    return (
      <div className="fixed inset-0 h-[100dvh] bg-[var(--dc-bg)] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-7 h-7 text-[var(--dc-blue)] animate-spin mx-auto" />
          <p className="text-sm text-[var(--dc-text-secondary)]">Joining session <span className="font-mono font-bold">{sessionId}</span>...</p>
        </div>
      </div>
    );
  }

  // ── TAB CONTENT ──
  const renderTab = () => {
    switch (activeTab) {
      case 'nav':
        return (
          <motion.div key="nav" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col justify-between gap-3 py-2">
            {/* Slide info */}
            <div className="dc-card p-3 text-center space-y-0.5">
              <div className="text-xs font-mono text-[var(--dc-text-secondary)]">
                {currentSlide + 1} / {totalSlides} — <span className="text-[var(--dc-blue)] font-semibold truncate">{deckTitle}</span>
              </div>
              {isZoomed && (
                <div className="dc-badge dc-badge-live text-[10px] mx-auto">Zoom Active</div>
              )}
            </div>

            {/* Prev / Next */}
            <div className="grid grid-cols-2 gap-3 flex-1 max-h-[50vh]">
              <button onClick={handlePrev} disabled={currentSlide === 0}
                className={`dc-card flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform ${currentSlide === 0 ? 'opacity-30' : ''}`}>
                <ChevronLeft className="w-10 h-10 text-[var(--dc-blue)]" />
                <span className="text-xs font-bold uppercase tracking-wider">Prev</span>
              </button>
              <button onClick={handleNext} disabled={currentSlide >= totalSlides - 1}
                className={`flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform rounded-[14px] ${currentSlide >= totalSlides - 1 ? 'opacity-30 bg-blue-500/40' : 'bg-[var(--dc-blue)]'} text-white shadow-lg shadow-blue-500/20`}>
                <ChevronRight className="w-10 h-10" />
                <span className="text-xs font-bold uppercase tracking-wider">Next</span>
              </button>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleReset} className="dc-btn dc-btn-secondary text-xs py-2.5 w-full">
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
              <button onClick={triggerConfetti} className="dc-btn dc-btn-secondary text-xs py-2.5 w-full">
                <Sparkles className="w-3.5 h-3.5 text-purple-500" /> Confetti
              </button>
            </div>
          </motion.div>
        );

      case 'zoom':
        return (
          <motion.div key="zoom" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col justify-between gap-3 py-2">
            <div className="text-center">
              <h3 className="text-sm font-bold flex items-center justify-center gap-1.5">
                <ZoomIn className="w-4 h-4 text-[var(--dc-blue)]" /> 16:9 Smart Drag-to-Zoom
              </h3>
              <p className="text-[11px] text-[var(--dc-text-secondary)]">Draw a 16:9 box on the live slide image below</p>
            </div>

            <div ref={zoomCanvasRef}
              onTouchStart={onZoomStart} onTouchMove={onZoomMove} onTouchEnd={onZoomEnd}
              onMouseDown={onZoomStart} onMouseMove={onZoomMove} onMouseUp={onZoomEnd}
              className="relative w-full aspect-[16/9] bg-black rounded-2xl border border-[var(--dc-border)] shadow-lg overflow-hidden select-none flex items-center justify-center my-auto touch-none">
              {slideImgSrc && <img src={slideImgSrc} alt="Current slide" className="w-full h-full object-contain pointer-events-none" />}
              {selectionBox && (
                <div className="absolute border-2 border-[var(--dc-blue)] bg-blue-500/20 rounded-lg dc-zoom-selection pointer-events-none"
                  style={{
                    left: `${selectionBox.startX}%`,
                    top: `${selectionBox.startY}%`,
                    width: `${selectionBox.width}%`,
                    height: `${selectionBox.height}%`,
                  }}
                >
                  <span className="absolute -top-3.5 left-0 text-[8px] bg-[var(--dc-blue)] text-white px-1 rounded font-mono font-bold">
                    16:9 Target
                  </span>
                </div>
              )}
            </div>

            <button onClick={handleReset} className="dc-btn dc-btn-danger w-full text-xs py-2.5">
              <RotateCcw className="w-3.5 h-3.5" /> Reset Zoom
            </button>
          </motion.div>
        );

      case 'effects':
        return (
          <motion.div key="effects" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col justify-between gap-3 py-2">
            <h3 className="text-sm font-bold text-center flex items-center justify-center gap-1.5">
              <Sliders className="w-4 h-4 text-purple-500" /> Visual Effects
            </h3>

            <div className="dc-card p-4 space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span>Blur</span>
                  <span className="font-mono text-purple-600">{filters.blur}px</span>
                </div>
                <input type="range" min="0" max="15" value={filters.blur}
                  onChange={(e) => {
                    const u = { ...filters, blur: parseInt(e.target.value, 10) };
                    setFilters(u);
                    if (socket) socket.emit('apply-filter', u);
                  }}
                  className="w-full accent-purple-600 cursor-pointer" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'grayscale', label: 'Grayscale', icon: <Moon className="w-3.5 h-3.5" />, color: 'purple' },
                  { key: 'invert', label: 'Invert', icon: <Sun className="w-3.5 h-3.5" />, color: 'amber' },
                ].map(({ key, label, icon, color }) => (
                  <button key={key} onClick={() => {
                    const u = { ...filters, [key]: !filters[key] };
                    setFilters(u);
                    if (socket) socket.emit('apply-filter', u);
                  }}
                    className={`dc-btn dc-btn-secondary text-xs justify-between w-full ${filters[key] ? `ring-2 ring-${color}-500/30 bg-${color}-500/10` : ''}`}>
                    <span>{label}</span> {icon}
                  </button>
                ))}
                <button onClick={() => {
                  const next = !spotlightActive;
                  setSpotlightActive(next);
                  if (socket) socket.emit('toggle-spotlight', { active: next, x: 50, y: 50, radius: 160 });
                }}
                  className={`dc-btn dc-btn-secondary text-xs justify-between w-full ${spotlightActive ? 'ring-2 ring-blue-500/30 bg-blue-500/10' : ''}`}>
                  <span>Spotlight</span> <Eye className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => {
                  setBlackoutActive(!blackoutActive);
                  if (socket) socket.emit('toggle-blackout');
                }}
                  className={`dc-btn dc-btn-secondary text-xs justify-between w-full ${blackoutActive ? 'ring-2 ring-red-500/30 bg-red-500/10' : ''}`}>
                  <span>Blackout</span> <Power className="w-3.5 h-3.5 text-red-500" />
                </button>
              </div>
            </div>

            <button onClick={handleReset} className="dc-btn dc-btn-secondary w-full text-xs py-2.5">
              <RotateCcw className="w-3.5 h-3.5" /> Reset Effects
            </button>
          </motion.div>
        );

      case 'laser':
        return (
          <motion.div key="laser" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col justify-between gap-3 py-2">
            <h3 className="text-sm font-bold text-center flex items-center justify-center gap-1.5">
              <MousePointer className="w-4 h-4 text-red-500" /> Laser Pointer
            </h3>

            <div ref={laserTrackpadRef}
              onTouchMove={onLaserMove} onTouchEnd={onLaserEnd}
              onMouseMove={onLaserMove} onMouseLeave={onLaserEnd}
              className="w-full aspect-[16/9] dc-card bg-slate-50 border-2 border-red-500/20 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden shadow-inner my-auto touch-none">
              <div className="w-8 h-8 rounded-full bg-red-500/15 border border-red-500/40 flex items-center justify-center animate-ping" />
              <span className="text-[11px] font-mono text-red-500 mt-2 tracking-wider uppercase font-semibold">
                Drag to aim
              </span>
            </div>
          </motion.div>
        );

      case 'notes':
        return (
          <motion.div key="notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col justify-between gap-3 py-2">
            <h3 className="text-sm font-bold text-center flex items-center justify-center gap-1.5">
              <FileText className="w-4 h-4 text-green-600" /> Speaker Notes
            </h3>

            <div className="dc-card p-4 flex-1 overflow-y-auto max-h-[50vh] space-y-2">
              <div className="text-[10px] font-mono font-bold text-green-600 uppercase tracking-wider">
                Slide {currentSlide + 1}
              </div>
              <p className="text-sm text-[var(--dc-text)] leading-relaxed">
                {currentNote || 'No speaker notes for this slide.'}
              </p>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  const tabs = [
    { id: 'nav', icon: <ChevronRight className="w-4 h-4" />, label: 'Control' },
    { id: 'zoom', icon: <ZoomIn className="w-4 h-4" />, label: 'Zoom' },
    { id: 'effects', icon: <Sliders className="w-4 h-4" />, label: 'Effects' },
    { id: 'laser', icon: <MousePointer className="w-4 h-4" />, label: 'Laser' },
    { id: 'notes', icon: <FileText className="w-4 h-4" />, label: 'Notes' },
  ];

  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-[var(--dc-bg)] text-[var(--dc-text)] flex flex-col overflow-hidden select-none">
      {/* Header */}
      <div className="dc-panel rounded-none px-4 py-2 flex items-center justify-between z-30 flex-shrink-0 border-b border-[var(--dc-border)]">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs font-mono font-bold tracking-wider text-[var(--dc-blue)]">
            {sessionId}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setIsTimerRunning(!isTimerRunning)}
            className="dc-btn dc-btn-secondary text-[11px] py-1 px-2 gap-1">
            <Clock className="w-3 h-3" />
            {formatTime(timerSeconds)}
          </button>

          <button onClick={handleReset} className="dc-btn dc-btn-danger text-[11px] py-1 px-2 gap-1">
            <RotateCcw className="w-3 h-3" /> ESC
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 relative overflow-hidden px-3 flex flex-col max-w-md mx-auto w-full">
        <AnimatePresence mode="wait">
          {renderTab()}
        </AnimatePresence>
      </div>

      {/* Bottom Dock */}
      <div className="px-3 pb-4 pt-2 z-30 flex-shrink-0 dc-safe-bottom">
        <div className="dc-dock max-w-md mx-auto px-2 py-1.5 flex justify-around items-center">
          {tabs.map(tab => (
            <button key={tab.id}
              onClick={() => { triggerHaptic(); setActiveTab(tab.id); }}
              className={`p-2 rounded-2xl flex flex-col items-center text-[9px] gap-0.5 transition-all active:scale-95 min-w-[48px]
                ${activeTab === tab.id
                  ? 'bg-[var(--dc-blue)]/10 text-[var(--dc-blue)] font-bold'
                  : 'text-[var(--dc-text-secondary)]'}`}>
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
