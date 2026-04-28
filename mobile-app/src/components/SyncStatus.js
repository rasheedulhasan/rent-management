import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSync } from '../services/syncService';
import { useOfflineStore } from '../store/offlineStore';
import { useNetwork } from '../services/network';

const SyncStatus = () => {
  const { isSyncing, lastSyncTime, manualSync, syncProgress, retryFailedCollections } = useSync();
  const { pendingCount, updatePendingCount } = useOfflineStore();
  const { isOnline } = useNetwork();
  
  const [failedCount, setFailedCount] = useState(0);
  const [lastSyncFormatted, setLastSyncFormatted] = useState('Never');

  // Update pending count and failed count periodically
  useEffect(() => {
    const updateCounts = async () => {
      try {
        await updatePendingCount();
        // In a real app, you would get failed count from store
        // For now, we'll simulate it
        const failed = 0; // You would get this from getPendingCollections('failed')
        setFailedCount(failed);
      } catch (error) {
        console.error('Error updating counts:', error);
      }
    };

    updateCounts();
    const interval = setInterval(updateCounts, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [updatePendingCount]);

  // Format last sync time
  useEffect(() => {
    if (lastSyncTime) {
      const date = new Date(lastSyncTime);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) {
        setLastSyncFormatted('Just now');
      } else if (diffMins < 60) {
        setLastSyncFormatted(`${diffMins} minutes ago`);
      } else if (diffMins < 1440) {
        const hours = Math.floor(diffMins / 60);
        setLastSyncFormatted(`${hours} hour${hours > 1 ? 's' : ''} ago`);
      } else {
        setLastSyncFormatted(date.toLocaleDateString());
      }
    } else {
      setLastSyncFormatted('Never');
    }
  }, [lastSyncTime]);

  const handleManualSync = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Cannot sync while offline. Please connect to the internet.');
      return;
    }

    try {
      await manualSync();
      Alert.alert('Success', 'Sync completed successfully!');
    } catch (error) {
      Alert.alert('Sync Failed', error.message || 'Failed to sync. Please try again.');
    }
  };

  const handleRetryFailed = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Cannot retry failed collections while offline.');
      return;
    }

    try {
      await retryFailedCollections();
      Alert.alert('Retry Started', 'Failed collections are being retried.');
    } catch (error) {
      Alert.alert('Error', 'Failed to retry collections.');
    }
  };

  const getSyncStatusColor = () => {
    if (failedCount > 0) return '#dc3545'; // Red for errors
    if (pendingCount > 0) return '#ffc107'; // Yellow for pending
    return '#28a745'; // Green for synced
  };

  const getSyncStatusText = () => {
    if (failedCount > 0) return `${failedCount} failed`;
    if (pendingCount > 0) return `${pendingCount} pending`;
    return 'All synced';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sync Status</Text>
        <View style={[styles.statusBadge, { backgroundColor: getSyncStatusColor() }]}>
          <Text style={styles.statusBadgeText}>{getSyncStatusText()}</Text>
        </View>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{failedCount}</Text>
          <Text style={styles.statLabel}>Failed</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{lastSyncFormatted}</Text>
          <Text style={styles.statLabel}>Last Sync</Text>
        </View>
      </View>

      {isSyncing && (
        <View style={styles.syncProgress}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.syncProgressText}>
            Syncing... {syncProgress.current} of {syncProgress.total}
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton, (!isOnline || isSyncing) && styles.buttonDisabled]}
          onPress={handleManualSync}
          disabled={!isOnline || isSyncing}
        >
          {isSyncing ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.buttonText}>Sync Now</Text>
          )}
        </TouchableOpacity>

        {failedCount > 0 && (
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, (!isOnline || isSyncing) && styles.buttonDisabled]}
            onPress={handleRetryFailed}
            disabled={!isOnline || isSyncing}
          >
            <Text style={styles.secondaryButtonText}>Retry Failed</Text>
          </TouchableOpacity>
        )}
      </View>

      {!isOnline && (
        <View style={styles.offlineWarning}>
          <Text style={styles.offlineWarningText}>
            ⚠️ You are offline. Sync will resume automatically when connection is restored.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  syncProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#e7f3ff',
    borderRadius: 8,
  },
  syncProgressText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  offlineWarning: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  offlineWarningText: {
    color: '#856404',
    fontSize: 14,
  },
});

export default SyncStatus;