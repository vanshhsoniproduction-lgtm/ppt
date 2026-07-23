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
  Power,
  Sun,
  Moon,
  Eye,
  Radio
} from 'lucide-react';
import { getDeckByIdFromDB } from '../utils/db';
import { processPdfFile, processImageFiles } from '../utils/pdfProcessor';

export default function RemotePage() {
  const [roomId, setRoomId] = useState('DEMO');
  const [username, setUsername] = useState('');
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // Active Presentation State
  const [activeDeck, setActiveDeck] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [totalSlides, setTotalSlides] = useState(1);
  const [isZoomed, setIsZoomed] = useState(false);

  // Active Controller Tab
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

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room') || 'DEMO';
    const userParam = urlParams.get('user') || '';
    const deckParam = urlParams.get('deck');
    setRoomId(roomParam.toUpperCase());
    if (userParam) setUsername(userParam);

    if (deckParam) {
      getDeckByIdFromDB(deckParam).then(deck => {
        if (deck) {
          setActiveDeck(deck);
          setTotalSlides(deck.slides ? deck.slides.length : 1);
        }
      });
    }

    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('join-room', { roomId: roomParam, role: 'remote' });
    });

    newSocket.on('room-state', (state) => {
      if (state.customDeck) {
        setActiveDeck(state.customDeck);
        setTotalSlides(state.customDeck.slides ? state.customDeck.slides.length : 1);
      }
      if (state.currentSlide !== undefined) setCurrentSlide(state.currentSlide);
      if (state.totalSlides) setTotalSlides(state.totalSlides);
      if (state.isZoomed !== undefined) setIsZoomed(state.isZoomed);
      if (state.filters) setFilters(state.filters);
      if (state.spotlight) setSpotlightActive(state.spotlight.active);
      if (state.blackout !== undefined) setBlackoutActive(state.blackout);
    });

    newSocket.on('deck-uploaded', (data) => {
      setActiveDeck(data.deck);
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

    return () => { newSocket.disconnect(); };
  }, []);

  // Timer Effect
  useEffect(() => {
    let interval = null;
    if (isTimerRunning) {
      interval = setInterval(() => setTimerSeconds(sec => sec + 1), 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const slideDeck = activeDeck;
  const slides = slideDeck ? (slideDeck.slides || []) : [];
  const currentSlideData = slides[currentSlide] || slides[0] || {};

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

  // Smart Zoom Selection Drag Logic
  const getCanvasCoords = (e) => {
    if (!zoomCanvasRef.current) return { pctX: 0, pctY: 0 };
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

  // Mobile PDF Upload
  const handleMobilePdfUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress('Processing PDF pages...');

    try {
      const file = files[0];
      let newDeck = null;

      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        newDeck = await processPdfFile(file, username, (p, t) => {
          setUploadProgress(`Page ${p} of ${t}...`);
        });
      } else {
        newDeck = await processImageFiles(files, username);
      }

      if (newDeck) {
        setActiveDeck(newDeck);
        setCurrentSlide(0);
        setTotalSlides(newDeck.slides.length);
        if (socket) socket.emit('upload-deck', { deck: newDeck });
        triggerHaptic();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  // Laser Pointer Handler
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

  // If no deck is loaded yet, show minimal loading state instead of generic data
  if (!activeDeck) {
    return (
      <div className="w-screen h-screen bg-[#F2F2F7] text-[#1C1C1E] flex flex-col items-center justify-center p-6 text-center">
        <div className="glass-panel-light p-8 max-w-sm w-full space-y-4 border border-white shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white mx-auto shadow-md">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <h3 className="text-lg font-extrabold text-[#1C1C1E]">Connecting to Presentation</h3>
          <p className="text-xs text-slate-500 font-medium">
            Syncing live presentation slides for Room <strong className="text-blue-600 font-mono">{roomId}</strong>...
          </p>
          <label className="glass-button-primary p-3 w-full text-xs font-bold flex items-center justify-center space-x-2 cursor-pointer shadow-sm">
            <UploadCloud className="w-4 h-4" />
            <span>Upload PDF Directly</span>
            <input type="file" accept=".pdf,image/*" onChange={handleMobilePdfUpload} className="hidden" />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-[#F2F2F7] text-[#1C1C1E] flex flex-col justify-between overflow-hidden select-none touch-none">
      {/* Header Bar */}
      <div className="glass-panel-light px-4 py-2 flex items-center justify-between z-30 border-b border-white">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-xs font-mono font-bold tracking-wider text-slate-800">
            {username ? `@${username}` : `ROOM: ${roomId}`}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsTimerRunning(!isTimerRunning)}
            className="flex items-center space-x-1 text-xs font-mono px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700 shadow-sm"
          >
            <Clock className="w-3 h-3 text-blue-600" />
            <span>{formatTime(timerSeconds)}</span>
          </button>

          {/* Quick ESC Reset Button */}
          <button
            onClick={handleEscReset}
            className="glass-button-danger px-3 py-1 text-xs font-extrabold tracking-wider flex items-center space-x-1 shadow-sm"
            title="Reset Zoom & Filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>ESC</span>
          </button>
        </div>
      </div>

      {/* Main Tab Controller (Responsive for Landscape & Portrait) */}
      <div className="flex-1 relative overflow-hidden p-3 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {/* TAB 1: Navigation Control */}
          {activeTab === 'nav' && (
            <motion.div
              key="nav-tab"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="w-full max-w-md mx-auto h-full flex flex-col justify-between space-y-3"
            >
              {/* Slide Counter Header */}
              <div className="glass-card-light p-3 text-center space-y-1 border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center text-[11px] text-slate-500 font-mono">
                  <span>SLIDE {currentSlide + 1} OF {totalSlides}</span>
                  <span className="text-blue-600 font-bold truncate max-w-[180px]">{slideDeck.title}</span>
                </div>
                <div className="text-sm font-extrabold text-[#1C1C1E] truncate">
                  {currentSlideData.title || `Slide ${currentSlide + 1}`}
                </div>
                {isZoomed && (
                  <div className="text-[10px] font-mono text-amber-700 bg-amber-500/20 px-2 py-0.5 rounded-full inline-block font-semibold">
                    ● Dynamic Zoom Active
                  </div>
                )}
              </div>

              {/* Large Tactile Prev/Next Buttons */}
              <div className="grid grid-cols-2 gap-3 my-auto">
                <button
                  onClick={handlePrev}
                  disabled={currentSlide === 0}
                  className={`h-36 landscape:h-24 glass-button-light flex flex-col items-center justify-center space-y-1 text-[#1C1C1E] border-2 border-white shadow-md ${currentSlide === 0 ? 'opacity-40 pointer-events-none' : 'hover:border-blue-500/30'}`}
                >
                  <ChevronLeft className="w-10 h-10 text-blue-600" />
                  <span className="text-xs font-extrabold uppercase tracking-wider">PREV</span>
                </button>

                <button
                  onClick={handleNext}
                  disabled={currentSlide === totalSlides - 1}
                  className={`h-36 landscape:h-24 glass-button-primary flex flex-col items-center justify-center space-y-1 text-white border-2 border-white/40 shadow-md shadow-blue-500/30 ${currentSlide === totalSlides - 1 ? 'opacity-40 pointer-events-none' : ''}`}
                >
                  <ChevronRight className="w-10 h-10 text-white" />
                  <span className="text-xs font-extrabold uppercase tracking-wider">NEXT</span>
                </button>
              </div>

              {/* Quick Actions Bar */}
              <div className="grid grid-cols-3 gap-2">
                <label className="glass-button-light p-2.5 flex flex-col items-center text-[11px] space-y-1 cursor-pointer font-bold">
                  <UploadCloud className="w-4 h-4 text-blue-600" />
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
                  className="glass-button-light p-2.5 flex flex-col items-center text-[11px] space-y-1 font-bold"
                >
                  <ZoomIn className="w-4 h-4 text-blue-600" />
                  <span>Zoom Box</span>
                </button>

                <button
                  onClick={triggerConfetti}
                  className="glass-button-light p-2.5 flex flex-col items-center text-[11px] space-y-1 font-bold"
                >
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>Confetti</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* TAB 2: Smart Drag-to-Zoom Live Mirroring Canvas */}
          {activeTab === 'zoom' && (
            <motion.div
              key="zoom-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full max-w-md mx-auto h-full flex flex-col justify-between space-y-3"
            >
              <div className="text-center">
                <h3 className="text-sm font-bold text-[#1C1C1E] flex items-center justify-center space-x-1.5">
                  <ZoomIn className="w-4 h-4 text-blue-600" />
                  <span>Smart Drag-to-Zoom</span>
                </h3>
                <p className="text-[11px] text-slate-500">Draw a selection box on the live slide image below</p>
              </div>

              {/* ACTUAL LIVE CURRENT SLIDE MIRROR CANVAS */}
              <div
                ref={zoomCanvasRef}
                onTouchStart={handleTouchStartZoom}
                onTouchMove={handleTouchMoveZoom}
                onTouchEnd={handleTouchEndZoom}
                onMouseDown={handleTouchStartZoom}
                onMouseMove={handleTouchMoveZoom}
                onMouseUp={handleTouchEndZoom}
                className="relative w-full aspect-[16/9] bg-slate-900 rounded-2xl border-2 border-slate-300 shadow-xl overflow-hidden touch-none select-none flex items-center justify-center"
              >
                {currentSlideData.image ? (
                  <img
                    src={currentSlideData.image}
                    alt="Live Current Slide"
                    className="w-full h-full object-contain pointer-events-none"
                  />
                ) : (
                  <div className="p-4 text-center text-white space-y-1">
                    <div className="text-xs font-bold">{currentSlideData.title || `Slide ${currentSlide + 1}`}</div>
                    <div className="text-[10px] text-slate-400">{currentSlideData.tagline || currentSlideData.notes}</div>
                  </div>
                )}

                {/* Bounding Box Selection Highlight */}
                {selectionBox && (
                  <div
                    className="absolute border-2 border-blue-600 bg-blue-500/25 rounded-lg bounding-box-active-light pointer-events-none"
                    style={{
                      left: `${Math.min(selectionBox.startX, selectionBox.endX)}%`,
                      top: `${Math.min(selectionBox.startY, selectionBox.endY)}%`,
                      width: `${Math.abs(selectionBox.endX - selectionBox.startX)}%`,
                      height: `${Math.abs(selectionBox.endY - selectionBox.startY)}%`,
                    }}
                  >
                    <span className="absolute -top-4 left-0 text-[8px] bg-blue-600 text-white px-1 rounded font-mono font-bold">
                      Target Area
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={handleEscReset}
                className="w-full glass-button-danger p-2.5 text-xs font-bold flex items-center justify-center space-x-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Zoom (ESC)</span>
              </button>
            </motion.div>
          )}

          {/* TAB 3: Visual Effects */}
          {activeTab === 'effects' && (
            <motion.div
              key="effects-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full max-w-md mx-auto h-full flex flex-col justify-between space-y-3"
            >
              <div className="text-center">
                <h3 className="text-sm font-bold text-[#1C1C1E] flex items-center justify-center space-x-1.5">
                  <Sliders className="w-4 h-4 text-purple-600" />
                  <span>Real-Time Visual Effects</span>
                </h3>
              </div>

              <div className="glass-card-light p-3 space-y-3 border border-slate-200">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-700 font-medium">
                    <span>Dynamic Blur</span>
                    <span className="font-mono text-purple-600">{filters.blur}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="15"
                    value={filters.blur}
                    onChange={(e) => {
                      const updated = { ...filters, blur: parseInt(e.target.value, 10) };
                      setFilters(updated);
                      if (socket) socket.emit('apply-filter', updated);
                    }}
                    className="w-full accent-purple-600 bg-slate-200 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => {
                      const updated = { ...filters, grayscale: !filters.grayscale };
                      setFilters(updated);
                      if (socket) socket.emit('apply-filter', updated);
                    }}
                    className={`glass-button-light p-2.5 text-xs font-medium flex items-center justify-between ${filters.grayscale ? 'bg-purple-500/20 border-purple-500' : ''}`}
                  >
                    <span>Grayscale</span>
                    <Moon className="w-3.5 h-3.5 text-purple-600" />
                  </button>

                  <button
                    onClick={() => {
                      const updated = { ...filters, invert: !filters.invert };
                      setFilters(updated);
                      if (socket) socket.emit('apply-filter', updated);
                    }}
                    className={`glass-button-light p-2.5 text-xs font-medium flex items-center justify-between ${filters.invert ? 'bg-purple-500/20 border-purple-500' : ''}`}
                  >
                    <span>Invert</span>
                    <Sun className="w-3.5 h-3.5 text-amber-600" />
                  </button>

                  <button
                    onClick={() => {
                      const next = !spotlightActive;
                      setSpotlightActive(next);
                      if (socket) socket.emit('toggle-spotlight', { active: next, x: 50, y: 50, radius: 160 });
                    }}
                    className={`glass-button-light p-2.5 text-xs font-medium flex items-center justify-between ${spotlightActive ? 'bg-blue-500/20 border-blue-500' : ''}`}
                  >
                    <span>Spotlight Focus</span>
                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                  </button>

                  <button
                    onClick={() => {
                      const next = !blackoutActive;
                      setBlackoutActive(next);
                      if (socket) socket.emit('toggle-blackout');
                    }}
                    className={`glass-button-light p-2.5 text-xs font-medium flex items-center justify-between ${blackoutActive ? 'bg-rose-500/20 border-rose-500' : ''}`}
                  >
                    <span>Blackout Mode</span>
                    <Power className="w-3.5 h-3.5 text-rose-600" />
                  </button>
                </div>
              </div>

              <button
                onClick={handleEscReset}
                className="w-full glass-button-light p-2.5 text-xs font-bold text-slate-700 flex items-center justify-center space-x-2"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                <span>Reset Visual Effects</span>
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
              className="w-full max-w-md mx-auto h-full flex flex-col justify-between space-y-3"
            >
              <div className="text-center">
                <h3 className="text-sm font-bold text-[#1C1C1E] flex items-center justify-center space-x-1.5">
                  <MousePointer className="w-4 h-4 text-red-500" />
                  <span>Laser Trackpad</span>
                </h3>
              </div>

              <div
                ref={laserTrackpadRef}
                onTouchMove={handleLaserTouchMove}
                onTouchEnd={handleLaserTouchEnd}
                onMouseMove={handleLaserTouchMove}
                onMouseLeave={handleLaserTouchEnd}
                className="w-full aspect-[16/9] glass-card-light bg-slate-100 border-2 border-red-500/40 rounded-2xl flex flex-col items-center justify-center relative touch-none select-none overflow-hidden shadow-inner"
              >
                <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500 flex items-center justify-center animate-ping" />
                <span className="text-[11px] font-mono text-red-600 mt-2 tracking-wider uppercase font-bold">
                  [ DRAG FINGER TO MOVE LASER ]
                </span>
              </div>
            </motion.div>
          )}

          {/* TAB 5: Confidential Speaker Notes */}
          {activeTab === 'notes' && (
            <motion.div
              key="notes-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full max-w-md mx-auto h-full flex flex-col justify-between space-y-3"
            >
              <div className="text-center">
                <h3 className="text-sm font-bold text-[#1C1C1E] flex items-center justify-center space-x-1.5">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>Speaker Notes</span>
                </h3>
              </div>

              <div className="glass-card-light p-4 space-y-2 flex-1 overflow-y-auto max-h-[45vh] border border-slate-200">
                <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider font-mono">
                  Slide {currentSlide + 1} Notes:
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-normal">
                  {currentSlideData.notes || 'No confidential speaker notes added for this slide. You can add notes from the My Files dashboard.'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom iOS Liquid Glass Floating Dock */}
      <div className="p-3 z-30">
        <div className="glass-dock-light max-w-md mx-auto p-1.5 flex justify-around items-center border border-white shadow-lg">
          <button
            onClick={() => { triggerHaptic(); setActiveTab('nav'); }}
            className={`p-2.5 rounded-2xl flex flex-col items-center text-[9px] space-y-0.5 transition-all ${activeTab === 'nav' ? 'bg-blue-500/15 text-blue-600 font-bold border border-blue-500/30' : 'text-slate-500'}`}
          >
            <ChevronRight className="w-4 h-4" />
            <span>Control</span>
          </button>

          <button
            onClick={() => { triggerHaptic(); setActiveTab('zoom'); }}
            className={`p-2.5 rounded-2xl flex flex-col items-center text-[9px] space-y-0.5 transition-all ${activeTab === 'zoom' ? 'bg-blue-500/15 text-blue-600 font-bold border border-blue-500/30' : 'text-slate-500'}`}
          >
            <ZoomIn className="w-4 h-4" />
            <span>Smart Zoom</span>
          </button>

          <button
            onClick={() => { triggerHaptic(); setActiveTab('effects'); }}
            className={`p-2.5 rounded-2xl flex flex-col items-center text-[9px] space-y-0.5 transition-all ${activeTab === 'effects' ? 'bg-purple-500/15 text-purple-600 font-bold border border-purple-500/30' : 'text-slate-500'}`}
          >
            <Sliders className="w-4 h-4" />
            <span>Effects</span>
          </button>

          <button
            onClick={() => { triggerHaptic(); setActiveTab('laser'); }}
            className={`p-2.5 rounded-2xl flex flex-col items-center text-[9px] space-y-0.5 transition-all ${activeTab === 'laser' ? 'bg-red-500/15 text-red-600 font-bold border border-red-500/30' : 'text-slate-500'}`}
          >
            <MousePointer className="w-4 h-4" />
            <span>Laser</span>
          </button>

          <button
            onClick={() => { triggerHaptic(); setActiveTab('notes'); }}
            className={`p-2.5 rounded-2xl flex flex-col items-center text-[9px] space-y-0.5 transition-all ${activeTab === 'notes' ? 'bg-emerald-500/15 text-emerald-600 font-bold border border-emerald-500/30' : 'text-slate-500'}`}
          >
            <FileText className="w-4 h-4" />
            <span>Notes</span>
          </button>
        </div>
      </div>
    </div>
  );
}
