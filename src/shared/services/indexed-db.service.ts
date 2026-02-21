import { Injectable } from '@angular/core';
import type { VectorDocument } from '../../core/models/vector.model';

@Injectable({
    providedIn: 'root'
})
export class IndexedDbService {
    private readonly DB_NAME = 'RagAppVectorDb';
    private readonly VERSION = 1;
    private db: IDBDatabase | null = null;
    private initPromise: Promise<void> | null = null;

    async init(): Promise<void> {
        if (this.db) return Promise.resolve();
        if (this.initPromise) return this.initPromise;

        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.VERSION);

            request.onupgradeneeded = (event: any) => {
                const db = event.target.result as IDBDatabase;
                if (!db.objectStoreNames.contains('vectors')) {
                    db.createObjectStore('vectors', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('meta')) {
                    db.createObjectStore('meta', { keyPath: 'key' });
                }
            };

            request.onsuccess = (event: any) => {
                this.db = event.target.result;
                resolve();
            };

            request.onerror = (event) => {
                console.error('IndexedDB Error:', event);
                reject('Failed to open database');
            };
        });

        return this.initPromise;
    }

    async saveDocuments(docs: VectorDocument[]): Promise<void> {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');
            const transaction = this.db.transaction(['vectors'], 'readwrite');
            const store = transaction.objectStore('vectors');

            docs.forEach(doc => store.put(doc));

            transaction.oncomplete = () => resolve();
            transaction.onerror = (e) => reject(e);
        });
    }

    async getAllDocuments(): Promise<VectorDocument[]> {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');
            try {
                const transaction = this.db.transaction(['vectors'], 'readonly');
                const store = transaction.objectStore('vectors');
                const request = store.getAll();

                request.onsuccess = () => resolve(request.result || []);
                request.onerror = (e) => reject(e);
            } catch (e) {
                reject(e);
            }
        });
    }

    async clearDocuments(): Promise<void> {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');

            const transaction = this.db.transaction(['vectors'], 'readwrite');
            const store = transaction.objectStore('vectors');
            const request = store.clear();

            request.onsuccess = () => {
                console.log('[IndexedDB] Vectors cleared successfully');
                resolve();
            };
            request.onerror = (e) => {
                console.error('[IndexedDB] Clear Failed', e);
                reject(e);
            };
        });
    }

    async saveMeta(key: string, value: any): Promise<void> {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');
            const transaction = this.db.transaction(['meta'], 'readwrite');
            const store = transaction.objectStore('meta');
            store.put({ key, value });
            transaction.oncomplete = () => resolve();
            transaction.onerror = (e) => reject(e);
        });
    }

    async getMeta(key: string): Promise<any> {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');
            try {
                const transaction = this.db.transaction(['meta'], 'readonly');
                const store = transaction.objectStore('meta');
                const request = store.get(key);

                request.onsuccess = () => resolve(request.result ? request.result.value : null);
                request.onerror = (e) => reject(e);
            } catch (e) {
                reject(e);
            }
        });
    }
}
