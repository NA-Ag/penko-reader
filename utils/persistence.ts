import { BookMeta, StoredBook } from '../types';

/**
 * IndexedDB layout (v2):
 *   meta    – BookMeta records (small; loaded at startup for the library)
 *   content – { id, content } records (large; loaded only when a book is opened)
 * v1 stored everything in a single `books` store; it is migrated on upgrade.
 */
const DB_NAME = 'PenkoReaderDB';
const DB_VERSION = 2;
const META = 'meta';
const CONTENT = 'content';
const LEGACY = 'books';

interface ContentRecord { id: string; content: string }

let dbPromise: Promise<IDBDatabase> | null = null;

export const splitBook = (book: StoredBook | BookMeta): { meta: BookMeta; content?: string } => {
  const { content, ...meta } = book as StoredBook;
  return { meta, content };
};

const openDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      const tx = request.transaction!;
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(CONTENT)) db.createObjectStore(CONTENT, { keyPath: 'id' });

      if (db.objectStoreNames.contains(LEGACY)) {
        // Migrate inside the versionchange transaction using only IDB callbacks,
        // so the transaction stays alive until the copy is complete.
        const metaStore = tx.objectStore(META);
        const contentStore = tx.objectStore(CONTENT);
        const cursorReq = tx.objectStore(LEGACY).openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor) {
            const value = cursor.value as StoredBook;
            if (value && value.id) {
              const { meta, content } = splitBook(value);
              metaStore.put(meta);
              contentStore.put({ id: meta.id, content: content ?? '' } satisfies ContentRecord);
            }
            cursor.continue();
          } else {
            db.deleteObjectStore(LEGACY);
          }
        };
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      db.onclose = () => { dbPromise = null; };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
    request.onblocked = () => {
      console.warn('Penko Reader database upgrade is waiting for other open tabs to close.');
    };
  });
  return dbPromise;
};

/** Run one request in its own transaction. */
const run = <T,>(store: string, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
  openDB().then(db => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = op(tx.objectStore(store));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error || req.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  }));

/** Run writes across both stores atomically. */
const writeBoth = (fn: (meta: IDBObjectStore, content: IDBObjectStore) => void): Promise<void> =>
  openDB().then(db => new Promise<void>((resolve, reject) => {
    const tx = db.transaction([META, CONTENT], 'readwrite');
    fn(tx.objectStore(META), tx.objectStore(CONTENT));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  }));

export const loadAllMeta = (): Promise<BookMeta[]> => run(META, 'readonly', s => s.getAll() as IDBRequest<BookMeta[]>);

export const loadMeta = (id: string): Promise<BookMeta | undefined> =>
  run(META, 'readonly', s => s.get(id) as IDBRequest<BookMeta | undefined>);

export const loadContent = (id: string): Promise<string | undefined> =>
  run(CONTENT, 'readonly', s => s.get(id) as IDBRequest<ContentRecord | undefined>).then(r => r?.content);

/** Write only the small metadata record (content is never touched). */
export const saveMeta = (book: BookMeta | StoredBook): Promise<void> =>
  run(META, 'readwrite', s => s.put(splitBook(book).meta)).then(() => undefined);

/** Write several metadata records in one transaction. */
export const saveMetaMany = (books: BookMeta[]): Promise<void> =>
  openDB().then(db => new Promise<void>((resolve, reject) => {
    if (books.length === 0) return resolve();
    const tx = db.transaction(META, 'readwrite');
    const store = tx.objectStore(META);
    books.forEach(b => store.put(splitBook(b).meta));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  }));

export const saveBookWithContent = (book: StoredBook): Promise<void> =>
  writeBoth((metaStore, contentStore) => {
    const { meta, content } = splitBook(book);
    metaStore.put(meta);
    contentStore.put({ id: meta.id, content: content ?? '' } satisfies ContentRecord);
  });

export const saveBooksWithContent = (books: StoredBook[]): Promise<void> =>
  writeBoth((metaStore, contentStore) => {
    for (const book of books) {
      const { meta, content } = splitBook(book);
      metaStore.put(meta);
      contentStore.put({ id: meta.id, content: content ?? '' } satisfies ContentRecord);
    }
  });

export const deleteBook = (id: string): Promise<void> =>
  writeBoth((metaStore, contentStore) => {
    metaStore.delete(id);
    contentStore.delete(id);
  });

/** Every book with its content (used for backup export). */
export const loadAllBooks = async (): Promise<StoredBook[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([META, CONTENT], 'readonly');
    const metaReq = tx.objectStore(META).getAll() as IDBRequest<BookMeta[]>;
    const contentReq = tx.objectStore(CONTENT).getAll() as IDBRequest<ContentRecord[]>;
    tx.oncomplete = () => {
      const byId = new Map(contentReq.result.map(c => [c.id, c.content]));
      resolve(metaReq.result.map(m => ({ ...m, content: byId.get(m.id) ?? '' })));
    };
    tx.onerror = () => reject(tx.error);
  });
};
