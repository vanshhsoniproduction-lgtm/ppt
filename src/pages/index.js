import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  Trash2,
  Play,
  LogOut,
  User,
  Radio,
  Users,
  X,
  StopCircle,
  ExternalLink,
  Smartphone,
  Calendar,
  ArrowRight,
  Loader2,
  Eye,
  Edit3,
  CheckCircle2,
  Monitor,
} from 'lucide-react';
import { processPdfFile, processImageFiles } from '../utils/pdfProcessor';

export default function Dashboard() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Decks from server
  const [decks, setDecks] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // Sessions from server
  const [activeSessions, setActiveSessions] = useState([]);

  // Modals
  const [previewDeck, setPreviewDeck] = useState(null);
  const [editingNotes, setEditingNotes] = useState(null); // { deckId, deckTitle, notes, slideCount }

  // QR display
  const [qrSession, setQrSession] = useState(null); // { sessionId, deckTitle }

  // ── Auth ──
  useEffect(() => {
    const saved = localStorage.getItem('deckcast_user');
    if (saved) {
      setUsername(saved);
      setIsLoggedIn(true);
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    const clean = username.trim().toLowerCase();
    if (!clean) return;
    setUsername(clean);
    localStorage.setItem('deckcast_user', clean);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('deckcast_user');
    setUsername('');
    setIsLoggedIn(false);
    setDecks([]);
    setActiveSessions([]);
  };

  // ── Fetch data from server ──
  const fetchDecks = useCallback(async () => {
    if (!username) return;
    try {
      const res = await fetch(`/api/decks?owner=${username}`);
      const data = await res.json();
      setDecks(data);
    } catch (e) {
      console.error('Failed to fetch decks:', e);
    }
  }, [username]);

  const fetchSessions = useCallback(async () => {
    if (!username) return;
    try {
      const res = await fetch(`/api/sessions?owner=${username}`);
      const data = await res.json();
      setActiveSessions(data);
    } catch (e) {
      console.error('Failed to fetch sessions:', e);
    }
  }, [username]);

  useEffect(() => {
    if (isLoggedIn && username) {
      fetchDecks();
      fetchSessions();
      // Poll sessions every 5s for live client count
      const interval = setInterval(fetchSessions, 5000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, username, fetchDecks, fetchSessions]);

  // ── Upload ──
  const handleFileUpload = async (e) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    // Snapshot FileList into a regular Array BEFORE resetting input
    // (FileList is a live DOM object — resetting input empties it)
    const files = Array.from(fileList);
    const file = files[0];
    e.target.value = ''; // Now safe to reset

    setIsUploading(true);
    setUploadProgress('Processing file...');

    try {
      let slides = [];
      let title = file.name.replace(/\.[^/.]+$/, '');

      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        // Client-side PDF → JPEG conversion
        const deck = await processPdfFile(file, username, (p, t) => {
          setUploadProgress(`Converting page ${p} of ${t}...`);
        });
        slides = deck.slides.map(s => s.image);
        title = deck.title;
      } else {
        // Image files
        const deck = await processImageFiles(files, username);
        slides = deck.slides.map(s => s.image);
        title = deck.title;
      }

      setUploadProgress('Uploading to server...');

      // Upload processed slides to server
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          owner: username,
          slides,
          notes: slides.map((_, i) => `Speaker notes for slide ${i + 1}`),
        }),
      });

      if (!res.ok) throw new Error('Upload failed');

      const result = await res.json();
      setUploadProgress(`"${result.title}" uploaded — ${result.slideCount} slides`);
      await fetchDecks();
    } catch (err) {
      console.error(err);
      setUploadProgress('Upload failed. Please try again.');
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress('');
      }, 2500);
    }
  };

  // ── Create Session ──
  const handleCreateSession = async (deckId) => {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deckId, owner: username }),
      });

      if (!res.ok) throw new Error('Failed to create session');

      const session = await res.json();
      setQrSession({ sessionId: session.id, deckTitle: session.deckTitle, totalSlides: session.totalSlides });
      await fetchSessions();
    } catch (err) {
      console.error(err);
    }
  };

  // ── End Session ──
  const handleEndSession = async (sessionId) => {
    try {
      await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      await fetchSessions();
      if (qrSession && qrSession.sessionId === sessionId) setQrSession(null);
    } catch (err) {
      console.error(err);
    }
  };

  // ── Delete Deck ──
  const handleDeleteDeck = async (deckId) => {
    if (!confirm('Delete this presentation?')) return;
    try {
      await fetch(`/api/decks/${deckId}`, { method: 'DELETE' });
      await fetchDecks();
      await fetchSessions();
    } catch (err) {
      console.error(err);
    }
  };

  // ── Save Note ──
  const handleSaveNote = async (deckId, slideIndex, note) => {
    try {
      await fetch(`/api/decks/${deckId}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slideIndex, note }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  // ── Open Notes Editor ──
  const handleOpenNotes = async (deck) => {
    try {
      const res = await fetch(`/api/decks/${deck.id}`);
      const data = await res.json();
      setEditingNotes({
        deckId: deck.id,
        deckTitle: deck.title,
        notes: data.notes || [],
        slideCount: data.slideCount,
      });
    } catch (err) {
      console.error(err);
    }
  };

  // ── Date grouping ──
  const groupByDate = (items) => {
    const groups = { Today: [], Yesterday: [], Earlier: [] };
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    items.forEach(item => {
      const d = new Date(item.uploadDate).toDateString();
      if (d === today) groups.Today.push(item);
      else if (d === yesterday) groups.Yesterday.push(item);
      else groups.Earlier.push(item);
    });

    return groups;
  };

  const grouped = groupByDate(decks);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  // ── RENDER ──

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm dc-panel p-8 space-y-6 text-center"
        >
          <div className="space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--dc-blue)] flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-blue-500/20">
              D
            </div>
            <h1 className="text-2xl font-bold tracking-tight">DeckCast</h1>
            <p className="text-sm text-[var(--dc-text-secondary)]">
              Real-time presentation control
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
              className="dc-input"
              autoFocus
            />
            <button type="submit" className="dc-btn dc-btn-primary w-full py-3 text-sm">
              Get Started
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 dc-panel border-b border-[var(--dc-border)] rounded-none px-4 md:px-8 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[var(--dc-blue)] flex items-center justify-center text-white text-sm font-bold">
              D
            </div>
            <h1 className="text-base font-bold tracking-tight hidden sm:block">DeckCast</h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="dc-badge dc-badge-live">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              @{username}
            </div>
            <button onClick={handleLogout} className="dc-btn dc-btn-ghost text-xs">
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 md:px-8 py-6 space-y-8">

        {/* Active Sessions */}
        {activeSessions.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-green-600" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--dc-text-secondary)]">
                Live Sessions
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeSessions.map(session => (
                <div key={session.id} className="dc-card p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="text-xs font-mono font-bold text-[var(--dc-blue)] tracking-wider">
                        {session.id}
                      </div>
                      <div className="text-sm font-semibold truncate mt-0.5">{session.deckTitle}</div>
                      <div className="text-xs text-[var(--dc-text-secondary)] mt-0.5">
                        Slide {session.currentSlide + 1}/{session.totalSlides} • {session.connectedClients} connected
                      </div>
                    </div>
                    <div className="dc-badge dc-badge-live flex-shrink-0">Live</div>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/present/${session.id}`}
                      className="dc-btn dc-btn-primary flex-1 text-xs py-2"
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      Host
                    </Link>
                    <button
                      onClick={() => setQrSession({ sessionId: session.id, deckTitle: session.deckTitle, totalSlides: session.totalSlides })}
                      className="dc-btn dc-btn-secondary text-xs py-2"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      QR
                    </button>
                    <button
                      onClick={() => handleEndSession(session.id)}
                      className="dc-btn dc-btn-danger text-xs py-2"
                    >
                      <StopCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Upload */}
        <section className="dc-panel p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Upload className="w-4 h-4 text-[var(--dc-blue)]" />
              Upload Presentation
            </h2>
            <span className="text-xs text-[var(--dc-text-secondary)]">PDF or Images</span>
          </div>

          <label className="flex flex-col items-center justify-center border-2 border-dashed border-[rgba(0,0,0,0.1)] hover:border-[var(--dc-blue)] bg-[rgba(0,0,0,0.01)] hover:bg-[rgba(0,113,227,0.02)] rounded-2xl p-8 cursor-pointer transition-all group">
            <Upload className="w-8 h-8 text-[var(--dc-text-secondary)] group-hover:text-[var(--dc-blue)] transition-colors mb-2" />
            <span className="text-sm font-semibold">Drop file or click to browse</span>
            <span className="text-xs text-[var(--dc-text-secondary)] mt-1">PDF, PNG, JPG — converted to HD slides</span>
            <input
              type="file"
              accept=".pdf,image/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {(isUploading || uploadProgress) && (
            <div className="flex items-center justify-center gap-2 text-xs font-medium text-[var(--dc-blue)]">
              {isUploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {uploadProgress}
            </div>
          )}
        </section>

        {/* My Decks */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-[var(--dc-blue)]" />
              My Presentations
            </h2>
            <span className="text-xs text-[var(--dc-text-secondary)]">{decks.length} files</span>
          </div>

          {decks.length === 0 ? (
            <div className="dc-card p-10 text-center space-y-2">
              <FileText className="w-8 h-8 text-[var(--dc-text-secondary)] mx-auto" />
              <p className="text-sm font-medium text-[var(--dc-text-secondary)]">
                No presentations yet. Upload a PDF to get started.
              </p>
            </div>
          ) : (
            Object.entries(grouped).map(([label, items]) =>
              items.length > 0 && (
                <div key={label} className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--dc-text-secondary)] pl-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {label}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {items.map(deck => (
                      <div key={deck.id} className="dc-card p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          {/* Thumbnail */}
                          <div className="w-20 h-14 rounded-lg bg-black/90 overflow-hidden flex-shrink-0 flex items-center justify-center border border-[var(--dc-border)]">
                            {deck.thumbnail ? (
                              <img src={deck.thumbnail} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <FileText className="w-5 h-5 text-slate-500" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold truncate">{deck.title}</h3>
                            <p className="text-xs text-[var(--dc-text-secondary)] mt-0.5">{deck.slideCount} slides</p>
                            <p className="text-[10px] text-[var(--dc-text-secondary)] mt-1 font-mono">
                              {new Date(deck.uploadDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-[var(--dc-border)]">
                          <button
                            onClick={() => handleCreateSession(deck.id)}
                            className="dc-btn dc-btn-primary flex-1 text-xs py-2"
                          >
                            <Play className="w-3.5 h-3.5" />
                            Present
                          </button>

                          <button
                            onClick={() => setPreviewDeck(deck)}
                            className="dc-btn dc-btn-secondary text-xs py-2"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleOpenNotes(deck)}
                            className="dc-btn dc-btn-secondary text-xs py-2"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteDeck(deck.id)}
                            className="dc-btn dc-btn-ghost text-xs py-2 text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )
          )}
        </section>
      </main>

      {/* ── QR Code Modal ── */}
      <AnimatePresence>
        {qrSession && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setQrSession(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="dc-panel p-8 max-w-sm w-full text-center space-y-5"
              onClick={e => e.stopPropagation()}
            >
              <div className="space-y-1">
                <div className="text-2xl font-mono font-bold tracking-widest text-[var(--dc-blue)]">
                  {qrSession.sessionId}
                </div>
                <div className="text-sm font-semibold truncate">{qrSession.deckTitle}</div>
                <div className="text-xs text-[var(--dc-text-secondary)]">
                  Scan to control from your phone
                </div>
              </div>

              <div className="p-5 bg-white rounded-2xl mx-auto w-fit shadow-sm border border-[var(--dc-border)]">
                <QRCodeSVG
                  value={`${baseUrl}/control/${qrSession.sessionId}`}
                  size={180}
                  level="H"
                />
              </div>

              <div className="space-y-2">
                <Link
                  href={`/present/${qrSession.sessionId}`}
                  className="dc-btn dc-btn-primary w-full py-3 text-sm"
                >
                  <Monitor className="w-4 h-4" />
                  Open Host Screen
                </Link>

                <button onClick={() => setQrSession(null)} className="dc-btn dc-btn-secondary w-full text-xs py-2.5">
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Slide Preview Modal ── */}
      <AnimatePresence>
        {previewDeck && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPreviewDeck(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="dc-panel p-6 max-w-4xl w-full max-h-[85vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 border-b border-[var(--dc-border)]">
                <div>
                  <h3 className="text-base font-bold">{previewDeck.title}</h3>
                  <p className="text-xs text-[var(--dc-text-secondary)]">{previewDeck.slideCount} slides</p>
                </div>
                <button onClick={() => setPreviewDeck(null)} className="dc-btn dc-btn-ghost p-2">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {Array.from({ length: previewDeck.slideCount }).map((_, i) => (
                  <div key={i} className="dc-card p-1.5 text-center space-y-1">
                    <div className="aspect-[16/10] bg-black rounded-lg overflow-hidden">
                      <img
                        src={`/api/slides/${previewDeck.id}/${i}`}
                        alt={`Slide ${i + 1}`}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    </div>
                    <span className="text-[10px] font-mono text-[var(--dc-text-secondary)]">{i + 1}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-[var(--dc-border)] flex justify-between items-center">
                <button onClick={() => { setPreviewDeck(null); handleCreateSession(previewDeck.id); }} className="dc-btn dc-btn-primary text-xs">
                  <Play className="w-3.5 h-3.5" />
                  Present Now
                </button>
                <button onClick={() => setPreviewDeck(null)} className="dc-btn dc-btn-secondary text-xs">
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Notes Editor Modal ── */}
      <AnimatePresence>
        {editingNotes && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditingNotes(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="dc-panel p-6 max-w-3xl w-full max-h-[85vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 border-b border-[var(--dc-border)]">
                <div>
                  <h3 className="text-base font-bold">Speaker Notes — {editingNotes.deckTitle}</h3>
                  <p className="text-xs text-[var(--dc-text-secondary)]">Visible only to you on the mobile controller</p>
                </div>
                <button onClick={() => setEditingNotes(null)} className="dc-btn dc-btn-ghost p-2">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-4">
                {Array.from({ length: editingNotes.slideCount }).map((_, i) => (
                  <div key={i} className="dc-card p-4 flex flex-col sm:flex-row gap-4 items-start">
                    <div className="w-32 aspect-[16/10] bg-black rounded-lg overflow-hidden flex-shrink-0 border border-[var(--dc-border)]">
                      <img
                        src={`/api/slides/${editingNotes.deckId}/${i}`}
                        alt={`Slide ${i + 1}`}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex-1 w-full space-y-1">
                      <label className="text-xs font-semibold text-[var(--dc-text-secondary)]">
                        Slide {i + 1}
                      </label>
                      <textarea
                        rows={2}
                        defaultValue={editingNotes.notes[i] || ''}
                        onBlur={(e) => handleSaveNote(editingNotes.deckId, i, e.target.value)}
                        placeholder="Add speaker notes..."
                        className="dc-input text-xs py-2 resize-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-[var(--dc-border)] flex justify-end">
                <button onClick={() => setEditingNotes(null)} className="dc-btn dc-btn-primary text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="text-center text-xs text-[var(--dc-text-secondary)] py-4 border-t border-[var(--dc-border)]">
        DeckCast — Real-Time Presentation Platform
      </footer>
    </div>
  );
}
