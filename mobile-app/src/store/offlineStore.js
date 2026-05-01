import * as SQLite from 'expo-sqlite/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Open database
const db = SQLite.openDatabase('rent_management.db');

// Simple UUID v4 generator (for offline use)
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Database initialization state
let initializationPromise = null;

// Initialize database
export const initDatabase = () => {
  if (initializationPromise) {
    return initializationPromise;
  }
  
  initializationPromise = new Promise((resolve, reject) => {
    db.transaction(tx => {
      // Create pending collections table
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS pending_collections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          localId TEXT UNIQUE NOT NULL,
          tenantId TEXT NOT NULL,
          collectedBy TEXT NOT NULL,
          amount REAL NOT NULL,
          paymentMode TEXT NOT NULL,
          notes TEXT,
          collectedAt TEXT NOT NULL,
          syncStatus TEXT NOT NULL DEFAULT 'pending',
          createdAt TEXT DEFAULT (datetime('now')),
          lastRetryAt TEXT,
          retryCount INTEGER DEFAULT 0
        )`,
        [],
        () => {
          console.log('Pending collections table created');
        },
        (_, error) => {
          console.error('Error creating pending collections table:', error);
          return false;
        }
      );

      // Create cached tenants table
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS cached_tenants (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tenantId TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          building TEXT,
          roomNumber TEXT,
          phone TEXT,
          monthlyRent REAL,
          lastSync TEXT,
          data TEXT NOT NULL
        )`,
        [],
        () => {
          console.log('Cached tenants table created');
        },
        (_, error) => {
          console.error('Error creating cached tenants table:', error);
          return false;
        }
      );

      // Create sync history table
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS sync_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT DEFAULT (datetime('now')),
          type TEXT NOT NULL,
          recordsCount INTEGER,
          success BOOLEAN,
          errorMessage TEXT
        )`,
        [],
        () => {
          console.log('Sync history table created');
          resolve();
        },
        (_, error) => {
          console.error('Error creating sync history table:', error);
          reject(error);
        }
      );
    });
  });
  
  return initializationPromise;
};

// Ensure database is initialized before any operation
const ensureDatabaseInitialized = () => {
  return initDatabase();
};

// Pending Collections Operations
export const addPendingCollection = (collection) => {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureDatabaseInitialized();
      
      const localId = collection.localId || generateUUID();
      const now = new Date().toISOString();
      
      db.transaction(tx => {
        tx.executeSql(
          `INSERT INTO pending_collections
          (localId, tenantId, collectedBy, amount, paymentMode, notes, collectedAt, syncStatus)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            localId,
            collection.tenantId,
            collection.collectedBy,
            collection.amount,
            collection.paymentMode,
            collection.notes || '',
            collection.collectedAt || now,
            collection.syncStatus || 'pending'
          ],
          (_, result) => {
            resolve({ ...collection, localId, id: result.insertId });
          },
          (_, error) => {
            console.error('Error adding pending collection:', error);
            reject(error);
          }
        );
      });
    } catch (error) {
      console.error('Database initialization error in addPendingCollection:', error);
      reject(error);
    }
  });
};

export const getPendingCollections = (status = 'pending') => {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureDatabaseInitialized();
      db.transaction(tx => {
        tx.executeSql(
          `SELECT * FROM pending_collections WHERE syncStatus = ? ORDER BY createdAt ASC`,
          [status],
          (_, { rows }) => {
            resolve(rows._array);
          },
          (_, error) => {
            console.error('Error getting pending collections:', error);
            reject(error);
          }
        );
      });
    } catch (error) {
      console.error('Database initialization error in getPendingCollections:', error);
      reject(error);
    }
  });
};

export const updateCollectionStatus = (localId, status, errorMessage = null) => {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureDatabaseInitialized();
      db.transaction(tx => {
        const now = new Date().toISOString();
        let query = `UPDATE pending_collections SET syncStatus = ?, lastRetryAt = ?`;
        const params = [status, now];
        
        if (status === 'failed' && errorMessage) {
          query += `, retryCount = retryCount + 1`;
        }
        
        query += ` WHERE localId = ?`;
        params.push(localId);
        
        tx.executeSql(
          query,
          params,
          (_, result) => {
            resolve(result);
          },
          (_, error) => {
            console.error('Error updating collection status:', error);
            reject(error);
          }
        );
      });
    } catch (error) {
      console.error('Database initialization error in updateCollectionStatus:', error);
      reject(error);
    }
  });
};

export const deleteSyncedCollection = (localId) => {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureDatabaseInitialized();
      db.transaction(tx => {
        tx.executeSql(
          `DELETE FROM pending_collections WHERE localId = ? AND syncStatus = 'synced'`,
          [localId],
          (_, result) => {
            resolve(result);
          },
          (_, error) => {
            console.error('Error deleting synced collection:', error);
            reject(error);
          }
        );
      });
    } catch (error) {
      console.error('Database initialization error in deleteSyncedCollection:', error);
      reject(error);
    }
  });
};

export const getPendingCount = () => {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureDatabaseInitialized();
      db.transaction(tx => {
        tx.executeSql(
          `SELECT COUNT(*) as count FROM pending_collections WHERE syncStatus = 'pending'`,
          [],
          (_, { rows }) => {
            resolve(rows._array[0].count);
          },
          (_, error) => {
            console.error('Error getting pending count:', error);
            reject(error);
          }
        );
      });
    } catch (error) {
      console.error('Database initialization error in getPendingCount:', error);
      reject(error);
    }
  });
};

// Cached Tenants Operations
export const cacheTenants = (tenants) => {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureDatabaseInitialized();
      db.transaction(tx => {
        // Clear existing cache
        tx.executeSql('DELETE FROM cached_tenants', [], () => {
          const now = new Date().toISOString();
          
          // Insert new tenants
          tenants.forEach(tenant => {
            // Map API fields to expected frontend fields
            const mappedTenant = {
              ...tenant,
              // Ensure standard field names
              name: tenant.full_name || tenant.name,
              phone: tenant.phone_number || tenant.phone,
              monthlyRent: tenant.monthly_rent || tenant.monthlyRent,
              building: tenant.building || '',
              roomNumber: tenant.roomNumber || '',
              // Ensure id fields
              id: tenant.id,
              tenantId: tenant.tenantId || tenant.id
            };
            
            tx.executeSql(
              `INSERT INTO cached_tenants
              (tenantId, name, building, roomNumber, phone, monthlyRent, lastSync, data)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                mappedTenant.id || mappedTenant.tenantId,
                mappedTenant.name,
                mappedTenant.building,
                mappedTenant.roomNumber,
                mappedTenant.phone,
                mappedTenant.monthlyRent || 0,
                now,
                JSON.stringify(mappedTenant)
              ]
            );
          });
          
          resolve();
        }, (_, error) => {
          console.error('Error clearing tenant cache:', error);
          reject(error);
        });
      });
    } catch (error) {
      console.error('Database initialization error in cacheTenants:', error);
      reject(error);
    }
  });
};

export const getCachedTenants = () => {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureDatabaseInitialized();
      db.transaction(tx => {
        tx.executeSql(
          `SELECT * FROM cached_tenants ORDER BY name ASC`,
          [],
          (_, { rows }) => {
            const tenants = rows._array.map(row => ({
              ...JSON.parse(row.data),
              cached: true,
              lastSync: row.lastSync
            }));
            resolve(tenants);
          },
          (_, error) => {
            console.error('Error getting cached tenants:', error);
            reject(error);
          }
        );
      });
    } catch (error) {
      console.error('Database initialization error in getCachedTenants:', error);
      reject(error);
    }
  });
};

export const getTenantById = (tenantId) => {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureDatabaseInitialized();
      db.transaction(tx => {
        tx.executeSql(
          `SELECT * FROM cached_tenants WHERE tenantId = ?`,
          [tenantId],
          (_, { rows }) => {
            if (rows.length > 0) {
              resolve(JSON.parse(rows._array[0].data));
            } else {
              resolve(null);
            }
          },
          (_, error) => {
            console.error('Error getting tenant by ID:', error);
            reject(error);
          }
        );
      });
    } catch (error) {
      console.error('Database initialization error in getTenantById:', error);
      reject(error);
    }
  });
};

// Sync History
export const addSyncHistory = (type, recordsCount, success, errorMessage = null) => {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureDatabaseInitialized();
      db.transaction(tx => {
        tx.executeSql(
          `INSERT INTO sync_history (type, recordsCount, success, errorMessage)
          VALUES (?, ?, ?, ?)`,
          [type, recordsCount, success ? 1 : 0, errorMessage],
          (_, result) => {
            resolve(result);
          },
          (_, error) => {
            console.error('Error adding sync history:', error);
            reject(error);
          }
        );
      });
    } catch (error) {
      console.error('Database initialization error in addSyncHistory:', error);
      reject(error);
    }
  });
};

// Context/Provider for React components
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

const OfflineStoreContext = createContext();

export const OfflineStoreProvider = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const initialize = async () => {
      try {
        await initDatabase();
        setIsInitialized(true);
        updatePendingCount();
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };
    
    initialize();
  }, []);

  const updatePendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch (error) {
      console.error('Error updating pending count:', error);
    }
  }, []);

  const value = useMemo(() => ({
    isInitialized,
    pendingCount,
    updatePendingCount,
    addPendingCollection,
    getPendingCollections,
    updateCollectionStatus,
    deleteSyncedCollection,
    cacheTenants,
    getCachedTenants,
    getTenantById,
    addSyncHistory,
  }), [isInitialized, pendingCount, updatePendingCount]);

  return (
    <OfflineStoreContext.Provider value={value}>
      {children}
    </OfflineStoreContext.Provider>
  );
};

export const useOfflineStore = () => {
  const context = useContext(OfflineStoreContext);
  if (!context) {
    throw new Error('useOfflineStore must be used within OfflineStoreProvider');
  }
  return context;
};