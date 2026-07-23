import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import {
  Tv,
  Smartphone,
  Sparkles,
  UploadCloud,
  User,
  FileText,
  Trash2,
  Eye,
  Edit3,
  Play,
  ArrowRight,
  LogOut,
  Calendar,
  X,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { processPdfFile, processImageFiles } from '../utils/pdfProcessor';
import { getUserDecksFromDB, saveDeckToDB, deleteDeckFromDB, updateSlideNoteInDB } from '../utils/db';

export default function Home() {
  const [username, setUsername] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userDecks, setUserDecks] = useState([]);
  const [socket, setSocket] = useState(null);

  // Active Presentation Session State
  const [activeDeck, setActiveDeck] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // Modals
  const [editingDeck, setEditingDeck] = useState(null);
  const [previewDeck, setPreviewDeck] = useState(null);

  const [remoteUrl, setRemoteUrl] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('ppt_username');
    if (savedUser) {
      setUsername(savedUser);
      setIsLoggedIn(true);
      loadUserDecks(savedUser);
    }
  }, []);

  const loadUserDecks = async (user) => {
    try {
      const decks = await getUserDecksFromDB(user);
      setUserDecks(decks);
      if (decks.length > 0 && !activeDeck) {
        setActiveDeck(decks[0]);
      }
    } catch (e) {
      console.error('Failed to load user decks:', e);
    }
  };

  // MULTI-DEVICE WORKSPACE SOCKET SYNC
  useEffect(() => {
    if (isLoggedIn && username) {
      const roomParam = username.toUpperCase() + '-ROOM';
      const newSocket = io();
      setSocket(newSocket);

      newSocket.on('connect', () => {
        newSocket.emit('join-room', { roomId: roomParam, role: 'dashboard' });
      });

      // When another device uploads or syncs a deck
      newSocket.on('room-state', async (state) => {
        if (state.customDeck) {
          await saveDeckToDB(state.customDeck);
          await loadUserDecks(username);
          setActiveDeck(state.customDeck);
        }
      });

      newSocket.on('deck-uploaded', async (data) => {
        if (data.deck) {
          await saveDeckToDB(data.deck);
          await loadUserDecks(username);
          setActiveDeck(data.deck);
        }
      });

      newSocket.on('client-joined', () => {
        // If local device has an active deck, broadcast to room so new devices get files
        if (activeDeck) {
          newSocket.emit('upload-deck', { deck: activeDeck });
        }
      });

      return () => {
        newSocket.disconnect();
      };
    }
  }, [isLoggedIn, username]);

  // DYNAMIC QR CODE URL GENERATION
  useEffect(() => {
    if (typeof window !== 'undefined' && isLoggedIn && username) {
      const origin = window.location.origin;
      const room = username.toUpperCase() + '-ROOM';
      const deckParam = activeDeck ? `&deck=${activeDeck.id}` : '';
      setRemoteUrl(`${origin}/remote?room=${room}&user=${username}${deckParam}`);
    }
  }, [username, isLoggedIn, activeDeck]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (username.trim()) {
      const cleanUser = username.trim().toLowerCase();
      setUsername(cleanUser);
      localStorage.setItem('ppt_username', cleanUser);
      setIsLoggedIn(true);
      await loadUserDecks(cleanUser);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ppt_username');
    setUsername('');
    setIsLoggedIn(false);
    setUserDecks([]);
    setActiveDeck(null);
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress('Reading presentation pages...');

    try {
      const file = files[0];
      let newDeck = null;

      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        newDeck = await processPdfFile(file, username, (p, t) => {
          setUploadProgress(`Optimizing page ${p} of ${t}...`);
        });
      } else {
        newDeck = await processImageFiles(files, username);
      }

      if (newDeck) {
        setActiveDeck(newDeck);
        await saveDeckToDB(newDeck);
        await loadUserDecks(username);

        // Broadcast to all devices connected to this username workspace
        if (socket) {
          socket.emit('upload-deck', { deck: newDeck });
        }

        setUploadProgress(`Successfully loaded & synced "${newDeck.title}"!`);
      }
    } catch (err) {
      console.error(err);
      setUploadProgress('Failed to read file. Please upload a valid PDF or Image slides.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDeck = async (deckId, e) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this presentation file?')) {
      await deleteDeckFromDB(deckId);
      if (activeDeck && activeDeck.id === deckId) {
        setActiveDeck(null);
      }
      await loadUserDecks(username);
    }
  };

  const handleSaveNote = async (deckId, slideIndex, noteText) => {
    await updateSlideNoteInDB(deckId, slideIndex, noteText);
    await loadUserDecks(username);
    if (editingDeck && editingDeck.id === deckId) {
      const updatedSlides = [...editingDeck.slides];
      updatedSlides[slideIndex].notes = noteText;
      const updatedDeck = { ...editingDeck, slides: updatedSlides };
      setEditingDeck(updatedDeck);
      if (socket) {
        socket.emit('upload-deck', { deck: updatedDeck });
      }
    }
  };

  const groupDecksByDate = (decks) => {
    const groups = { Today: [], Yesterday: [], Earlier: [] };
    const today = new Date().toDateString();

    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toDateString();

    decks.forEach(deck => {
      const deckDate = new Date(deck.uploadDate).toDateString();
      if (deckDate === today) {
        groups.Today.push(deck);
      } else if (deckDate === yesterday) {
        groups.Yesterday.push(deck);
      } else {
        groups.Earlier.push(deck);
      }
    });

    return groups;
  };

  const groupedDecks = groupDecksByDate(userDecks);
  const activeRoom = (username ? username.toUpperCase() + '-ROOM' : 'DEMO').trim();

  return (
    <div className="min-h-screen bg-[#F2F2F7] text-[#1C1C1E] relative flex flex-col justify-between p-4 md:p-8">
      {/* Header */}
      <header className="max-w-7xl mx-auto w-full flex items-center justify-between z-10 py-2 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-bold text-lg">
            A
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-[#1C1C1E] leading-none">
              AuraSync Enterprise
            </h1>
            <span className="text-xs text-slate-500 font-medium">Real-Time PDF & PPT Presentation Platform</span>
          </div>
        </div>

        {isLoggedIn && (
          <div className="flex items-center space-x-3">
            <div className="px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-800 shadow-sm flex items-center space-x-2">
              <User className="w-3.5 h-3.5 text-blue-600" />
              <span>@{username}</span>
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-full bg-slate-200/80 hover:bg-slate-300/80 text-xs font-semibold text-slate-700 transition-colors flex items-center space-x-1"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto w-full my-auto py-6 z-10 flex-1">
        {!isLoggedIn ? (
          /* Step 1: User Login */
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto glass-panel-light p-8 text-center space-y-6 shadow-xl border border-white"
          >
            <div className="w-16 h-16 mx-auto rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600">
              <User className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-2xl font-extrabold text-[#1C1C1E]">Enter your Username</h2>
              <p className="text-xs text-slate-500 mt-1">
                Creates your personal enterprise presentation workspace.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. vansh"
                className="w-full bg-white border border-slate-300 rounded-2xl px-5 py-3.5 text-base text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-blue-500/40 shadow-sm font-medium"
              />

              <button
                type="submit"
                className="w-full glass-button-primary py-3.5 text-base font-bold flex items-center justify-center space-x-2 shadow-md shadow-blue-500/30"
              >
                <span>Access Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        ) : (
          /* Step 2: Dashboard Workspace */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Section: Upload & My Files Section */}
            <div className="lg:col-span-8 space-y-6">
              {/* Upload Drop Zone */}
              <div className="glass-panel-light p-6 space-y-4 border border-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <UploadCloud className="w-5 h-5 text-blue-600" />
                    <h3 className="text-base font-bold text-[#1C1C1E]">Upload Presentation (PDF / Images)</h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400">PDF, PNG, JPG</span>
                </div>

                <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white/80 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-blue-500/5 group">
                  <UploadCloud className="w-10 h-10 text-slate-400 group-hover:text-blue-600 transition-colors mb-2" />
                  <span className="text-sm font-bold text-slate-800">Drop PDF or PPT Presentation File</span>
                  <span className="text-xs text-slate-500 mt-1">Converts all PDF pages into high-definition presentation slides</span>
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
                    {uploadProgress}
                  </div>
                )}
              </div>

              {/* "My Files" Section Organized Date-wise */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-extrabold text-[#1C1C1E] flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span>My Files Library</span>
                  </h3>
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-mono text-slate-500">{userDecks.length} Files Syncing</span>
                    <button
                      onClick={() => loadUserDecks(username)}
                      className="p-1 rounded-full text-slate-400 hover:text-blue-600 hover:bg-white"
                      title="Sync Files"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {userDecks.length === 0 ? (
                  <div className="glass-card-light p-8 text-center text-slate-500 space-y-2 border border-slate-200">
                    <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-sm font-medium">No presentation files synced on this device yet.</p>
                    <p className="text-xs text-slate-400">Upload a PDF or scan the QR code to sync presentation files across PC and Phone.</p>
                  </div>
                ) : (
                  Object.entries(groupedDecks).map(([groupName, decks]) => (
                    decks.length > 0 && (
                      <div key={groupName} className="space-y-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5 pl-1">
                          <Calendar className="w-3.5 h-3.5 text-blue-600" />
                          <span>{groupName}</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {decks.map(deck => {
                            const isSelected = activeDeck && activeDeck.id === deck.id;
                            const firstSlideImg = deck.slides && deck.slides[0] ? deck.slides[0].image : null;

                            return (
                              <div
                                key={deck.id}
                                onClick={() => {
                                  setActiveDeck(deck);
                                  if (socket) socket.emit('upload-deck', { deck });
                                }}
                                className={`glass-card-light p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${isSelected ? 'border-blue-500 bg-white ring-2 ring-blue-500/20 shadow-md' : 'border-slate-200 hover:border-slate-300'}`}
                              >
                                <div className="flex items-start space-x-3">
                                  {/* Slide Thumbnail */}
                                  <div className="w-20 h-14 rounded-xl bg-slate-900 overflow-hidden border border-slate-200 flex-shrink-0 flex items-center justify-center">
                                    {firstSlideImg ? (
                                      <img src={firstSlideImg} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                      <FileText className="w-6 h-6 text-slate-400" />
                                    )}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-bold text-[#1C1C1E] truncate">{deck.title}</h4>
                                    <p className="text-xs text-slate-500 mt-0.5">{deck.slides ? deck.slides.length : 1} Slides</p>
                                    <p className="text-[10px] text-slate-400 font-mono mt-1">
                                      Uploaded {new Date(deck.uploadDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
                                  <Link
                                    href={`/present?room=${activeRoom}&user=${username}&deck=${deck.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex-1 glass-button-primary py-1.5 text-xs font-bold flex items-center justify-center space-x-1"
                                  >
                                    <Play className="w-3.5 h-3.5 fill-current" />
                                    <span>Present</span>
                                  </Link>

                                  <button
                                    onClick={(e) => { e.stopPropagation(); setPreviewDeck(deck); }}
                                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 flex items-center space-x-1"
                                    title="View Slides"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-slate-600" />
                                    <span>View</span>
                                  </button>

                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEditingDeck(deck); }}
                                    className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-xs font-medium text-blue-700 flex items-center space-x-1"
                                    title="Edit Notes"
                                  >
                                    <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Notes</span>
                                  </button>

                                  <button
                                    onClick={(e) => handleDeleteDeck(deck.id, e)}
                                    className="p-1.5 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )
                  ))
                )}
              </div>
            </div>

            {/* Right Section: Selected Deck QR Code & Live Link Launch */}
            <div className="lg:col-span-4 flex flex-col items-center">
              <div className="w-full max-w-sm glass-panel-light p-6 rounded-3xl text-center space-y-5 shadow-xl border border-white">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
                  <Smartphone className="w-6 h-6" />
                </div>

                <div>
                  <h3 className="text-xl font-extrabold text-[#1C1C1E]">Scan QR for Mobile Control</h3>
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

                {activeDeck && (
                  <div className="bg-blue-50/80 p-3 rounded-2xl border border-blue-200/60 text-left space-y-1">
                    <span className="text-[10px] font-mono uppercase text-blue-600 font-bold">Selected Presentation</span>
                    <div className="text-xs font-bold text-[#1C1C1E] truncate">{activeDeck.title}</div>
                    <div className="text-[11px] text-slate-500">{activeDeck.slides ? activeDeck.slides.length : 1} Slides ready for projection</div>
                  </div>
                )}

                <div className="space-y-2">
                  {activeDeck && (
                    <Link
                      href={`/present?room=${activeRoom}&user=${username}&deck=${activeDeck.id}`}
                      className="w-full glass-button-primary p-3.5 text-center font-bold text-white flex items-center justify-center space-x-2 text-sm shadow-md shadow-blue-500/25"
                    >
                      <Tv className="w-4 h-4" />
                      <span>Launch Host Presentation</span>
                    </Link>
                  )}

                  <Link
                    href={`/remote?room=${activeRoom}&user=${username}${activeDeck ? `&deck=${activeDeck.id}` : ''}`}
                    className="w-full glass-button-light p-3 text-center font-bold text-[#1C1C1E] flex items-center justify-center space-x-2 text-xs"
                  >
                    <Smartphone className="w-4 h-4 text-blue-600" />
                    <span>Open Mobile Controller</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Slide Notes Editor Modal */}
      <AnimatePresence>
        {editingDeck && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-4xl max-h-[85vh] glass-panel-light bg-white p-6 rounded-3xl shadow-2xl flex flex-col justify-between overflow-hidden"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-lg font-extrabold text-[#1C1C1E]">
                    Edit Speaker Notes - {editingDeck.title}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Notes entered here display on your mobile controller during presentation
                  </p>
                </div>
                <button
                  onClick={() => setEditingDeck(null)}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Per-Slide Notes Editor List */}
              <div className="flex-1 overflow-y-auto py-4 space-y-4 max-h-[60vh]">
                {editingDeck.slides && editingDeck.slides.map((slideItem, idx) => (
                  <div key={idx} className="glass-card-light p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-4 items-start">
                    <div className="w-36 aspect-[16/10] bg-slate-900 rounded-xl overflow-hidden flex-shrink-0 border border-slate-300">
                      {slideItem.image ? (
                        <img src={slideItem.image} alt={`Slide ${idx + 1}`} className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                          Slide {idx + 1}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 w-full space-y-2">
                      <div className="flex justify-between items-center text-xs text-slate-500 font-bold">
                        <span>Slide {idx + 1} Speaker Notes:</span>
                      </div>
                      <textarea
                        rows={3}
                        defaultValue={slideItem.notes || ''}
                        onBlur={(e) => handleSaveNote(editingDeck.id, idx, e.target.value)}
                        placeholder="Add confidential presenter notes for this slide..."
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => setEditingDeck(null)}
                  className="glass-button-primary px-6 py-2 text-xs font-bold flex items-center space-x-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Done Editing Notes</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Slide Preview Grid Modal */}
      <AnimatePresence>
        {previewDeck && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-5xl max-h-[85vh] glass-panel-light bg-white p-6 rounded-3xl shadow-2xl flex flex-col justify-between overflow-hidden"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-lg font-extrabold text-[#1C1C1E]">{previewDeck.title}</h3>
                  <p className="text-xs text-slate-500">{previewDeck.slides ? previewDeck.slides.length : 1} Presentation Slides Preview</p>
                </div>
                <button
                  onClick={() => setPreviewDeck(null)}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[60vh]">
                {previewDeck.slides && previewDeck.slides.map((s, idx) => (
                  <div key={idx} className="glass-card-light p-2 rounded-xl border border-slate-200 space-y-1 text-center">
                    <div className="aspect-[16/10] bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
                      {s.image ? (
                        <img src={s.image} alt={`Slide ${idx + 1}`} className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-white text-xs font-bold">Slide {idx + 1}</span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 font-bold">Slide {idx + 1}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                <Link
                  href={`/present?room=${activeRoom}&user=${username}&deck=${previewDeck.id}`}
                  className="glass-button-primary px-6 py-2 text-xs font-bold flex items-center space-x-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Presentation Now</span>
                </Link>
                <button
                  onClick={() => setPreviewDeck(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="max-w-7xl mx-auto w-full pt-4 border-t border-slate-200 text-center text-xs text-slate-400">
        AuraSync Enterprise Presentation System • Minimal Apple iOS Style
      </footer>
    </div>
  );
}
