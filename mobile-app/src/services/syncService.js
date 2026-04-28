import { useEffect, createContext, useContext, useState, useCallback, useRef } from 'react';
import { useNetwork } from './network';
import { useOfflineStore } from '../store/offlineStore';
import { rentCollectionsApi } from './api';
import ErrorHandler from '../utils/errorHandler';

const SyncContext = createContext();

export const SyncProvider = ({ children }) => {
  const { isOnline, addNetworkListener, removeNetworkListener } = useNetwork();
  const {
    getPendingCollections,
    updateCollectionStatus,
    deleteSyncedCollection,
    addSyncHistory,
    updatePendingCount,
    cacheTenants,
    getCachedTenants,
  } = useOfflineStore();
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [syncStats, setSyncStats] = useState({ success: 0, failed: 0, total: 0 });
  const [retryAttempts, setRetryAttempts] = useState({});

  // Auto-sync when network becomes available
  useEffect(() => {
    const handleNetworkChange = (online) => {
      if (online) {
        // Small delay to ensure app is ready
        setTimeout(() => {
          syncPendingData();
        }, 2000);
      }
    };

    const cleanup = addNetworkListener(handleNetworkChange);

    return () => {
      if (cleanup) cleanup();
      removeNetworkListener(handleNetworkChange);
    };
  }, [addNetworkListener, removeNetworkListener]);

  // Periodic sync (every 5 minutes when online)
  useEffect(() => {
    if (!isOnline) return;

    const interval = setInterval(() => {
      syncPendingData();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [isOnline]);

  // Sync pending data to server with enhanced error handling
  const syncPendingData = useCallback(async (options = {}) => {
    const { force = false, retryFailedOnly = false } = options;
    
    if (!isOnline || (isSyncing && !force)) {
      console.log('Skipping sync: offline or already syncing');
      return { success: false, error: 'Sync already in progress or offline' };
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      // Get pending collections
      const pendingCollections = await getPendingCollections('pending');
      const failedCollections = await getPendingCollections('failed');
      
      let allCollections = [...pendingCollections, ...failedCollections];
      
      if (retryFailedOnly) {
        allCollections = failedCollections;
      }
      
      if (allCollections.length === 0) {
        console.log('No pending collections to sync');
        setIsSyncing(false);
        return { success: true, message: 'No pending collections' };
      }

      setSyncProgress({ current: 0, total: allCollections.length });

      let successCount = 0;
      let failureCount = 0;
      const failedItems = [];

      // Process each collection with individual error handling
      for (let i = 0; i < allCollections.length; i++) {
        const collection = allCollections[i];
        setSyncProgress({ current: i + 1, total: allCollections.length });

        try {
          // Prepare data for API
          const collectionData = {
            tenantId: collection.tenantId,
            collectedBy: collection.collectedBy,
            amount: collection.amount,
            paymentMode: collection.paymentMode,
            notes: collection.notes,
            collectedAt: collection.collectedAt,
            localId: collection.localId, // For idempotency
          };

          // Submit to server with timeout
          await rentCollectionsApi.submitCollection(collectionData);
          
          // Mark as synced
          await updateCollectionStatus(collection.localId, 'synced');
          successCount++;
          
          // Clear retry attempts for this item
          setRetryAttempts(prev => {
            const newAttempts = { ...prev };
            delete newAttempts[collection.localId];
            return newAttempts;
          });

        } catch (error) {
          const errorInfo = ErrorHandler.handleApiError(error, `collection ${collection.localId}`);
          console.error(`Failed to sync collection ${collection.localId}:`, errorInfo);
          
          // Check if we should retry based on error type and previous attempts
          const attempts = retryAttempts[collection.localId] || 0;
          const shouldRetry = ErrorHandler.shouldRetryError(error) && attempts < 3;
          
          // Mark as failed with detailed error message
          await updateCollectionStatus(
            collection.localId, 
            shouldRetry ? 'pending' : 'failed', 
            errorInfo.userMessage
          );
          
          if (shouldRetry) {
            // Increment retry attempts
            setRetryAttempts(prev => ({
              ...prev,
              [collection.localId]: attempts + 1
            }));
            
            console.log(`Will retry collection ${collection.localId} (attempt ${attempts + 1})`);
          } else {
            failureCount++;
            failedItems.push({
              localId: collection.localId,
              error: errorInfo.userMessage,
              technical: errorInfo.technicalMessage,
            });
          }
        }

        // Small delay to prevent overwhelming server
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Record sync history
      await addSyncHistory(
        'collections',
        allCollections.length,
        failureCount === 0,
        failureCount > 0 ? `${failureCount} collections failed` : null
      );

      // Update pending count
      await updatePendingCount();

      // Update last sync time
      setLastSyncTime(new Date().toISOString());
      
      // Update sync stats
      setSyncStats({
        success: successCount,
        failed: failureCount,
        total: allCollections.length,
      });

      if (failureCount > 0) {
        const errorMessage = `${failureCount} collections failed to sync`;
        setSyncError(errorMessage);
        
        // Log detailed error information
        ErrorHandler.logError(
          new Error(errorMessage),
          'syncPendingData',
          { failedItems, successCount, total: allCollections.length }
        );
        
        return {
          success: false,
          error: errorMessage,
          details: {
            successCount,
            failureCount,
            total: allCollections.length,
            failedItems,
          }
        };
      } else {
        console.log(`Sync completed successfully: ${successCount} items synced`);
        return {
          success: true,
          message: `Successfully synced ${successCount} items`,
          details: { successCount, failureCount: 0 }
        };
      }

    } catch (error) {
      const errorInfo = ErrorHandler.handleApiError(error, 'syncPendingData');
      console.error('Sync error:', errorInfo);
      setSyncError(errorInfo.userMessage);
      await addSyncHistory('collections', 0, false, errorInfo.userMessage);
      
      return {
        success: false,
        error: errorInfo.userMessage,
        technical: errorInfo.technicalMessage,
      };
    } finally {
      setIsSyncing(false);
      setSyncProgress({ current: 0, total: 0 });
    }
  }, [isOnline, isSyncing, getPendingCollections, updateCollectionStatus, deleteSyncedCollection, addSyncHistory, updatePendingCount, retryAttempts]);

  // Sync tenants data with error handling
  const syncTenants = useCallback(async () => {
    if (!isOnline) {
      console.log('Cannot sync tenants: offline');
      throw new Error('Cannot sync tenants while offline');
    }

    try {
      const tenants = await rentCollectionsApi.getTenants();
      
      // Cache tenants locally
      await cacheTenants(tenants);
      
      await addSyncHistory('tenants', tenants.length, true, null);
      
      console.log(`Synced ${tenants.length} tenants`);
      return tenants;
    } catch (error) {
      const errorInfo = ErrorHandler.handleApiError(error, 'syncTenants');
      console.error('Failed to sync tenants:', errorInfo);
      await addSyncHistory('tenants', 0, false, errorInfo.userMessage);
      throw new Error(errorInfo.userMessage);
    }
  }, [isOnline, cacheTenants, addSyncHistory]);

  // Enhanced manual sync with options
  const manualSync = useCallback(async (options = {}) => {
    const { 
      syncTenantsFirst = true, 
      showAlerts = false,
      retryFailed = false 
    } = options;

    if (!isOnline) {
      const error = 'Cannot sync while offline';
      if (showAlerts) {
        ErrorHandler.showOfflineError('Sync');
      }
      throw new Error(error);
    }

    if (isSyncing) {
      const error = 'Sync already in progress';
      if (showAlerts) {
        ErrorHandler.showErrorAlert(new Error(error), 'Sync');
      }
      throw new Error(error);
    }

    try {
      let tenantResult = null;
      
      // Sync tenants first if requested
      if (syncTenantsFirst) {
        try {
          tenantResult = await syncTenants();
          console.log('Tenants synced successfully');
        } catch (error) {
          console.warn('Tenant sync failed, continuing with collections:', error);
          // Continue with collection sync even if tenant sync fails
        }
      }

      // Sync pending collections
      const syncOptions = { force: true, retryFailedOnly: retryFailed };
      const collectionResult = await syncPendingData(syncOptions);

      if (showAlerts) {
        if (collectionResult.success) {
          // Show success alert
          const message = collectionResult.details.successCount > 0
            ? `Successfully synced ${collectionResult.details.successCount} collections`
            : 'No pending collections to sync';
          
          // In a real app, you would show an alert here
          console.log('Sync successful:', message);
        } else {
          // Show error alert with retry option
          ErrorHandler.showSyncError(
            collectionResult.details?.failureCount || 0,
            collectionResult.details?.total || 0,
            collectionResult.error
          );
        }
      }

      return {
        tenants: tenantResult,
        collections: collectionResult,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      const errorInfo = ErrorHandler.handleApiError(error, 'manualSync');
      console.error('Manual sync failed:', errorInfo);
      
      if (showAlerts) {
        ErrorHandler.showErrorWithRetry(
          error,
          'Sync',
          () => manualSync({ ...options, retryFailed: true })
        );
      }
      
      throw new Error(errorInfo.userMessage);
    }
  }, [isOnline, isSyncing, syncTenants, syncPendingData]);

  // Get sync status
  const getSyncStatus = useCallback(async () => {
    const pendingCollections = await getPendingCollections('pending');
    const failedCollections = await getPendingCollections('failed');
    
    return {
      pending: pendingCollections.length,
      failed: failedCollections.length,
      total: pendingCollections.length + failedCollections.length,
      isSyncing,
      lastSyncTime,
      syncError,
      syncStats,
      retryAttempts: Object.keys(retryAttempts).length,
    };
  }, [isSyncing, lastSyncTime, syncError, syncStats, retryAttempts, getPendingCollections]);

  // Retry failed collections with enhanced logic
  const retryFailedCollections = useCallback(async (options = {}) => {
    const { maxRetries = 3, showProgress = false } = options;
    
    const failedCollections = await getPendingCollections('failed');
    
    if (failedCollections.length === 0) {
      return { success: true, message: 'No failed collections to retry' };
    }
    
    // Reset failed collections to pending for retry
    for (const collection of failedCollections) {
      const attempts = retryAttempts[collection.localId] || 0;
      if (attempts < maxRetries) {
        await updateCollectionStatus(collection.localId, 'pending');
      }
    }
    
    // Trigger sync with retryFailedOnly flag
    const result = await syncPendingData({ retryFailedOnly: true });
    
    return result;
  }, [getPendingCollections, updateCollectionStatus, syncPendingData, retryAttempts]);

  // Clear sync error
  const clearSyncError = useCallback(() => {
    setSyncError(null);
  }, []);

  // Get detailed error information
  const getErrorDetails = useCallback(() => {
    if (!syncError) return null;
    
    return {
      message: syncError,
      timestamp: new Date().toISOString(),
      stats: syncStats,
      retryAttempts,
    };
  }, [syncError, syncStats, retryAttempts]);

  const value = {
    isSyncing,
    lastSyncTime,
    syncError,
    syncProgress,
    syncStats,
    syncPendingData,
    syncTenants,
    manualSync,
    getSyncStatus,
    retryFailedCollections,
    clearSyncError,
    getErrorDetails,
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within SyncProvider');
  }
  return context;
};

// Background sync utility
export const setupBackgroundSync = () => {
  // This would be called from App.js to set up background sync
  // In a real app, you might use BackgroundFetch or similar
  
  console.log('Background sync setup complete');
  
  return {
    stop: () => console.log('Background sync stopped'),
  };
};

export default {
  SyncProvider,
  useSync,
  setupBackgroundSync,
};