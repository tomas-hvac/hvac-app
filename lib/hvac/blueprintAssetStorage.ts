/**
 * LARGE BLUEPRINT ASSET STORAGE
 * 
 * This service provides a high-capacity persistence layer for original 
 * blueprint files (PDFs and high-resolution images) using browser IndexedDB.
 * 
 * RATIONALE:
 * Project engineering metadata (traces, labels, calibration) is small and
 * belongs in localStorage/JSON for fast synchronization. However, binary 
 * files like 40-page construction PDFs exceed the 5MB limit of localStorage.
 * 
 * By storing binary assets here, we ensure project portability and stability 
 * without causing "QuotaExceededError" during autosaves.
 */

export type AssetMetadata = {
  name: string;
  type: string;
  size: number;
  createdAt: string;
};

export type BlueprintAsset = {
  id: string;
  blob: Blob;
  metadata: AssetMetadata;
};

const DB_NAME = "hvac-blueprint-assets";
const STORE_NAME = "assets";
const DB_VERSION = 1;

/**
 * Internal helper to open the IndexedDB connection.
 */
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported in this environment."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

/**
 * Saves a blueprint file (Blob/File) to IndexedDB.
 */
export async function saveBlueprintAsset(
  assetId: string, 
  blob: Blob, 
  metadata: AssetMetadata
): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      
      const asset: BlueprintAsset = {
        id: assetId,
        blob,
        metadata
      };

      const request = store.put(asset);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error("Failed to save blueprint asset:", error);
    throw error;
  }
}

/**
 * Retrieves a blueprint asset and its metadata by ID.
 */
export async function getBlueprintAsset(
  assetId: string
): Promise<BlueprintAsset | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.get(assetId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  } catch (error) {
    console.warn(`Blueprint asset ${assetId} could not be retrieved:`, error);
    return null;
  }
}

/**
 * Deletes a blueprint asset from storage.
 */
export async function deleteBlueprintAsset(assetId: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.delete(assetId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error(`Failed to delete blueprint asset ${assetId}:`, error);
    throw error;
  }
}

/**
 * Lists all stored blueprint asset metadata (excluding Blobs for performance).
 */
export async function listBlueprintAssets(): Promise<Array<{ id: string; metadata: AssetMetadata }>> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      
      const results: Array<{ id: string; metadata: AssetMetadata }> = [];
      const request = store.openCursor();

      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const { id, metadata } = cursor.value;
          results.push({ id, metadata });
          cursor.continue();
        } else {
          resolve(results);
        }
      };
    });
  } catch (error) {
    console.error("Failed to list blueprint assets:", error);
    return [];
  }
}
