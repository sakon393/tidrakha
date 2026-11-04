// Keeps every item on this device, in IndexedDB. Nothing leaves the phone.
// Photos are stored as raw bytes: Blobs kept in IndexedDB can become unreadable on iOS.
(function (root) {
  const DB_NAME = 'tag-app';
  const ITEMS = 'items';
  const PHOTOS = 'photos';
  let opening = null;

  function open() {
    if (!opening) {
      opening = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore(ITEMS, { keyPath: 'id' });
          request.result.createObjectStore(PHOTOS);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => { opening = null; reject(request.error); };
      });
    }
    return opening;
  }

  async function transact(stores, mode, work) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      const result = work(tx);
      tx.oncomplete = () => resolve(result && 'result' in result ? result.result : result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  const loadItems = () => transact(ITEMS, 'readonly', (tx) => tx.objectStore(ITEMS).getAll());

  const saveItems = (records) => transact(ITEMS, 'readwrite', (tx) => {
    records.forEach((record) => tx.objectStore(ITEMS).put(record));
  });

  async function savePhoto(id, blob) {
    const entry = { type: blob.type, bytes: await blob.arrayBuffer() };
    return transact(PHOTOS, 'readwrite', (tx) => { tx.objectStore(PHOTOS).put(entry, id); });
  }

  async function loadPhoto(id) {
    const entry = await transact(PHOTOS, 'readonly', (tx) => tx.objectStore(PHOTOS).get(id));
    if (!entry) throw new Error('photo missing');
    return new Blob([entry.bytes], { type: entry.type });
  }

  const removeItem = (id) => transact([ITEMS, PHOTOS], 'readwrite', (tx) => {
    tx.objectStore(ITEMS).delete(id);
    tx.objectStore(PHOTOS).delete(id);
  });

  const clearAll = () => transact([ITEMS, PHOTOS], 'readwrite', (tx) => {
    tx.objectStore(ITEMS).clear();
    tx.objectStore(PHOTOS).clear();
  });

  const removePhoto = (key) => transact(PHOTOS, 'readwrite', (tx) => { tx.objectStore(PHOTOS).delete(key); });

  // Clears photos left behind if the app was stopped before their item was saved.
  async function prunePhotos(keep) {
    const keys = await transact(PHOTOS, 'readonly', (tx) => tx.objectStore(PHOTOS).getAllKeys());
    const stale = keys.filter((key) => !keep.has(key));
    if (stale.length) {
      await transact(PHOTOS, 'readwrite', (tx) => stale.forEach((key) => tx.objectStore(PHOTOS).delete(key)));
    }
  }

  root.Store = { loadItems, saveItems, savePhoto, loadPhoto, removeItem, removePhoto, prunePhotos, clearAll };
})(globalThis);
