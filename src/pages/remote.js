import React, { useState, useEffect, useRef } from 'react';
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
  Zap,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Layers,
  Power,
  X
} from 'lucide-react';
import { SAMPLE_DECKS } from '../data/sampleDecks';

export default function RemotePage() {
  const [roomId, setRoomId] = useState('DEMO');
  const [inputRoom, setInputRoom] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [socket, setSocket] = useState(null);

  // Deck & Slide Sync
  const [deckId, setDeckId] = useState('futuristic-tech');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [totalSlides, setTotalSlides] = useState(6);
  const [isZoomed, setIsZoomed] = useState(false);

  // Active Controller Tab: 'nav' | 'zoom' | 'effects' | 'laser' | 'notes'
  const [activeTab, setActiveTab] = useState('nav');

  // Filters State
  const [filters, setFilters] = useState({
    blur: 0,
    grayscale: false,
    invert: false,
    sepia: false,
    contrast: 100,
    brightness: 100,
  });

  const [spotlightActive, setSpotlightActive] = useState(false);
  const [blackoutActive, setBlackoutActive] = useState(false);

  // Smart Zoom Selection State
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectionBox, setSelectionBox] = useState(null); // { startX, startY, endX, endY }
  const zoomCanvasRef = useRef(null);

  // Laser Pointer State
  const laserTrackpadRef = useRef(null);
  const [laserActive, setLaserActive] = useState(false);

  // Presentation Timer
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const activeDeck = SAMPLE_DECKS.find(d => d.id === deckId) || SAMPLE_DECKS[0];
  const slide = activeDeck.slides[currentSlide] || activeDeck.slides[0];

  useEffect(() => {
    // Read URL param
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room') || 'DEMO';
    setRoomId(roomParam.toUpperCase());
    setInputRoom(roomParam.toUpperCase());

    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join-room', { roomId: roomParam, role: 'remote' });
      setIsJoined(true);
    });

    newSocket.on('room-state', (state) => {
      if (state.currentSlide !== undefined) setCurrentSlide(state.currentSlide);
      if (state.totalSlides) setTotalSlides(state.totalSlides);
      if (state.deckId) setDeckId(state.deckId);
      if (state.isZoomed !== undefined) setIsZoomed(state.isZoomed);
      if (state.filters) setFilters(state.filters);
      if (state.spotlight) setSpotlightActive(state.spotlight.active);
      if (state.blackout !== undefined) setBlackoutActive(state.blackout);
    });

    newSocket.on('slide-updated', (data) => {
      setCurrentSlide(data.currentSlide);
      if (data.totalSlides) setTotalSlides(data.totalSlides);
      setIsZoomed(false);
      setSelectionBox(null);
    });

    newSocket.on('zoom-updated', (data) => {
      setIsZoomed(data.isZoomed);
    });

    newSocket.on('zoom-reset', () => {
      setIsZoomed(false);
      setSelectionBox(null);
      setSpotlightActive(false);
    });

    newSocket.on('filter-updated', (data) => {
      setFilters(data.filters);
    });

    newSocket.on('blackout-updated', (data) => {
      setBlackoutActive(data.blackout);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Timer Effect
  useEffect(() => {
    let interval = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(sec => sec + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Haptic feedback trigger helper
  const triggerHaptic = () => {
    if (navigator.vibrate) {
      try {
        navigator.vibrate(25);
      } catch (e) {}
    }
  };

  const handlePrev = () => {
    triggerHaptic();
    if (currentSlide > 0) {
      const prevIdx = currentSlide - 1;
      setCurrentSlide(prevIdx);
      if (socket) socket.emit('slide-change', { slideIndex: prevIdx, totalSlides });
    }
  };

  const handleNext = () => {
    triggerHaptic();
    if (currentSlide < totalSlides - 1) {
      const nextIdx = currentSlide + 1;
      setCurrentSlide(nextIdx);
      if (socket) socket.emit('slide-change', { slideIndex: nextIdx, totalSlides });
    }
  };

  const handleEscReset = () => {
    triggerHaptic();
    setIsZoomed(false);
    setSelectionBox(null);
    setSpotlightActive(false);
    if (socket) {
      socket.emit('reset-zoom');
      socket.emit('reset-filters');
    }
  };

  // Smart Zoom Selection Drag logic
  const getCanvasCoords = (e) => {
    if (!zoomCanvasRef.current) return { x: 0, y: 0 };
    const rect = zoomCanvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = Math.min(rect.width, Math.max(0, clientX - rect.left));
    const y = Math.min(rect.height, Math.max(0, clientY - rect.top));

    return {
      px: x,
      py: y,
      pctX: (x / rect.width) * 100,
      pctY: (y / rect.height) * 100,
      width: rect.width,
      height: rect.height,
    };
  };

  const handleTouchStartZoom = (e) => {
    e.preventDefault();
    triggerHaptic();
    const coords = getCanvasCoords(e);
    setIsDrawing(true);
    setSelectionBox({
      startX: coords.pctX,
      startY: coords.pctY,
      endX: coords.pctX + 1,
      endY: coords.pctY + 1,
    });
  };

  const handleTouchMoveZoom = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const coords = getCanvasCoords(e);
    setSelectionBox(prev => prev ? ({
      ...prev,
      endX: coords.pctX,
      endY: coords.pctY,
    }) : null);
  };

  const handleTouchEndZoom = () => {
    if (!isDrawing || !selectionBox) return;
    setIsDrawing(false);
    triggerHaptic();

    const minX = Math.min(selectionBox.startX, selectionBox.endX);
    const maxX = Math.max(selectionBox.startX, selectionBox.endX);
    const minY = Math.min(selectionBox.startY, selectionBox.endY);
    const maxY = Math.max(selectionBox.startY, selectionBox.endY);

    const width = Math.max(10, maxX - minX);
    const height = Math.max(10, maxY - minY);

    const zoomCoords = {
      x: minX,
      y: minY,
      width,
      height,
    };

    setIsZoomed(true);
    if (socket) {
      socket.emit('zoom-area', zoomCoords);
    }
  };

  // Filter handlers
  const handleFilterToggle = (filterName) => {
    triggerHaptic();
    const updated = { ...filters, [filterName]: !filters[filterName] };
    setFilters(updated);
    if (socket) socket.emit('apply-filter', updated);
  };

  const handleBlurChange = (e) => {
    const val = parseInt(e.target.value, 10);
    const updated = { ...filters, blur: val };
    setFilters(updated);
    if (socket) socket.emit('apply-filter', updated);
  };

  const handleToggleSpotlight = () => {
    triggerHaptic();
    const nextSpotlight = !spotlightActive;
    setSpotlightActive(nextSpotlight);
    if (socket) {
      socket.emit('toggle-spotlight', {
        active: nextSpotlight,
        x: selectionBox ? (selectionBox.startX + selectionBox.endX) / 2 : 50,
        y: selectionBox ? (selectionBox.startY + selectionBox.endY) / 2 : 50,
        radius: 160
      });
    }
  };

  const handleToggleBlackout = () => {
    triggerHaptic();
    const nextBlackout = !blackoutActive;
    setBlackoutActive(nextBlackout);
    if (socket) socket.emit('toggle-blackout');
  };

  // Laser Pointer Trackpad Touch Handlers
  const handleLaserTouchMove = (e) => {
    if (!laserTrackpadRef.current) return;
    const rect = laserTrackpadRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const pctX = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const pctY = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));

    if (socket) {
      socket.emit('laser-move', { active: true, x: pctX, y: pctY });
    }
  };

  const handleLaserTouchEnd = () => {
    if (socket) {
      socket.emit('laser-move', { active: false, x: 50, y: 50 });
    }
  };

  const triggerConfetti = () => {
    triggerHaptic();
    if (socket) socket.emit('trigger-confetti');
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (inputRoom.trim() && socket) {
      const room = inputRoom.toUpperCase().trim();
      setRoomId(room);
      socket.emit('join-room', { roomId: room, role: 'remote' });
      setIsJoined(true);
    }
  };

  return (
    <div className="w-screen h-screen bg-[#090C12] text-white flex flex-col justify-between overflow-hidden select-none touch-none">
      {/* Top Header Bar */}
      <div className="glass-panel px-5 py-3 flex items-center justify-between z-30 border-b border-white/10">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-mono font-bold tracking-wider text-slate-200">
            ROOM: {roomId}
          </span>
        </div>

        {/* Presentation Timer & ESC Button */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsTimerRunning(!isTimerRunning)}
            className="flex items-center space-x-1 text-xs font-mono px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-slate-300"
          >
            <Clock className="w-3 h-3 text-blue-400" />
            <span>{formatTime(timerSeconds)}</span>
          </button>

          {/* Quick ESC Reset Button */}
          <button
            onClick={handleEscReset}
            className="glass-button-danger px-3 py-1.5 text-xs font-extrabold tracking-wider flex items-center space-x-1"
            title="Reset Zoom & Filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>ESC</span>
          </button>
        </div>
      </div>

      {/* Main Tab View Container */}
      <div className="flex-1 relative overflow-hidden p-4 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {/* TAB 1: Main Tactile Navigation View */}
          {activeTab === 'nav' && (
            <motion.div
              key="nav-tab"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm mx-auto h-full flex flex-col justify-between space-y-4"
            >
              {/* Slide Counter & Preview Card */}
              <div className="glass-card p-4 text-center space-y-2 border border-white/15">
                <div className="flex justify-between items-center text-xs text-slate-400 font-mono">
                  <span>SLIDE {currentSlide + 1} OF {totalSlides}</span>
                  <span className="text-blue-400 font-medium">{activeDeck.title}</span>
                </div>
                <div className="text-lg font-bold text-white truncate">
                  {slide.title}
                </div>
                {isZoomed && (
                  <div className="text-xs font-mono text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full inline-block">
                    ● Dynamic Zoom Active
                  </div>
                )}
              </div>

              {/* Large Tactile Navigation Buttons */}
              <div className="grid grid-cols-2 gap-4 my-auto">
                <button
                  onClick={handlePrev}
                  disabled={currentSlide === 0}
                  className={`h-44 glass-button flex flex-col items-center justify-center space-y-2 text-white border-2 border-white/20 shadow-glass-lg ${currentSlide === 0 ? 'opacity-40 pointer-events-none' : 'hover:border-blue-400/50'}`}
                >
                  <ChevronLeft className="w-12 h-12 text-blue-400" />
                  <span className="text-sm font-bold uppercase tracking-wider">PREV</span>
                </button>

                <button
                  onClick={handleNext}
                  disabled={currentSlide === totalSlides - 1}
                  className={`h-44 glass-button-primary flex flex-col items-center justify-center space-y-2 text-white border-2 border-white/30 shadow-glow-blue ${currentSlide === totalSlides - 1 ? 'opacity-40 pointer-events-none' : ''}`}
                >
                  <ChevronRight className="w-12 h-12 text-white" />
                  <span className="text-sm font-bold uppercase tracking-wider">NEXT</span>
                </button>
              </div>

              {/* Quick Action Shortcuts */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={handleToggleBlackout}
                  className={`glass-button p-3 flex flex-col items-center text-xs space-y-1 ${blackoutActive ? 'bg-rose-500/30 border-rose-400' : ''}`}
                >
                  <Power className="w-5 h-5 text-amber-400" />
                  <span>{blackoutActive ? 'ON' : 'Blank'}</span>
                </button>

                <button
                  onClick={() => setActiveTab('zoom')}
                  className="glass-button p-3 flex flex-col items-center text-xs space-y-1"
                >
                  <ZoomIn className="w-5 h-5 text-blue-400" />
                  <span>Zoom Box</span>
                </button>

                <button
                  onClick={triggerConfetti}
                  className="glass-button p-3 flex flex-col items-center text-xs space-y-1"
                >
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <span>Confetti</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* TAB 2: Smart Zoom Canvas Bounding Box Selection */}
          {activeTab === 'zoom' && (
            <motion.div
              key="zoom-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full max-w-sm mx-auto h-full flex flex-col justify-between space-y-4"
            >
              <div className="text-center">
                <h3 className="text-base font-bold text-white flex items-center justify-center space-x-2">
                  <ZoomIn className="w-5 h-5 text-blue-400" />
                  <span>Smart Drag-to-Zoom</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Draw a rectangle on the slide preview to focus host view
                </p>
              </div>

              {/* Interactive Mirrored Slide Thumbnail Canvas */}
              <div
                ref={zoomCanvasRef}
                onTouchStart={handleTouchStartZoom}
                onTouchMove={handleTouchMoveZoom}
                onTouchEnd={handleTouchEndZoom}
                onMouseDown={handleTouchStartZoom}
                onMouseMove={handleTouchMoveZoom}
                onMouseUp={handleTouchEndZoom}
                className="relative w-full aspect-[16/10] bg-slate-900 rounded-2xl border-2 border-white/20 overflow-hidden shadow-2xl touch-none select-none flex flex-col justify-between p-4"
              >
                {/* Mirrored Mini Slide Preview Content */}
                <div className="text-[10px] text-blue-400 font-mono uppercase tracking-wider">{slide.category || 'PREVIEW'}</div>
                <div className="my-auto space-y-1">
                  <div className="text-sm font-bold text-white leading-tight">{slide.title}</div>
                  <div className="text-[11px] text-slate-400 line-clamp-2">{slide.tagline || slide.notes}</div>
                </div>
                <div className="text-[9px] text-slate-500 font-mono">Slide {currentSlide + 1} / {totalSlides}</div>

                {/* Drawn Bounding Box Highlight Overlay */}
                {selectionBox && (
                  <div
                    className="absolute border-2 border-cyan-400 bg-cyan-400/25 rounded-lg bounding-box-active pointer-events-none"
                    style={{
                      left: `${Math.min(selectionBox.startX, selectionBox.endX)}%`,
                      top: `${Math.min(selectionBox.startY, selectionBox.endY)}%`,
                      width: `${Math.abs(selectionBox.endX - selectionBox.startX)}%`,
                      height: `${Math.abs(selectionBox.endY - selectionBox.startY)}%`,
                    }}
                  >
                    <span className="absolute -top-5 left-0 text-[9px] bg-cyan-500 text-black px-1 rounded font-mono font-bold">
                      Target Area
                    </span>
                  </div>
                )}
              </div>

              {/* Zoom Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={handleEscReset}
                  className="flex-1 glass-button-danger p-3 text-xs font-bold flex items-center justify-center space-x-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset Zoom (ESC)</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* TAB 3: Real-time CSS Effects & Filters Menu */}
          {activeTab === 'effects' && (
            <motion.div
              key="effects-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full max-w-sm mx-auto h-full flex flex-col justify-between space-y-4"
            >
              <div className="text-center">
                <h3 className="text-base font-bold text-white flex items-center justify-center space-x-2">
                  <Sliders className="w-5 h-5 text-purple-400" />
                  <span>Real-Time Host Effects</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Apply live CSS visual filters to host screen</p>
              </div>

              <div className="glass-card p-4 space-y-4 border border-white/15">
                {/* Dynamic Blur Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-300 font-medium">
                    <span>Dynamic Blur</span>
                    <span className="font-mono text-purple-400">{filters.blur}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="15"
                    value={filters.blur}
                    onChange={handleBlurChange}
                    className="w-full accent-purple-500 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Filter Toggles */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => handleFilterToggle('grayscale')}
                    className={`glass-button p-3 text-xs font-medium flex items-center justify-between ${filters.grayscale ? 'bg-purple-500/30 border-purple-400' : ''}`}
                  >
                    <span>Grayscale</span>
                    <Moon className="w-4 h-4 text-purple-300" />
                  </button>

                  <button
                    onClick={() => handleFilterToggle('invert')}
                    className={`glass-button p-3 text-xs font-medium flex items-center justify-between ${filters.invert ? 'bg-purple-500/30 border-purple-400' : ''}`}
                  >
                    <span>Invert</span>
                    <Sun className="w-4 h-4 text-amber-300" />
                  </button>

                  <button
                    onClick={() => handleFilterToggle('sepia')}
                    className={`glass-button p-3 text-xs font-medium flex items-center justify-between ${filters.sepia ? 'bg-purple-500/30 border-purple-400' : ''}`}
                  >
                    <span>Sepia Warm</span>
                    <Zap className="w-4 h-4 text-orange-400" />
                  </button>

                  <button
                    onClick={handleToggleSpotlight}
                    className={`glass-button p-3 text-xs font-medium flex items-center justify-between ${spotlightActive ? 'bg-blue-500/40 border-blue-400' : ''}`}
                  >
                    <span>Spotlight Focus</span>
                    <Eye className="w-4 h-4 text-blue-400" />
                  </button>
                </div>
              </div>

              <button
                onClick={handleEscReset}
                className="w-full glass-button p-3 text-xs font-bold text-slate-300 flex items-center justify-center space-x-2"
              >
                <RotateCcw className="w-4 h-4 text-rose-400" />
                <span>Reset All Filters</span>
              </button>
            </motion.div>
          )}

          {/* TAB 4: Laser Pointer Trackpad */}
          {activeTab === 'laser' && (
            <motion.div
              key="laser-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full max-w-sm mx-auto h-full flex flex-col justify-between space-y-4"
            >
              <div className="text-center">
                <h3 className="text-base font-bold text-white flex items-center justify-center space-x-2">
                  <MousePointer className="w-5 h-5 text-red-400" />
                  <span>Laser Pointer Trackpad</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Drag finger on trackpad to guide red laser dot</p>
              </div>

              {/* Touch Trackpad Surface */}
              <div
                ref={laserTrackpadRef}
                onTouchMove={handleLaserTouchMove}
                onTouchEnd={handleLaserTouchEnd}
                onMouseMove={handleLaserTouchMove}
                onMouseLeave={handleLaserTouchEnd}
                className="w-full aspect-[4/3] glass-card bg-slate-900/90 border-2 border-red-500/30 rounded-2xl flex flex-col items-center justify-center relative touch-none select-none overflow-hidden"
              >
                <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center animate-ping" />
                <span className="text-xs font-mono text-red-400 mt-4 tracking-wider uppercase">
                  [ TOUCH TRACKPAD SURFACE ]
                </span>
              </div>
            </motion.div>
          )}

          {/* TAB 5: Speaker Notes & Decks */}
          {activeTab === 'notes' && (
            <motion.div
              key="notes-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full max-w-sm mx-auto h-full flex flex-col justify-between space-y-4"
            >
              <div className="text-center">
                <h3 className="text-base font-bold text-white flex items-center justify-center space-x-2">
                  <FileText className="w-5 h-5 text-emerald-400" />
                  <span>Speaker Notes</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Confidential presenter guidance</p>
              </div>

              <div className="glass-card p-4 space-y-3 flex-1 overflow-y-auto max-h-[45vh] border border-white/15">
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono">
                  Slide {currentSlide + 1} Notes:
                </div>
                <p className="text-sm text-slate-200 leading-relaxed font-light">
                  {slide.notes || 'No confidential speaker notes recorded for this slide.'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom iOS Liquid Glass Floating Dock Navigation Bar */}
      <div className="p-4 z-30">
        <div className="glass-dock max-w-sm mx-auto p-2 flex justify-around items-center">
          <button
            onClick={() => { triggerHaptic(); setActiveTab('nav'); }}
            className={`p-3 rounded-2xl flex flex-col items-center text-[10px] space-y-1 transition-all ${activeTab === 'nav' ? 'bg-blue-500/30 text-blue-300 font-bold border border-blue-400/40 shadow-glow-blue' : 'text-slate-400 hover:text-white'}`}
          >
            <ChevronRight className="w-5 h-5" />
            <span>Control</span>
          </button>

          <button
            onClick={() => { triggerHaptic(); setActiveTab('zoom'); }}
            className={`p-3 rounded-2xl flex flex-col items-center text-[10px] space-y-1 transition-all ${activeTab === 'zoom' ? 'bg-blue-500/30 text-blue-300 font-bold border border-blue-400/40 shadow-glow-blue' : 'text-slate-400 hover:text-white'}`}
          >
            <ZoomIn className="w-5 h-5" />
            <span>Smart Zoom</span>
          </button>

          <button
            onClick={() => { triggerHaptic(); setActiveTab('effects'); }}
            className={`p-3 rounded-2xl flex flex-col items-center text-[10px] space-y-1 transition-all ${activeTab === 'effects' ? 'bg-purple-500/30 text-purple-300 font-bold border border-purple-400/40 shadow-glow-cyan' : 'text-slate-400 hover:text-white'}`}
          >
            <Sliders className="w-5 h-5" />
            <span>Effects</span>
          </button>

          <button
            onClick={() => { triggerHaptic(); setActiveTab('laser'); }}
            className={`p-3 rounded-2xl flex flex-col items-center text-[10px] space-y-1 transition-all ${activeTab === 'laser' ? 'bg-red-500/30 text-red-300 font-bold border border-red-400/40' : 'text-slate-400 hover:text-white'}`}
          >
            <MousePointer className="w-5 h-5" />
            <span>Laser</span>
          </button>

          <button
            onClick={() => { triggerHaptic(); setActiveTab('notes'); }}
            className={`p-3 rounded-2xl flex flex-col items-center text-[10px] space-y-1 transition-all ${activeTab === 'notes' ? 'bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-400/40' : 'text-slate-400 hover:text-white'}`}
          >
            <FileText className="w-5 h-5" />
            <span>Notes</span>
          </button>
        </div>
      </div>
    </div>
  );
}
