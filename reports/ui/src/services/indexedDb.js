var IndexedDbService = {
  methods: {
    async getDb(dbName, dbVersion) {
      return new Promise((resolve, reject) => {
        let request = window.indexedDB.open(dbName, dbVersion);

        request.onerror = e => {
          console.error('Error opening db', e);
          reject('Error opening db');
        };

        request.onsuccess = e => {
          resolve(e.target.result);
        };

        request.onupgradeneeded = e => {
          // database doesn't exist, create it
          let db = e.target.result;
          db.createObjectStore(dbName, { autoIncrement: true, keyPath: 'id' });
        };
      });
    },
    async readFromDb(db, dbName) {
      return new Promise((resolve, reject) => {
        let trans = db.transaction([dbName], 'readonly');

        trans.oncomplete = () => {
          resolve(rows);
        };

        trans.onerror = () => {
          console.error("Transaction error: " + trans.error);
          reject("Transaction error: " + trans.error);
        };

        let store = trans.objectStore(dbName);
        let rows = [];

        store.openCursor().onsuccess = e => {
          let cursor = e.target.result;
          if (cursor) {
            rows.push(cursor.value)
            cursor.continue();
          }
        };
      });
    },
    async addToDb(obj, db, dbName) {
      return new Promise((resolve, reject) => {
        let trans = db.transaction([dbName], 'readwrite');

        trans.oncomplete = () => {
          resolve();
        };

        trans.onerror = () => {
          console.error("Transaction error: " + trans.error);
          reject("Transaction error: " + trans.error);
        };

        let store = trans.objectStore(dbName);
        store.add(obj);
      });
    },
    async deleteFromDb(id, db, dbName) {
      return new Promise((resolve, reject) => {
        let trans = db.transaction([dbName], 'readwrite');
        trans.oncomplete = () => {
          resolve();
        };

        trans.onerror = () => {
          console.error("Transaction error: " + trans.error);
          reject("Transaction error: " + trans.error);
        };

        let store = trans.objectStore(dbName);
        store.delete(id);
      });
    },
    async clearDb(db, dbName) {
      return new Promise((resolve, reject) => {
        let trans = db.transaction([dbName], "readwrite");

        trans.oncomplete = () => {
          resolve();
        };

        trans.onerror = () => {
          console.error("Transaction error: " + trans.error);
          reject("Transaction error: " + trans.error);
        };

        let store = trans.objectStore(dbName);
        store.clear();
      });
    },
  }
};
export default IndexedDbService;