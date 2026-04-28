import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNetwork } from '../services/network';
import { useOfflineStore } from '../store/offlineStore';
import { useSync } from '../services/syncService';
import { rentCollectionsApi } from '../services/api';
import ErrorHandler from '../utils/errorHandler';

const CollectionForm = () => {
  const { isOnline } = useNetwork();
  const { addPendingCollection, updatePendingCount, getCachedTenants } = useOfflineStore();
  const { syncPendingData, manualSync } = useSync();

  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Form state
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [collectedBy, setCollectedBy] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [notes, setNotes] = useState('');

  // Load tenants on component mount
  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    setLoading(true);
    try {
      // Try to get cached tenants first
      const cachedTenants = await getCachedTenants();
      
      if (cachedTenants.length > 0) {
        setTenants(cachedTenants);
      } else {
        // If no cached tenants and online, fetch from server
        if (isOnline) {
          try {
            const freshTenants = await rentCollectionsApi.getTenants();
            setTenants(freshTenants);
          } catch (error) {
            const errorInfo = ErrorHandler.handleApiError(error, 'loadTenants');
            console.error('Error fetching tenants:', errorInfo);
            // Show error but continue with empty list
            setTenants([]);
            ErrorHandler.showErrorAlert(error, 'Load Tenants');
          }
        } else {
          // Show empty state with message
          setTenants([]);
        }
      }
    } catch (error) {
      const errorInfo = ErrorHandler.handleApiError(error, 'loadTenants');
      console.error('Error loading tenants:', errorInfo);
      ErrorHandler.showErrorAlert(error, 'Load Tenants');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Clear any previous errors
    setSubmitError(null);
    
    // Validate form
    if (!selectedTenantId) {
      Alert.alert('Validation Error', 'Please select a tenant');
      return;
    }
    if (!collectedBy.trim()) {
      Alert.alert('Validation Error', 'Please enter collector name');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount');
      return;
    }

    setSubmitting(true);

    try {
      const selectedTenant = tenants.find(t => t.id === selectedTenantId || t.tenantId === selectedTenantId);
      const collectionData = {
        tenantId: selectedTenantId,
        collectedBy: collectedBy.trim(),
        amount: parseFloat(amount),
        paymentMode,
        notes: notes.trim(),
        collectedAt: new Date().toISOString(),
      };

      if (isOnline) {
        // Online: Submit directly to server
        try {
          await rentCollectionsApi.submitCollection(collectionData);
          Alert.alert('Success', 'Rent collection submitted successfully!');
          resetForm();
          
          // Trigger sync to update any pending items
          syncPendingData();
          
        } catch (error) {
          const errorInfo = ErrorHandler.handleApiError(error, 'submitCollection');
          console.warn('Online submission failed, saving offline:', errorInfo);
          
          // Show error with retry option
          Alert.alert(
            'Online Submission Failed',
            errorInfo.userMessage,
            [
              { text: 'Save Offline', onPress: () => saveOfflineWithRetry(collectionData) },
              { text: 'Retry Online', onPress: () => retryOnlineSubmission(collectionData) },
            ]
          );
        }
      } else {
        // Offline: Save locally
        await saveOffline(collectionData);
      }

    } catch (error) {
      const errorInfo = ErrorHandler.handleApiError(error, 'handleSubmit');
      console.error('Error submitting collection:', errorInfo);
      setSubmitError(errorInfo.userMessage);
      
      ErrorHandler.showErrorWithRetry(
        error,
        'Save Collection',
        () => handleSubmit() // Retry the entire submission
      );
    } finally {
      setSubmitting(false);
    }
  };

  const retryOnlineSubmission = async (collectionData) => {
    try {
      await rentCollectionsApi.submitCollection(collectionData);
      Alert.alert('Success', 'Rent collection submitted successfully!');
      resetForm();
      syncPendingData();
    } catch (error) {
      const errorInfo = ErrorHandler.handleApiError(error, 'retryOnlineSubmission');
      console.error('Retry failed:', errorInfo);
      
      // Fall back to offline storage
      Alert.alert(
        'Retry Failed',
        'Online submission failed again. Saving offline instead.',
        [
          { text: 'Save Offline', onPress: () => saveOffline(collectionData) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const saveOfflineWithRetry = async (collectionData, retryCount = 0) => {
    try {
      await saveOffline(collectionData);
    } catch (error) {
      const errorInfo = ErrorHandler.handleApiError(error, 'saveOfflineWithRetry');
      console.error('Error saving offline:', errorInfo);
      
      if (retryCount < 2) {
        // Retry after short delay
        setTimeout(() => {
          saveOfflineWithRetry(collectionData, retryCount + 1);
        }, 1000);
      } else {
        // Max retries exceeded
        Alert.alert(
          'Save Failed',
          'Unable to save collection even offline. Please try again later.',
          [{ text: 'OK', style: 'cancel' }]
        );
      }
    }
  };

  const saveOffline = async (collectionData) => {
    try {
      await addPendingCollection(collectionData);
      await updatePendingCount();
      
      Alert.alert(
        'Saved Offline',
        'Collection saved locally. It will sync automatically when internet connection is restored.',
        [
          { text: 'OK', style: 'default' },
          { text: 'Manual Sync Now', onPress: () => triggerManualSync() },
        ]
      );
      
      resetForm();
    } catch (error) {
      const errorInfo = ErrorHandler.handleApiError(error, 'saveOffline');
      console.error('Error saving offline:', errorInfo);
      throw error;
    }
  };

  const triggerManualSync = async () => {
    if (!isOnline) {
      ErrorHandler.showOfflineError('Sync');
      return;
    }
    
    try {
      await manualSync({ showAlerts: true, syncTenantsFirst: true });
    } catch (error) {
      // Error is already handled by manualSync with showAlerts: true
      console.error('Manual sync failed:', error);
    }
  };

  const resetForm = () => {
    setSelectedTenantId('');
    setCollectedBy('');
    setAmount('');
    setPaymentMode('cash');
    setNotes('');
    setSubmitError(null);
  };

  const refreshTenants = async () => {
    if (!isOnline) {
      ErrorHandler.showOfflineError('Refresh Tenants');
      return;
    }
    
    setLoading(true);
    try {
      const freshTenants = await rentCollectionsApi.getTenants();
      setTenants(freshTenants);
      Alert.alert('Success', 'Tenants list refreshed successfully');
    } catch (error) {
      const errorInfo = ErrorHandler.handleApiError(error, 'refreshTenants');
      ErrorHandler.showErrorAlert(error, 'Refresh Tenants');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return `$${parseFloat(value || 0).toFixed(2)}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading tenants...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Collect Rent</Text>
      <Text style={styles.subtitle}>
        {isOnline ? '✅ Online - Submitting directly to server' : '⚠️ Offline - Saving locally'}
      </Text>

      {submitError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {submitError}</Text>
          <TouchableOpacity onPress={() => setSubmitError(null)}>
            <Text style={styles.dismissError}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.form}>
        {/* Tenant Selection */}
        <View style={styles.field}>
          <View style={styles.fieldHeader}>
            <Text style={styles.label}>Tenant *</Text>
            <TouchableOpacity onPress={refreshTenants} disabled={!isOnline || loading}>
              <Text style={[styles.refreshButton, (!isOnline || loading) && styles.refreshButtonDisabled]}>
                Refresh
              </Text>
            </TouchableOpacity>
          </View>
          {tenants.length === 0 ? (
            <View style={styles.noTenants}>
              <Text style={styles.noTenantsText}>
                {isOnline ? 'No tenants available' : 'No cached tenants. Connect to internet to load tenants.'}
              </Text>
              {isOnline && (
                <TouchableOpacity onPress={refreshTenants} style={styles.loadTenantsButton}>
                  <Text style={styles.loadTenantsButtonText}>Load Tenants</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedTenantId}
                onValueChange={(itemValue) => setSelectedTenantId(itemValue)}
                style={styles.picker}
              >
                <Picker.Item label="Select a tenant..." value="" />
                {tenants.map((tenant) => (
                  <Picker.Item
                    key={tenant.id || tenant.tenantId}
                    label={`${tenant.name} - ${tenant.building || ''} ${tenant.roomNumber || ''}`}
                    value={tenant.id || tenant.tenantId}
                  />
                ))}
              </Picker>
            </View>
          )}
        </View>

        {/* Collector Name */}
        <View style={styles.field}>
          <Text style={styles.label}>Collected By *</Text>
          <TextInput
            style={styles.input}
            value={collectedBy}
            onChangeText={setCollectedBy}
            placeholder="Enter collector name"
            editable={!submitting}
          />
        </View>

        {/* Amount */}
        <View style={styles.field}>
          <Text style={styles.label}>Amount *</Text>
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={[styles.input, styles.amountInput]}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              editable={!submitting}
            />
          </View>
          {amount && (
            <Text style={styles.amountPreview}>{formatCurrency(amount)}</Text>
          )}
        </View>

        {/* Payment Mode */}
        <View style={styles.field}>
          <Text style={styles.label}>Payment Mode</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={paymentMode}
              onValueChange={(itemValue) => setPaymentMode(itemValue)}
              style={styles.picker}
              enabled={!submitting}
            >
              <Picker.Item label="Cash" value="cash" />
              <Picker.Item label="Bank Transfer" value="bank_transfer" />
              <Picker.Item label="Check" value="check" />
              <Picker.Item label="Mobile Payment" value="mobile_payment" />
              <Picker.Item label="Other" value="other" />
            </Picker>
          </View>
        </View>

        {/* Notes */}
        <View style={styles.field}>
          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Additional notes about this collection"
            multiline
            numberOfLines={3}
            editable={!submitting}
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>
              {isOnline ? 'Submit Collection' : 'Save Offline'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Manual Sync Option */}
        <TouchableOpacity
          style={styles.syncButton}
          onPress={triggerManualSync}
          disabled={submitting}
        >
          <Text style={styles.syncButtonText}>🔄 Manual Sync Now</Text>
        </TouchableOpacity>

        {/* Status Info */}
        <View style={styles.statusInfo}>
          <Text style={styles.statusText}>
            {isOnline 
              ? 'Your collection will be submitted directly to the server.'
              : 'Your collection will be saved locally and synced when you reconnect.'
            }
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  errorContainer: {
    backgroundColor: '#FFE5E5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 14,
    flex: 1,
  },
  dismissError: {
    color: '#666',
    fontSize: 12,
    marginLeft: 8,
  },
  form: {
    flex: 1,
  },
  field: {
    marginBottom: 20,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  refreshButton: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  refreshButtonDisabled: {
    color: '#999',
  },
  noTenants: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  noTenantsText: {
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  loadTenantsButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  loadTenantsButtonText: {
    color: '#FFF',
    fontWeight: '500',
  },
  pickerContainer: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
    marginBottom: 8,
  },
  amountInput: {
    flex: 1,
  },
  amountPreview: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  submitButtonDisabled: {
    backgroundColor: '#999',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  syncButton: {
    backgroundColor: '#6C757D',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  syncButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
  statusInfo: {
    backgroundColor: '#E8F4FD',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  statusText: {
    color: '#0C5460',
    fontSize: 14,
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  }
});

export default CollectionForm;