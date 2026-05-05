(function (global) {
  'use strict';

  const App = global.AbsensiApp = global.AbsensiApp || {};
  const { DB_NAME, DB_VERSION, STORE_FILES } = App.CONFIG;

  App.openDb = function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_FILES)) {
          const store = db.createObjectStore(STORE_FILES, { keyPath: 'id' });
          store.createIndex('by_filename', 'filename', { unique: false });
          store.createIndex('by_savedAt', 'savedAt', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Gagal membuka IndexedDB'));
    });
  };

  App.tx = function tx(storeName, mode = 'readonly') {
    const transaction = App.state.db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  };

  App.idbGetAll = function idbGetAll() {
    return new Promise((resolve, reject) => {
      const request = App.tx(STORE_FILES).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error('Gagal membaca data lokal'));
    });
  };

  App.idbPut = function idbPut(record) {
    return new Promise((resolve, reject) => {
      const request = App.tx(STORE_FILES, 'readwrite').put(record);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Gagal menyimpan ke IndexedDB'));
    });
  };

  App.idbDelete = function idbDelete(id) {
    return new Promise((resolve, reject) => {
      const request = App.tx(STORE_FILES, 'readwrite').delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('Gagal menghapus file'));
    });
  };

  App.idbClear = function idbClear() {
    return new Promise((resolve, reject) => {
      const request = App.tx(STORE_FILES, 'readwrite').clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('Gagal mengosongkan data lokal'));
    });
  };
})(window);
