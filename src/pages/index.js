import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tv,
  Smartphone,
  Sparkles,
  UploadCloud,
  User,
  FileText,
  CheckCircle,
  ArrowRight,
  Monitor,
  Layers,
  Radio,
  LogOut
} from 'lucide-react';
import { SAMPLE_DECKS } from '../data/sampleDecks';
import { processPdfFile, processImageFiles } from '../utils/pdfProcessor';

export default function Home() {
  const [username, setUsername] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [roomId, setRoomId] = useState('DEMO');
  const [selectedDeck, setSelectedDeck] = useState('futuristic-tech');
  const [customDecks, setCustomDecks] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  const [remoteUrl, setRemoteUrl] = useState('');

  useEffect(() => {
    // Check stored username
    const savedUser = localStorage.getItem('ppt_username');
    if (savedUser) {
      setUsername(savedUser);
      setIsLoggedIn(true);
      setRoomId(savedUser.toUpperCase() + '-ROOM');
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      const cleanRoom = (username ? username.toUpperCase() + '-ROOM' : roomId).trim();
      setRemoteUrl(`${origin}/remote?room=${cleanRoom}&user=${username}`);
    }
  }, [username, roomId]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (username.trim()) {
      const cleanUser = username.trim().toLowerCase();
      setUsername(cleanUser);
      localStorage.setItem('ppt_username', cleanUser);
      setIsLoggedIn(true);
      setRoomId(cleanUser.toUpperCase() + '-ROOM');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ppt_username');
    setUsername('');
    setIsLoggedIn(false);
    setRoomId('DEMO');
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadStatus('Processing presentation slides...');

    try {
      const file = files[0];
      let newDeck = null;

      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        newDeck = await processPdfFile(file, (page, total) => {
          setUploadStatus(`Rendering page ${page} of ${total}...`);
        });
      } else {
        newDeck = await processImageFiles(files);
      }

      if (newDeck) {
        setCustomDecks(prev => [newDeck, ...prev]);
        setSelectedDeck(newDeck.id);
        // Save in localStorage
        localStorage.setItem(`custom_deck_${newDeck.id}`, JSON.stringify(newDeck));
        setUploadStatus(`Successfully loaded "${newDeck.title}"!`);
      }
    } catch (err) {
      console.error(err);
      setUploadStatus('Failed to read file. Please upload a valid PDF or Image slides.');
    } finally {
      setIsUploading(false);
    }
  };

  const activeRoom = (username ? username.toUpperCase() + '-ROOM' : roomId).trim();

  return (
    <div className="min-h-screen bg-[#F2F2F7] text-[#1C1C1E] relative overflow-hidden flex flex-col justify-between p-6 md:p-12">
      {/* Light Background Decorative Soft Gradients */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-400/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-indigo-400/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Header Bar */}
      <header className="max-w-6xl mx-auto w-full flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-[#1C1C1E] leading-none">
              AuraSync Presentation
            </h1>
            <span className="text-xs text-slate-500 font-medium">Minimal iOS Presentation Hub</span>
          </div>
        </div>

        {isLoggedIn && (
          <div className="flex items-center space-x-3">
            <div className="px-3.5 py-1.5 rounded-full bg-white/80 border border-slate-200/80 text-xs font-medium text-slate-700 shadow-sm flex items-center space-x-2">
              <User className="w-3.5 h-3.5 text-blue-500" />
              <span>@{username}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-full hover:bg-slate-200/60 text-slate-500 transition-colors"
              title="Switch Account"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto w-full my-auto py-8 z-10">
        {!isLoggedIn ? (
          /* Step 1: Instant Username Login Form */
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto glass-panel-light p-8 text-center space-y-6 shadow-2xl"
          >
            <div className="w-14 h-14 mx-auto rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600">
              <User className="w-7 h-7" />
            </div>

            <div>
              <h2 className="text-2xl font-extrabold text-[#1C1C1E]">Enter your Username</h2>
              <p className="text-xs text-slate-500 mt-1">
                Creates your personal presentation room instantly. No password required.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. vansh"
                className="w-full bg-white border border-slate-300 rounded-2xl px-5 py-3 text-base text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-blue-500/40 shadow-sm"
              />

              <button
                type="submit"
                className="w-full glass-button-primary py-3.5 text-base font-bold flex items-center justify-center space-x-2"
              >
                <span>Create Workspace & Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        ) : (
          /* Step 2: Dashboard & Presentation Upload Workspace */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-600 border border-blue-500/20 inline-flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Personal Workspace</span>
                </span>
                <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-[#1C1C1E] mt-3">
                  Welcome, <span className="text-blue-600">@{username}</span>
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Upload your PDF or PPT slides and control projection live from mobile.
                </p>
              </div>

              {/* Upload PDF / PPT File Box */}
              <div className="glass-card-light p-6 space-y-4 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <UploadCloud className="w-5 h-5 text-blue-500" />
                    <h3 className="text-base font-bold text-[#1C1C1E]">Upload Presentation Deck</h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400">PDF, PNG, JPG</span>
                </div>

                <label className="border-2 border-dashed border-slate-300 hover:border-blue-500/60 bg-white/70 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-blue-500/5 group">
                  <UploadCloud className="w-10 h-10 text-slate-400 group-hover:text-blue-500 transition-colors mb-2" />
                  <span className="text-sm font-semibold text-slate-700">Click or Drag & Drop PDF / PPT file here</span>
                  <span className="text-xs text-slate-400 mt-1">Converts all PDF pages into presentation slides automatically</span>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                {isUploading && (
                  <div className="text-xs text-blue-600 font-mono font-medium animate-pulse text-center">
                    {uploadStatus}
                  </div>
                )}
              </div>

              {/* Presentation Deck Selection */}
              <div className="glass-card-light p-5 space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Select Presentation Deck to Project
                </label>

                <select
                  value={selectedDeck}
                  onChange={(e) => setSelectedDeck(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-medium"
                >
                  {customDecks.map(deck => (
                    <option key={deck.id} value={deck.id}>
                      📂 {deck.title} ({deck.slides.length} Slides - Custom Upload)
                    </option>
                  ))}
                  {SAMPLE_DECKS.map(deck => (
                    <option key={deck.id} value={deck.id}>
                      ✨ {deck.title} ({deck.slides.length} Slides)
                    </option>
                  ))}
                </select>
              </div>

              {/* Launch Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href={`/present?room=${activeRoom}&user=${username}&deck=${selectedDeck}`}
                  className="flex-1 glass-button-primary p-4 text-center font-bold text-white flex items-center justify-center space-x-3 text-base shadow-lg shadow-blue-500/25"
                >
                  <Tv className="w-5 h-5 text-white" />
                  <span>Launch Host Screen</span>
                  <ArrowRight className="w-4 h-4 ml-auto" />
                </Link>

                <Link
                  href={`/remote?room=${activeRoom}&user=${username}&deck=${selectedDeck}`}
                  className="flex-1 glass-button-light p-4 text-center font-bold text-[#1C1C1E] flex items-center justify-center space-x-3 text-base"
                >
                  <Smartphone className="w-5 h-5 text-blue-600" />
                  <span>Launch Controller</span>
                  <ArrowRight className="w-4 h-4 ml-auto" />
                </Link>
              </div>
            </div>

            {/* Right Column: QR Code Connect */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="w-full max-w-sm glass-panel-light p-6 rounded-3xl text-center space-y-5 shadow-xl border border-slate-200">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600">
                  <Smartphone className="w-6 h-6" />
                </div>

                <div>
                  <h3 className="text-xl font-bold text-[#1C1C1E]">Scan QR to Connect Mobile</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Room Code: <strong className="text-blue-600 font-mono">{activeRoom}</strong>
                  </p>
                </div>

                <div className="p-4 bg-white rounded-2xl mx-auto w-fit shadow-md border border-slate-200">
                  {remoteUrl && (
                    <QRCodeSVG
                      value={remoteUrl}
                      size={170}
                      level="H"
                    />
                  )}
                </div>

                <div className="text-[11px] text-slate-500 font-mono bg-slate-100 p-2.5 rounded-xl border border-slate-200 truncate">
                  {remoteUrl}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Minimal Footer */}
      <footer className="max-w-6xl mx-auto w-full pt-6 border-t border-slate-200 text-center text-xs text-slate-400 z-10">
        AuraSync Presentation System • Apple Minimal Liquid Glass Edition
      </footer>
    </div>
  );
}
