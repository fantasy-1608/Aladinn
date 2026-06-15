/**
 * 🧞 Aladinn CDS — LRU Cache for Medication Normalization
 */
export class NormalizationCache {
    constructor(maxCapacity = 500) {
        this.maxCapacity = maxCapacity;
        this.cache = new Map();
    }

    get(key) {
        if (!this.cache.has(key)) {
            return undefined;
        }
        const val = this.cache.get(key);
        // Refresh key position to mark as recently used
        this.cache.delete(key);
        this.cache.set(key, val);
        return val;
    }

    set(key, value) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxCapacity) {
            // Evict oldest (first item inserted in Map)
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        this.cache.set(key, value);
    }

    clear() {
        this.cache.clear();
    }

    size() {
        return this.cache.size;
    }
}

export const normalizationCache = new NormalizationCache(500);
