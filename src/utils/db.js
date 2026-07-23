// Enterprise IndexedDB Storage Helper for PPT/PDF Decks and Per-Slide Speaker Notes

const DB_NAME = 'AuraSyncPPT_DB';
const DB_VERSION = 1;
const STORE_DECKS = 'decks';

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve(null);
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_DECKS)) {
        const store = db.createObjectStore(STORE_DECKS, { keyPath: 'id' });
        store.createIndex('username', 'username', { unique: false });
        store.createIndex('uploadDate', 'uploadDate', { unique: false });
      }
    };

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function saveDeckToDB(deck) {
  const db = await openDB();
  if (!db) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DECKS, 'readwrite');
    const store = tx.objectStore(STORE_DECKS);
    const item = {
      ...deck,
      uploadDate: deck.uploadDate || new Date().toISOString(),
    };
    const req = store.put(item);
    req.onsuccess = () => resolve(item);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function getUserDecksFromDB(username) {
  const db = await openDB();
  if (!db) return [];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DECKS, 'readonly');
    const store = tx.objectStore(STORE_DECKS);
    const index = store.index('username');
    const req = index.getAll(username.toLowerCase());

    req.onsuccess = () => {
      const items = req.result || [];
      // Sort by uploadDate descending (newest first)
      items.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
      resolve(items);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function getDeckByIdFromDB(deckId) {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DECKS, 'readonly');
    const store = tx.objectStore(STORE_DECKS);
    const req = store.get(deckId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function updateSlideNoteInDB(deckId, slideIndex, noteText) {
  const db = await openDB();
  if (!db) return;
  const deck = await getDeckByIdFromDB(deckId);
  if (!deck || !deck.slides || !deck.slides[slideIndex]) return;

  deck.slides[slideIndex].notes = noteText;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DECKS, 'readwrite');
    const store = tx.objectStore(STORE_DECKS);
    const req = store.put(deck);
    req.onsuccess = () => resolve(deck);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function deleteDeckFromDB(deckId) {
  const db = await openDB();
  if (!db) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DECKS, 'readwrite');
    const store = tx.objectStore(STORE_DECKS);
    const req = store.delete(deckId);
    req.onsuccess = () => resolve(true);
    req.onerror = (e) => reject(e.target.error);
  });
}
