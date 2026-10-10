const DB_NAME = "ipodLocalLibrary";
const DB_VERSION = 1;

/** `settings` holds the folder handle, `tracks` the parsed tags, `artwork` the album thumbnails. */
export type StoreName = "settings" | "tracks" | "artwork";

const KEY_PATHS: Record<StoreName, string | undefined> = {
  settings: undefined,
  tracks: "path",
  artwork: "albumId",
};

let dbPromise: Promise<IDBDatabase> | undefined;

const openDb = () => {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      for (const [name, keyPath] of Object.entries(KEY_PATHS)) {
        request.result.createObjectStore(name, keyPath ? { keyPath } : undefined);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
};

const run = async <TResult>(
  store: StoreName,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<TResult> | void
) => {
  const db = await openDb();

  return new Promise<TResult | undefined>((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const request = work(transaction.objectStore(store));

    transaction.oncomplete = () => resolve(request ? request.result : undefined);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
};

/**
 * The cache is an optimisation, so every helper swallows failures
 * (private windows and blocked site data both make IndexedDB throw).
 */
const safely = async <TResult>(work: () => Promise<TResult>, fallback: TResult) => {
  try {
    return await work();
  } catch (error) {
    console.warn("Library cache unavailable:", error);
    return fallback;
  }
};

export const dbGet = <TValue>(store: StoreName, key: string) =>
  safely(
    () => run<TValue>(store, "readonly", (s) => s.get(key)),
    undefined
  );

export const dbGetAll = <TValue>(store: StoreName) =>
  safely(
    async () =>
      (await run<TValue[]>(store, "readonly", (s) => s.getAll())) ?? [],
    [] as TValue[]
  );

export const dbSet = (store: StoreName, key: string, value: unknown) =>
  safely(async () => {
    await run(store, "readwrite", (s) => {
      s.put(value, key);
    });
  }, undefined);

/** Replaces everything in a store that uses a key path. */
export const dbReplaceAll = (store: StoreName, values: unknown[]) =>
  safely(async () => {
    await run(store, "readwrite", (s) => {
      s.clear();
      values.forEach((value) => s.put(value));
    });
  }, undefined);

export const dbClear = (store: StoreName) =>
  safely(async () => {
    await run(store, "readwrite", (s) => {
      s.clear();
    });
  }, undefined);
