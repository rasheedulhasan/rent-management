import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';

const AdvancePaymentScreen = () => {
  const navigation = useNavigation();

  // Mock data
  const tenants = [
    { id: '1', name: 'John Smith', room: 'A-305' },
    { id: '2', name: 'Emma Johnson', room: 'B-402' },
    { id: '3', name: 'Ahmed Hassan', room: 'A-301' },
    { id: '4', name: 'Maria Garcia', room: 'C-201' },
  ];

  const paymentTypes = [
    { id: 'security_deposit', label: 'Security Deposit' },
    { id: 'advance_rent', label: 'Advance Rent' },
    { id: 'utility_deposit', label: 'Utility Deposit' },
    { id: 'other', label: 'Other' },
  ];

  const paymentMethods = [
    { id: 'cash', label: 'Cash' },
    { id: 'bank_transfer', label: 'Bank Transfer' },
    { id: 'cheque', label: 'Cheque' },
    { id: 'card', label: 'Credit/Debit Card' },
  ];

  // Form state
  const [selectedTenant, setSelectedTenant] = useState('');
  const [selectedPaymentType, setSelectedPaymentType] = useState('security_deposit');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cash');
  const [amount, setAmount] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);

  useEffect(() => {
    // Pre-select first tenant
    if (tenants.length > 0 && !selectedTenant) {
      setSelectedTenant(tenants[0].id);
    }
  }, []);

  const handleSubmit = () => {
    if (!selectedTenant) {
      Alert.alert('Validation Error', 'Please select a tenant');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount');
      return;
    }

    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      const tenant = tenants.find(t => t.id === selectedTenant);
      Alert.alert(
        'Payment Recorded',
        `Advance payment of AED ${amount} for ${tenant?.name} has been recorded successfully.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
          {
            text: 'Record Another',
            onPress: () => {
              setAmount('');
              setReferenceNumber('');
              setNotes('');
            },
          },
        ]
      );
    }, 1500);
  };

  const getSelectedTenantName = () => {
    const tenant = tenants.find(t => t.id === selectedTenant);
    return tenant ? `${tenant.name} (${tenant.room})` : '';
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Advance Payment</Text>
          <View style={styles.headerRightPlaceholder} />
        </View>

        {/* PAYMENT DETAILS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PAYMENT DETAILS</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Select Tenant:</Text>
            <View style={[styles.pickerContainer, focusedInput === 'tenant' && styles.inputFocused]}>
              <Picker
                selectedValue={selectedTenant}
                onValueChange={(itemValue) => setSelectedTenant(itemValue)}
                onFocus={() => setFocusedInput('tenant')}
                onBlur={() => setFocusedInput(null)}
                style={styles.picker}
              >
                {tenants.map((tenant) => (
                  <Picker.Item
                    key={tenant.id}
                    label={`${tenant.name} (${tenant.room})`}
                    value={tenant.id}
                  />
                ))}
              </Picker>
            </View>
            {selectedTenant && (
              <Text style={styles.selectedInfo}>
                Selected: {getSelectedTenantName()}
              </Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Payment Type:</Text>
            <View style={[styles.pickerContainer, focusedInput === 'type' && styles.inputFocused]}>
              <Picker
                selectedValue={selectedPaymentType}
                onValueChange={(itemValue) => setSelectedPaymentType(itemValue)}
                onFocus={() => setFocusedInput('type')}
                onBlur={() => setFocusedInput(null)}
                style={styles.picker}
              >
                {paymentTypes.map((type) => (
                  <Picker.Item key={type.id} label={type.label} value={type.id} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Amount (AED):</Text>
            <TextInput
              style={[styles.input, focusedInput === 'amount' && styles.inputFocused]}
              placeholder="0.00"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              onFocus={() => setFocusedInput('amount')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Payment Method:</Text>
            <View style={[styles.pickerContainer, focusedInput === 'method' && styles.inputFocused]}>
              <Picker
                selectedValue={selectedPaymentMethod}
                onValueChange={(itemValue) => setSelectedPaymentMethod(itemValue)}
                onFocus={() => setFocusedInput('method')}
                onBlur={() => setFocusedInput(null)}
                style={styles.picker}
              >
                {paymentMethods.map((method) => (
                  <Picker.Item key={method.id} label={method.label} value={method.id} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Reference Number (Optional):</Text>
            <TextInput
              style={[styles.input, focusedInput === 'reference' && styles.inputFocused]}
              placeholder="e.g., cheque #, transaction ID"
              value={referenceNumber}
              onChangeText={setReferenceNumber}
              onFocus={() => setFocusedInput('reference')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Notes (Optional):</Text>
            <TextInput
              style={[styles.textArea, focusedInput === 'notes' && styles.inputFocused]}
              placeholder="Additional details about this payment"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              onFocus={() => setFocusedInput('notes')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>
        </View>

        {/* SUMMARY */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PAYMENT SUMMARY</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tenant:</Text>
            <Text style={styles.summaryValue}>{getSelectedTenantName()}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Payment Type:</Text>
            <Text style={styles.summaryValue}>
              {paymentTypes.find(t => t.id === selectedPaymentType)?.label}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Amount:</Text>
            <Text style={styles.summaryValue}>AED {amount || '0.00'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Payment Method:</Text>
            <Text style={styles.summaryValue}>
              {paymentMethods.find(m => m.id === selectedPaymentMethod)?.label}
            </Text>
          </View>
        </View>

        {/* SUBMIT BUTTON */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitButtonText}>RECORD ADVANCE PAYMENT</Text>
          )}
        </TouchableOpacity>

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#495057',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212529',
  },
  headerRightPlaceholder: {
    width: 40,
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#495057',
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6c757d',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#212529',
    backgroundColor: '#FFF',
  },
  inputFocused: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#212529',
    backgroundColor: '#FFF',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    backgroundColor: '#FFF',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  selectedInfo: {
    fontSize: 13,
    color: '#28a745',
    marginTop: 8,
    fontStyle: 'italic',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  summaryLabel: {
    fontSize: 15,
    color: '#6c757d',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 15,
    color: '#212529',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#28a745',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  spacer: {
    height: 20,
  },
});

export default AdvancePaymentScreen;