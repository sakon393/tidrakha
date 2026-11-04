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

  root.Store = { loadItems, saveItems, savePhoto, loadPhoto, removeItem };
})(globalThis);
