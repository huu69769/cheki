import type { Draft, DraftMeta, DraftStore } from '../types';

/**
 * IndexedDB に下書きを保存する（端末の中だけ。外部には送らない）。
 * 編集内容（docs）と元の写真（sources）を別々に持つので、
 * 編集のたびに大きな写真を書き直さずに済む。
 */

const DB_NAME = 'instant-film-drafts';
const DB_VERSION = 1;
const DOCS = 'docs';
const SOURCES = 'sources';

interface DocRow {
  id: string;
  kind: Draft['kind'];
  updatedAt: number;
  doc: unknown;
}

interface SourceRow {
  id: string;
  blob: Blob;
  name: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('この環境では下書きを保存できません'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DOCS)) db.createObjectStore(DOCS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(SOURCES)) db.createObjectStore(SOURCES, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error('下書きの保存場所を開けませんでした'));
    };
  });
  return dbPromise;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error ?? req.error);
        tx.onabort = () => reject(tx.error ?? new Error('下書きの保存に失敗しました'));
      }),
  );
}

export const webDraftStore: DraftStore = {
  async saveDoc(id, kind, doc) {
    const row: DocRow = { id, kind, updatedAt: Date.now(), doc };
    await run(DOCS, 'readwrite', (s) => s.put(row));
  },

  async saveSource(id, blob, name) {
    // Safari では File をそのまま入れると失敗することがあるので Blob にしてから保存する
    const plain = new Blob([blob], { type: blob.type });
    const row: SourceRow = { id, blob: plain, name };
    await run(SOURCES, 'readwrite', (s) => s.put(row));
  },

  async load(id) {
    const [doc, src] = await Promise.all([
      run<DocRow | undefined>(DOCS, 'readonly', (s) => s.get(id) as IDBRequest<DocRow | undefined>),
      run<SourceRow | undefined>(SOURCES, 'readonly', (s) => s.get(id) as IDBRequest<SourceRow | undefined>),
    ]);
    if (!doc || !src) return null;
    return { id, kind: doc.kind, updatedAt: doc.updatedAt, doc: doc.doc, source: src.blob, sourceName: src.name };
  },

  async list() {
    const rows = await run<DocRow[]>(DOCS, 'readonly', (s) => s.getAll() as IDBRequest<DocRow[]>);
    return rows
      .map<DraftMeta>((r) => ({ id: r.id, kind: r.kind, updatedAt: r.updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async remove(id) {
    await run(DOCS, 'readwrite', (s) => s.delete(id));
    await run(SOURCES, 'readwrite', (s) => s.delete(id));
  },
};
