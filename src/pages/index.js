import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import {
  Tv,
  Smartphone,
  Sparkles,
  Zap,
  Sliders,
  ZoomIn,
  RotateCcw,
  ArrowRight,
  Monitor,
  Radio,
  Layers
} from 'lucide-react';
import { SAMPLE_DECKS } from '../data/sampleDecks';

export default function Home() {
  const [roomId, setRoomId] = useState('DEMO');
  const [selectedDeck, setSelectedDeck] = useState('futuristic-tech');
  const [hostUrl, setHostUrl] = useState('');
  const [remoteUrl, setRemoteUrl] = useState('');

  useEffect(() => {
    const origin = window.location.origin;
    setHostUrl(`${origin}/present?room=${roomId}`);
    setRemoteUrl(`${origin}/remote?room=${roomId}`);
  }, [roomId]);

  return (
    <div className="min-h-screen bg-[#080B10] text-slate-100 relative overflow-hidden flex flex-col justify-between p-6 md:p-12 selection:bg-blue-500/30">
      {/* Background Decorative Blur Orbs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-600/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Header Badge */}
      <header className="max-w-6xl mx-auto w-full flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-glow-blue border border-white/20">
            <Radio className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white leading-none">
              AuraSync PPT
            </h1>
            <span className="text-xs text-slate-400 font-mono">Real-Time Mobile Presentation Controller</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="px-3 py-1 text-xs font-mono rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center">
            <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-ping" />
            Socket.io Ready
          </span>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="max-w-6xl mx-auto w-full my-auto py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 z-10 items-center">
        {/* Left Column: Title & Launch Cards */}
        <div className="lg:col-span-7 space-y-8">
          <div className="space-y-4">
            <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 inline-flex items-center space-x-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Apple iOS Glassmorphism UI/UX</span>
            </span>

            <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
              Control Host Slides Live from your <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-300 to-purple-400">Mobile Phone</span>
            </h2>

            <p className="text-base md:text-lg text-slate-300 font-light max-w-xl leading-relaxed">
              Instant real-time WebSocket synchronization, smart drag-to-zoom bounding box selection, real-time CSS filter matrix, and touch laser pointer.
            </p>
          </div>

          {/* Room Code & Deck Selector */}
          <div className="glass-card p-5 space-y-4 max-w-xl">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-slate-400 font-mono uppercase tracking-wider">Session Room Code</label>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-2.5 text-sm font-mono text-white tracking-widest uppercase focus:outline-none focus:border-blue-400"
                  placeholder="e.g. DEMO"
                />
              </div>

              <div className="flex-1 space-y-1">
                <label className="text-xs text-slate-400 font-mono uppercase tracking-wider">Select Deck</label>
                <select
                  value={selectedDeck}
                  onChange={(e) => setSelectedDeck(e.target.value)}
                  className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-400"
                >
                  {SAMPLE_DECKS.map(deck => (
                    <option key={deck.id} value={deck.id} className="bg-slate-900 text-white">
                      {deck.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 max-w-xl">
            <Link
              href={`/present?room=${roomId}`}
              className="flex-1 glass-button-primary p-4 text-center font-bold text-white flex items-center justify-center space-x-3 text-base shadow-glow-blue"
            >
              <Tv className="w-5 h-5 text-white" />
              <span>Launch Host Screen</span>
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Link>

            <Link
              href={`/remote?room=${roomId}`}
              className="flex-1 glass-button p-4 text-center font-bold text-white flex items-center justify-center space-x-3 text-base"
            >
              <Smartphone className="w-5 h-5 text-blue-400" />
              <span>Launch Controller</span>
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Link>
          </div>
        </div>

        {/* Right Column: Mobile QR Code Scanner Card */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="w-full max-w-sm glass-panel p-6 rounded-3xl text-center space-y-5 border border-white/20 shadow-2xl"
          >
            <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-400">
              <Smartphone className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-white">Connect Mobile Remote</h3>
              <p className="text-xs text-slate-400 mt-1">
                Scan QR code with your mobile camera to join Room <strong className="text-blue-400 font-mono">{roomId}</strong>
              </p>
            </div>

            {/* QR Code Container */}
            <div className="p-4 bg-white rounded-2xl mx-auto w-fit shadow-xl border border-slate-200">
              {remoteUrl && (
                <QRCodeSVG
                  value={remoteUrl}
                  size={180}
                  level="H"
                  includeMargin={false}
                />
              )}
            </div>

            <div className="text-[11px] text-slate-400 font-mono bg-black/40 p-2.5 rounded-xl border border-white/10 truncate">
              {remoteUrl}
            </div>
          </motion.div>
        </div>
      </main>

      {/* Feature Highlights Footer */}
      <footer className="max-w-6xl mx-auto w-full pt-6 border-t border-white/10 z-10 grid grid-cols-2 md:grid-cols-4 gap-4 text-slate-400 text-xs">
        <div className="flex items-center space-x-2">
          <ZoomIn className="w-4 h-4 text-blue-400" />
          <span>Smart Area Drag Zoom</span>
        </div>
        <div className="flex items-center space-x-2">
          <RotateCcw className="w-4 h-4 text-rose-400" />
          <span>ESC Quick Reset</span>
        </div>
        <div className="flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-purple-400" />
          <span>Live CSS Filters & Spotlight</span>
        </div>
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>iOS Glassmorphism UI</span>
        </div>
      </footer>
    </div>
  );
}
