import type { PersistStorage, StorageValue } from 'zustand/middleware';

import { encryptedStorage } from '@/storage/encryptedStorage';

interface PersistApi {
  persist: { rehydrate: () => Promise<void> | void; hasHydrated: () => boolean };
}

/**
 * Encrypted Zustand `persist` storage plus a hydration helper. Writes are skipped until
 * hydration succeeds, so unreadable data is never overwritten with in-memory defaults.
 */
export function createEncryptedPersist<S>(
  failureCode: string,
  parseLegacy?: (raw: unknown) => StorageValue<S> | null,
) {
  let hydrationError: unknown;
  let store: PersistApi | undefined;
  let hydration: Promise<void> | undefined;

  const storage: PersistStorage<S> = {
    async getItem(name) {
      try {
        const raw = await encryptedStorage.getItem(name);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && 'state' in parsed && 'version' in parsed) {
          return parsed as StorageValue<S>;
        }
        return parseLegacy ? parseLegacy(parsed) : null;
      } catch (error) {
        hydrationError = error;
        throw error;
      }
    },
    async setItem(name, value) {
      if (hydrationError || !store?.persist.hasHydrated()) return;
      try {
        await encryptedStorage.setItem(name, JSON.stringify(value));
      } catch (error) {
        console.error('Unable to save Bassera data', error);
      }
    },
    removeItem: (name) => encryptedStorage.removeItem(name),
  };

  function hydrate(target: PersistApi): Promise<void> {
    store = target;
    if (target.persist.hasHydrated()) return Promise.resolve();
    if (!hydration) {
      hydration = (async () => {
        hydrationError = undefined;
        await target.persist.rehydrate();
        if (hydrationError || !target.persist.hasHydrated()) throw new Error(failureCode);
      })();
      void hydration.catch(() => {
        hydration = undefined;
      });
    }
    return hydration;
  }

  return { storage, hydrate };
}
