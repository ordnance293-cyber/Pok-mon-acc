(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.AiScanQueue = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const DB_NAME = 'pokemon-account-ai-scans';
    const STORE_NAME = 'scanJobs';
    const DB_VERSION = 1;
    const MAX_CONCURRENT_SCANS = 1;

    const clone = value => (typeof structuredClone === 'function'
        ? structuredClone(value)
        : JSON.parse(JSON.stringify(value)));

    function createIndexedDbStore(indexedDBImpl = globalThis.indexedDB) {
        if (!indexedDBImpl) throw new Error('此瀏覽器不支援 IndexedDB，無法建立安全的掃描佇列。');
        let connection;
        const open = () => {
            if (connection) return connection;
            connection = new Promise((resolve, reject) => {
                const request = indexedDBImpl.open(DB_NAME, DB_VERSION);
                request.onupgradeneeded = () => {
                    const db = request.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                        store.createIndex('createdAt', 'createdAt');
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error || new Error('無法開啟掃描佇列。'));
            });
            return connection;
        };
        const transact = async (mode, operation) => {
            const db = await open();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, mode);
                const request = operation(transaction.objectStore(STORE_NAME));
                let result;
                request.onsuccess = () => { result = request.result; };
                request.onerror = () => reject(request.error || new Error('掃描佇列儲存失敗。'));
                transaction.onabort = () => reject(transaction.error || new Error('掃描佇列交易中止。'));
                transaction.oncomplete = () => resolve(result);
            });
        };
        return {
            put: job => transact('readwrite', store => store.put(job)),
            get: id => transact('readonly', store => store.get(id)),
            delete: id => transact('readwrite', store => store.delete(id)),
            getAll: () => transact('readonly', store => store.getAll())
        };
    }

    function makeId(now = Date.now()) {
        const random = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
        return `scan-${now.toString(36)}-${random}`;
    }

    function createScanJob(files, options = {}) {
        const now = options.now || Date.now();
        return {
            id: options.id || makeId(now),
            label: String(options.label || '').trim(),
            createdAt: now,
            updatedAt: now,
            status: 'queued',
            progress: '等待掃描',
            files: Array.from(files || []),
            result: null,
            error: null,
            attempts: 0
        };
    }

    class ScanQueue {
        constructor({ store, runner, onChange = () => {}, isOnline = () => true, now = Date.now } = {}) {
            this.store = store || createIndexedDbStore();
            this.runner = runner;
            this.onChange = onChange;
            this.isOnline = isOnline;
            this.now = now;
            this.jobs = [];
            this.processingIds = new Set();
            this.processPromise = null;
            this.initialized = false;
        }

        async initialize() {
            if (this.initialized) return this.jobs;
            this.jobs = (await this.store.getAll()).sort((a, b) => a.createdAt - b.createdAt);
            let changed = false;
            for (const job of this.jobs) {
                if (job.status === 'processing') {
                    job.status = 'interrupted';
                    job.progress = '先前掃描已中斷，請手動重試';
                    job.updatedAt = this.now();
                    await this.store.put(job);
                    changed = true;
                }
            }
            this.initialized = true;
            this.emit(changed ? 'recovered' : 'restored');
            return this.jobs;
        }

        async refresh() {
            if (this.processPromise) return this.jobs;
            return this.initialized ? this.jobs : this.initialize();
        }

        async enqueue(files, options = {}) {
            const job = createScanJob(files, { ...options, now: this.now() });
            if (job.files.length === 0) throw new Error('請先選擇截圖。');
            await this.store.put(job);
            this.jobs.push(job);
            this.jobs.sort((a, b) => a.createdAt - b.createdAt);
            this.emit('enqueued', job);
            this.process();
            return job;
        }

        async retry(id) {
            const job = this.jobs.find(item => item.id === id);
            if (!job || !['failed', 'interrupted'].includes(job.status)) return false;
            Object.assign(job, { status: 'queued', progress: '等待重試', error: null, updatedAt: this.now() });
            await this.store.put(job);
            this.emit('retried', job);
            this.process();
            return true;
        }

        async remove(id) {
            const job = this.jobs.find(item => item.id === id);
            if (!job || job.status === 'processing') return false;
            await this.store.delete(id);
            this.jobs = this.jobs.filter(item => item.id !== id);
            this.emit('removed', job);
            return true;
        }

        async updateProgress(job, progress) {
            if (!this.processingIds.has(job.id)) return;
            job.progress = String(progress || '掃描中');
            job.updatedAt = this.now();
            await this.store.put(job);
            this.emit('progress', job);
        }

        process() {
            if (this.processPromise || !this.isOnline()) return this.processPromise;
            this.processPromise = this.drain().finally(() => {
                this.processPromise = null;
                if (this.isOnline() && this.jobs.some(job => job.status === 'queued')) this.process();
            });
            return this.processPromise;
        }

        async drain() {
            while (this.isOnline()) {
                const available = MAX_CONCURRENT_SCANS - this.processingIds.size;
                if (available <= 0) return;
                const job = this.jobs.find(item => item.status === 'queued' && !this.processingIds.has(item.id));
                if (!job) return;
                await this.run(job);
            }
        }

        async run(job) {
            if (this.processingIds.has(job.id) || job.status !== 'queued') return;
            this.processingIds.add(job.id);
            Object.assign(job, {
                status: 'processing', progress: '掃描中', error: null,
                attempts: Number(job.attempts || 0) + 1, updatedAt: this.now()
            });
            await this.store.put(job);
            this.emit('processing', job);
            try {
                const result = await this.runner(job, progress => this.updateProgress(job, progress));
                Object.assign(job, { status: 'completed', progress: '掃描完成', result, error: null, updatedAt: this.now() });
            } catch (error) {
                const offline = !this.isOnline();
                Object.assign(job, offline ? {
                    status: 'queued', progress: '目前離線，等待恢復', result: null, error: null, updatedAt: this.now()
                } : {
                    status: 'failed', progress: '掃描失敗', result: null, updatedAt: this.now(),
                    error: { name: String(error?.name || 'Error'), message: String(error?.message || '掃描失敗').slice(0, 500) }
                });
            } finally {
                this.processingIds.delete(job.id);
                await this.store.put(job);
                this.emit(job.status, job);
            }
        }

        emit(reason, job) {
            this.onChange(this.jobs.map(clone), reason, job ? clone(job) : null);
        }
    }

    return { DB_NAME, STORE_NAME, MAX_CONCURRENT_SCANS, createIndexedDbStore, createScanJob, ScanQueue };
}));
