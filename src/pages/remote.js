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
  UploadCloud,
  User,
  Power,
  Sun,
  Moon,
  Zap,
  Eye,
  Check
} from 'lucide-react';
import { SAMPLE_DECKS } from '../data/sampleDecks';
import { processPdfFile, processImageFiles } from '../utils/pdfProcessor';

export default function RemotePage() {
  const [roomId, setRoomId] = useState('DEMO');
  const [username, setUsername] = useState('');
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // Deck & Slide Sync
  const [deckId, setDeckId] = useState('futuristic-tech');
  const [customDeck, setCustomDeck] = useState(null);
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
  const [selectionBox, setSelectionBox] = useState(null);
  const zoomCanvasRef = useRef(null);

  // Laser Pointer State
  const laserTrackpadRef = useRef(null);

  // Presentation Timer
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Mobile Upload PDF State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const activeDeck = customDeck || SAMPLE_DECKS.find(d => d.id === deckId) || SAMPLE_DECKS[0];
  const slide = activeDeck.slides ? (activeDeck.slides[currentSlide] || activeDeck.slides[0]) : activeDeck;

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room') || 'DEMO';
    const userParam = urlParams.get('user') || '';
    setRoomId(roomParam.toUpperCase());
    if (userParam) setUsername(userParam);

    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('join-room', { roomId: roomParam, role: 'remote' });
    });

    newSocket.on('room-state', (state) => {
      if (state.customDeck) setCustomDeck(state.customDeck);
      if (state.currentSlide !== undefined) setCurrentSlide(state.currentSlide);
      if (state.totalSlides) setTotalSlides(state.totalSlides);
      if (state.deckId) setDeckId(state.deckId);
      if (state.isZoomed !== undefined) setIsZoomed(state.isZoomed);
      if (state.filters) setFilters(state.filters);
      if (state.spotlight) setSpotlightActive(state.spotlight.active);
      if (state.blackout !== undefined) setBlackoutActive(state.blackout);
    });

    newSocket.on('deck-uploaded', (data) => {
      setCustomDeck(data.deck);
      setCurrentSlide(0);
      setTotalSlides(data.totalSlides || (data.deck.slides ? data.deck.slides.length : 1));
      setIsZoomed(false);
      setSelectionBox(null);
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

  const triggerHaptic = () => {
    if (navigator.vibrate) {
      try { navigator.vibrate(20); } catch (e) {}
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

  // Drag-to-Zoom Selection Handlers
  const getCanvasCoords = (e) => {
    if (!zoomCanvasRef.current) return { x: 0, y: 0 };
    const rect = zoomCanvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = Math.min(rect.width, Math.max(0, clientX - rect.left));
    const y = Math.min(rect.height, Math.max(0, clientY - rect.top));

    return {
      pctX: (x / rect.width) * 100,
      pctY: (y / rect.height) * 100,
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

    const zoomCoords = { x: minX, y: minY, width, height };

    setIsZoomed(true);
    if (socket) socket.emit('zoom-area', zoomCoords);
  };

  // Upload PDF directly from Mobile
  const handleMobilePdfUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress('Processing PDF pages...');

    try {
      const file = files[0];
      let newDeck = null;

      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        newDeck = await processPdfFile(file, (p, t) => {
          setUploadProgress(`Page ${p} of ${t}...`);
        });
      } else {
        newDeck = await processImageFiles(files);
      }

      if (newDeck) {
        setCustomDeck(newDeck);
        setCurrentSlide(0);
        setTotalSlides(newDeck.slides.length);

        if (socket) {
          socket.emit('upload-deck', { deck: newDeck });
        }
        triggerHaptic();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  // Filter Handlers
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

  const handleLaserTouchMove = (e) => {
    if (!laserTrackpadRef.current) return;
    const rect = laserTrackpadRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const pctX = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const pctY = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));

    if (socket) socket.emit('laser-move', { active: true, x: pctX, y: pctY });
  };

  const handleLaserTouchEnd = () => {
    if (socket) socket.emit('laser-move', { active: false, x: 50, y: 50 });
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

  return (
    <div className="w-screen h-screen bg-[#F2F2F7] text-[#1C1C1E] flex flex-col justify-between overflow-hidden select-none touch-none">
      {/* Top Header Bar */}
      <div className="glass-panel-light px-5 py-3 flex items-center justify-between z-30 border-b border-white/80">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-xs font-mono font-bold tracking-wider text-slate-800">
            {username ? `@${username}` : `ROOM: ${roomId}`}
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsTimerRunning(!isTimerRunning)}
            className="flex items-center space-x-1 text-xs font-mono px-2.5 py-1 rounded-full bg-white/80 border border-slate-200 text-slate-700 shadow-sm"
          >
            <Clock className="w-3 h-3 text-blue-600" />
            <span>{formatTime(timerSeconds)}</span>
          </button>

          {/* Quick ESC Reset Button */}
          <button
            onClick={handleEscReset}
            className="glass-button-danger px-3 py-1.5 text-xs font-extrabold tracking-wider flex items-center space-x-1 shadow-sm"
            title="Reset Zoom & Filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>ESC</span>
          </button>
        </div>
      </div>

      {/* Main Tab Controller View */}
      <div className="flex-1 relative overflow-hidden p-4 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {/* TAB 1: Minimal Tactile Navigation View */}
          {activeTab === 'nav' && (
            <motion.div
              key="nav-tab"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-sm mx-auto h-full flex flex-col justify-between space-y-4"
            >
              {/* Slide Counter & Preview Card */}
              <div className="glass-card-light p-4 text-center space-y-2 border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center text-xs text-slate-500 font-mono">
                  <span>SLIDE {currentSlide + 1} OF {totalSlides}</span>
                  <span className="text-blue-600 font-semibold truncate max-w-[160px]">{activeDeck.title}</span>
                </div>
                <div className="text-base font-bold text-[#1C1C1E] truncate">
                  {slide.title || `Page ${currentSlide + 1}`}
                </div>
                {isZoomed && (
                  <div className="text-xs font-mono text-amber-700 bg-amber-500/20 px-2.5 py-0.5 rounded-full inline-block font-semibold">
                    ● Dynamic Zoom Active
                  </div>
                )}
              </div>

              {/* Large Tactile Navigation Buttons */}
              <div className="grid grid-cols-2 gap-4 my-auto">
                <button
                  onClick={handlePrev}
                  disabled={currentSlide === 0}
                  className={`h-40 glass-button-light flex flex-col items-center justify-center space-y-2 text-[#1C1C1E] border-2 border-white shadow-md ${currentSlide === 0 ? 'opacity-40 pointer-events-none' : 'hover:border-blue-500/30'}`}
                >
                  <ChevronLeft className="w-12 h-12 text-blue-600" />
                  <span className="text-sm font-bold uppercase tracking-wider">PREV</span>
                </button>

                <button
                  onClick={handleNext}
                  disabled={currentSlide === totalSlides - 1}
                  className={`h-40 glass-button-primary flex flex-col items-center justify-center space-y-2 text-white border-2 border-white/40 shadow-lg shadow-blue-500/30 ${currentSlide === totalSlides - 1 ? 'opacity-40 pointer-events-none' : ''}`}
                >
                  <ChevronRight className="w-12 h-12 text-white" />
                  <span className="text-sm font-bold uppercase tracking-wider">NEXT</span>
                </button>
              </div>

              {/* Quick Action Buttons & PDF Mobile Upload */}
              <div className="grid grid-cols-3 gap-2">
                <label className="glass-button-light p-3 flex flex-col items-center text-xs space-y-1 cursor-pointer">
                  <UploadCloud className="w-5 h-5 text-blue-600" />
                  <span>{isUploading ? 'Loading...' : 'Upload PDF'}</span>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={handleMobilePdfUpload}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={() => setActiveTab('zoom')}
                  className="glass-button-light p-3 flex flex-col items-center text-xs space-y-1"
                >
                  <ZoomIn className="w-5 h-5 text-blue-600" />
                  <span>Zoom Box</span>
                </button>

                <button
                  onClick={triggerConfetti}
                  className="glass-button-light p-3 flex flex-col items-center text-xs space-y-1"
                >
                  <Sparkles className="w-5 h-5 text-purple-600" />
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
                <h3 className="text-base font-bold text-[#1C1C1E] flex items-center justify-center space-x-2">
                  <ZoomIn className="w-5 h-5 text-blue-600" />
                  <span>Smart Drag-to-Zoom</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Draw a selection rectangle to focus host presentation</p>
              </div>

              {/* Mirrored Slide Canvas */}
              <div
                ref={zoomCanvasRef}
                onTouchStart={handleTouchStartZoom}
                onTouchMove={handleTouchMoveZoom}
                onTouchEnd={handleTouchEndZoom}
                onMouseDown={handleTouchStartZoom}
                onMouseMove={handleTouchMoveZoom}
                onMouseUp={handleTouchEndZoom}
                className="relative w-full aspect-[16/10] bg-white rounded-2xl border-2 border-slate-300 shadow-xl overflow-hidden touch-none select-none flex flex-col justify-between p-3"
              >
                {slide.image ? (
                  <img src={slide.image} alt="Slide Preview" className="w-full h-full object-contain pointer-events-none" />
                ) : (
                  <div className="my-auto space-y-1 text-center">
                    <div className="text-xs font-bold text-slate-800">{slide.title}</div>
                    <div className="text-[10px] text-slate-500 line-clamp-2">{slide.tagline || slide.notes}</div>
                  </div>
                )}

                {/* Bounding Box Highlight */}
                {selectionBox && (
                  <div
                    className="absolute border-2 border-blue-600 bg-blue-500/20 rounded-lg bounding-box-active-light pointer-events-none"
                    style={{
                      left: `${Math.min(selectionBox.startX, selectionBox.endX)}%`,
                      top: `${Math.min(selectionBox.startY, selectionBox.endY)}%`,
                      width: `${Math.abs(selectionBox.endX - selectionBox.startX)}%`,
                      height: `${Math.abs(selectionBox.endY - selectionBox.startY)}%`,
                    }}
                  >
                    <span className="absolute -top-5 left-0 text-[9px] bg-blue-600 text-white px-1.5 rounded font-mono font-bold">
                      Target Area
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={handleEscReset}
                className="w-full glass-button-danger p-3 text-xs font-bold flex items-center justify-center space-x-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Zoom (ESC)</span>
              </button>
            </motion.div>
          )}

          {/* TAB 3: Effects */}
          {activeTab === 'effects' && (
            <motion.div
              key="effects-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full max-w-sm mx-auto h-full flex flex-col justify-between space-y-4"
            >
              <div className="text-center">
                <h3 className="text-base font-bold text-[#1C1C1E] flex items-center justify-center space-x-2">
                  <Sliders className="w-5 h-5 text-purple-600" />
                  <span>Real-Time Host Effects</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Apply visual filters to host screen</p>
              </div>

              <div className="glass-card-light p-4 space-y-4 border border-slate-200">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-700 font-medium">
                    <span>Blur Level</span>
                    <span className="font-mono text-purple-600">{filters.blur}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="15"
                    value={filters.blur}
                    onChange={handleBlurChange}
                    className="w-full accent-purple-600 bg-slate-200 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => handleFilterToggle('grayscale')}
                    className={`glass-button-light p-3 text-xs font-medium flex items-center justify-between ${filters.grayscale ? 'bg-purple-500/20 border-purple-500' : ''}`}
                  >
                    <span>Grayscale</span>
                    <Moon className="w-4 h-4 text-purple-600" />
                  </button>

                  <button
                    onClick={() => handleFilterToggle('invert')}
                    className={`glass-button-light p-3 text-xs font-medium flex items-center justify-between ${filters.invert ? 'bg-purple-500/20 border-purple-500' : ''}`}
                  >
                    <span>Invert</span>
                    <Sun className="w-4 h-4 text-amber-600" />
                  </button>

                  <button
                    onClick={handleToggleSpotlight}
                    className={`glass-button-light p-3 text-xs font-medium flex items-center justify-between ${spotlightActive ? 'bg-blue-500/20 border-blue-500' : ''}`}
                  >
                    <span>Spotlight Focus</span>
                    <Eye className="w-4 h-4 text-blue-600" />
                  </button>

                  <button
                    onClick={handleToggleBlackout}
                    className={`glass-button-light p-3 text-xs font-medium flex items-center justify-between ${blackoutActive ? 'bg-rose-500/20 border-rose-500' : ''}`}
                  >
                    <span>Blackout</span>
                    <Power className="w-4 h-4 text-rose-600" />
                  </button>
                </div>
              </div>

              <button
                onClick={handleEscReset}
                className="w-full glass-button-light p-3 text-xs font-bold text-slate-700 flex items-center justify-center space-x-2"
              >
                <RotateCcw className="w-4 h-4 text-rose-600" />
                <span>Reset All Effects</span>
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
                <h3 className="text-base font-bold text-[#1C1C1E] flex items-center justify-center space-x-2">
                  <MousePointer className="w-5 h-5 text-red-500" />
                  <span>Laser Pointer Trackpad</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Drag finger on trackpad to control red laser dot</p>
              </div>

              <div
                ref={laserTrackpadRef}
                onTouchMove={handleLaserTouchMove}
                onTouchEnd={handleLaserTouchEnd}
                onMouseMove={handleLaserTouchMove}
                onMouseLeave={handleLaserTouchEnd}
                className="w-full aspect-[4/3] glass-card-light bg-slate-100 border-2 border-red-500/40 rounded-2xl flex flex-col items-center justify-center relative touch-none select-none overflow-hidden shadow-inner"
              >
                <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500 flex items-center justify-center animate-ping" />
                <span className="text-xs font-mono text-red-600 mt-4 tracking-wider uppercase font-bold">
                  [ TOUCH TRACKPAD SURFACE ]
                </span>
              </div>
            </motion.div>
          )}

          {/* TAB 5: Speaker Notes */}
          {activeTab === 'notes' && (
            <motion.div
              key="notes-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full max-w-sm mx-auto h-full flex flex-col justify-between space-y-4"
            >
              <div className="text-center">
                <h3 className="text-base font-bold text-[#1C1C1E] flex items-center justify-center space-x-2">
                  <FileText className="w-5 h-5 text-emerald-600" />
                  <span>Speaker Notes</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Confidential presenter notes</p>
              </div>

              <div className="glass-card-light p-4 space-y-3 flex-1 overflow-y-auto max-h-[45vh] border border-slate-200">
                <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider font-mono">
                  Slide {currentSlide + 1} Notes:
                </div>
                <p className="text-sm text-slate-700 leading-relaxed font-light">
                  {slide.notes || 'No confidential speaker notes recorded for this slide.'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom iOS Liquid Glass Floating Dock */}
      <div className="p-4 z-30">
        <div className="glass-dock-light max-w-sm mx-auto p-2 flex justify-around items-center border border-white">
          <button
            onClick={() => { triggerHaptic(); setActiveTab('nav'); }}
            className={`p-3 rounded-2xl flex flex-col items-center text-[10px] space-y-1 transition-all ${activeTab === 'nav' ? 'bg-blue-500/15 text-blue-600 font-bold border border-blue-500/30' : 'text-slate-500'}`}
          >
            <ChevronRight className="w-5 h-5" />
            <span>Control</span>
          </button>

          <button
            onClick={() => { triggerHaptic(); setActiveTab('zoom'); }}
            className={`p-3 rounded-2xl flex flex-col items-center text-[10px] space-y-1 transition-all ${activeTab === 'zoom' ? 'bg-blue-500/15 text-blue-600 font-bold border border-blue-500/30' : 'text-slate-500'}`}
          >
            <ZoomIn className="w-5 h-5" />
            <span>Smart Zoom</span>
          </button>

          <button
            onClick={() => { triggerHaptic(); setActiveTab('effects'); }}
            className={`p-3 rounded-2xl flex flex-col items-center text-[10px] space-y-1 transition-all ${activeTab === 'effects' ? 'bg-purple-500/15 text-purple-600 font-bold border border-purple-500/30' : 'text-slate-500'}`}
          >
            <Sliders className="w-5 h-5" />
            <span>Effects</span>
          </button>

          <button
            onClick={() => { triggerHaptic(); setActiveTab('laser'); }}
            className={`p-3 rounded-2xl flex flex-col items-center text-[10px] space-y-1 transition-all ${activeTab === 'laser' ? 'bg-red-500/15 text-red-600 font-bold border border-red-500/30' : 'text-slate-500'}`}
          >
            <MousePointer className="w-5 h-5" />
            <span>Laser</span>
          </button>

          <button
            onClick={() => { triggerHaptic(); setActiveTab('notes'); }}
            className={`p-3 rounded-2xl flex flex-col items-center text-[10px] space-y-1 transition-all ${activeTab === 'notes' ? 'bg-emerald-500/15 text-emerald-600 font-bold border border-emerald-500/30' : 'text-slate-500'}`}
          >
            <FileText className="w-5 h-5" />
            <span>Notes</span>
          </button>
        </div>
      </div>
    </div>
  );
}
