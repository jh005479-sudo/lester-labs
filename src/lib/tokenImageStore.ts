/**
 * IndexedDB wrapper for token → image URL mapping.
 * Stores image URLs per token address so the browse cards
 * can display user-uploaded logos without any backend.
 */

const DB_NAME = 'lester_token_images'
const STORE_NAME = 'images'
const DB_VERSION = 1

let _db: IDBDatabase | null = null

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db)

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'address' })
      }
    }

    req.onsuccess = () => {
      _db = req.result
      resolve(_db)
    }

    req.onerror = () => reject(req.error)
  })
}

/** Store or update an image URL for a token address */
export async function setTokenImageUrl(
  address: string,
  url: string,
): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put({ address: address.toLowerCase(), url })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Retrieve the stored image URL for a token address */
export async function getTokenImageUrl(address: string): Promise<string | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(address.toLowerCase())
    req.onsuccess = () => resolve(req.result?.url ?? null)
    req.onerror = () => reject(req.error)
  })
}

/** Get all stored token images */
export async function getAllTokenImages(): Promise<
  Map<string, string>
> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => {
      const map = new Map<string, string>()
      for (const row of req.result) {
        map.set(row.address, row.url)
      }
      resolve(map)
    }
    req.onerror = () => reject(req.error)
  })
}

/** Delete an image URL for a token address */
export async function deleteTokenImageUrl(address: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(address.toLowerCase())
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
