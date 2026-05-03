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
  Image,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';

const NewTenantBookingScreen = () => {
  const navigation = useNavigation();

  // Mock data for dropdowns
  const buildings = [
    { id: '1', name: 'Downtown Plaza V' },
    { id: '2', name: 'Business Bay Tower' },
    { id: '3', name: 'Marina Heights' },
    { id: '4', name: 'Jumeirah Lake Towers' },
  ];

  const floors = [
    { id: '1', label: 'Floor 1' },
    { id: '2', label: 'Floor 2' },
    { id: '3', label: 'Floor 3' },
    { id: '4', label: 'Floor 4' },
    { id: '5', label: 'Floor 5' },
  ];

  const rooms = [
    { id: '1', label: 'A-301' },
    { id: '2', label: 'A-302' },
    { id: '3', label: 'A-303' },
    { id: '4', label: 'A-304' },
    { id: '5', label: 'A-305' },
    { id: '6', label: 'B-401' },
    { id: '7', label: 'B-402' },
  ];

  // Form state
  const [selectedBuilding, setSelectedBuilding] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('5000');
  const [loading, setLoading] = useState(false);
  const [frontDocument, setFrontDocument] = useState(null);
  const [backDocument, setBackDocument] = useState(null);

  // Focus states for inputs
  const [focusedInput, setFocusedInput] = useState(null);

  useEffect(() => {
    // Pre-select first values for demo
    if (buildings.length > 0 && !selectedBuilding) {
      setSelectedBuilding(buildings[0].id);
    }
    if (floors.length > 0 && !selectedFloor) {
      setSelectedFloor(floors[0].id);
    }
    if (rooms.length > 0 && !selectedRoom) {
      setSelectedRoom(rooms[0].id);
    }
  }, []);

  const handleConfirmBooking = () => {
    if (!tenantName.trim()) {
      Alert.alert('Validation Error', 'Please enter tenant name');
      return;
    }
    if (!phoneNumber.trim()) {
      Alert.alert('Validation Error', 'Please enter phone number');
      return;
    }
    if (!emailAddress.trim()) {
      Alert.alert('Validation Error', 'Please enter email address');
      return;
    }
    if (!monthlyRent || parseFloat(monthlyRent) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid monthly rent');
      return;
    }

    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      Alert.alert(
        'Booking Confirmed',
        `Tenant ${tenantName} has been booked successfully.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    }, 1500);
  };

  const handleScanFront = () => {
    Alert.alert('Scan Document', 'Front document scan functionality would open camera here.');
    // In real app, integrate with camera/document scanner
    setFrontDocument('scanned_front.png');
  };

  const handleScanBack = () => {
    Alert.alert('Scan Document', 'Back document scan functionality would open camera here.');
    setBackDocument('scanned_back.png');
  };

  const getSelectedBuildingName = () => {
    const building = buildings.find(b => b.id === selectedBuilding);
    return building ? building.name : '';
  };

  const getSelectedFloorLabel = () => {
    const floor = floors.find(f => f.id === selectedFloor);
    return floor ? floor.label : '';
  };

  const getSelectedRoomLabel = () => {
    const room = rooms.find(r => r.id === selectedRoom);
    return room ? room.label : '';
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header with back arrow and title */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Tenant Booking</Text>
          <View style={styles.headerRightPlaceholder} />
        </View>

        {/* ROOM INFORMATION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ROOM INFORMATION</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Select Building:</Text>
            <View style={[styles.pickerContainer, focusedInput === 'building' && styles.inputFocused]}>
              <Picker
                selectedValue={selectedBuilding}
                onValueChange={(itemValue) => setSelectedBuilding(itemValue)}
                onFocus={() => setFocusedInput('building')}
                onBlur={() => setFocusedInput(null)}
                style={styles.picker}
              >
                {buildings.map((building) => (
                  <Picker.Item key={building.id} label={building.name} value={building.id} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Select Floor:</Text>
            <View style={[styles.pickerContainer, focusedInput === 'floor' && styles.inputFocused]}>
              <Picker
                selectedValue={selectedFloor}
                onValueChange={(itemValue) => setSelectedFloor(itemValue)}
                onFocus={() => setFocusedInput('floor')}
                onBlur={() => setFocusedInput(null)}
                style={styles.picker}
              >
                {floors.map((floor) => (
                  <Picker.Item key={floor.id} label={floor.label} value={floor.id} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Select Room #:</Text>
            <View style={[styles.pickerContainer, focusedInput === 'room' && styles.inputFocused]}>
              <Picker
                selectedValue={selectedRoom}
                onValueChange={(itemValue) => setSelectedRoom(itemValue)}
                onFocus={() => setFocusedInput('room')}
                onBlur={() => setFocusedInput(null)}
                style={styles.picker}
              >
                {rooms.map((room) => (
                  <Picker.Item key={room.id} label={room.label} value={room.id} />
                ))}
              </Picker>
            </View>
          </View>
        </View>

        {/* TENANT INFORMATION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TENANT INFORMATION</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Tenant Name:</Text>
            <TextInput
              style={[styles.input, focusedInput === 'name' && styles.inputFocused]}
              placeholder="Enter full name"
              value={tenantName}
              onChangeText={setTenantName}
              onFocus={() => setFocusedInput('name')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Phone Number:</Text>
            <TextInput
              style={[styles.input, focusedInput === 'phone' && styles.inputFocused]}
              placeholder="+971-XX-XXXXXXX"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              onFocus={() => setFocusedInput('phone')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email Address:</Text>
            <TextInput
              style={[styles.input, focusedInput === 'email' && styles.inputFocused]}
              placeholder="email@example.com"
              value={emailAddress}
              onChangeText={setEmailAddress}
              keyboardType="email-address"
              autoCapitalize="none"
              onFocus={() => setFocusedInput('email')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Monthly Rent (AED):</Text>
            <TextInput
              style={[styles.input, focusedInput === 'rent' && styles.inputFocused]}
              placeholder="5000"
              value={monthlyRent}
              onChangeText={setMonthlyRent}
              keyboardType="numeric"
              onFocus={() => setFocusedInput('rent')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>
        </View>

        {/* DOCUMENTS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DOCUMENTS</Text>
          <Text style={styles.documentSubtitle}>NID / Passport Front:</Text>
          
          <View style={styles.documentRow}>
            <TouchableOpacity style={styles.documentBox} onPress={handleScanFront}>
              <View style={styles.documentIcon}>
                <Text style={styles.documentIconText}>📷</Text>
              </View>
              <Text style={styles.documentLabel}>Tap to Scan</Text>
              {frontDocument && (
                <Text style={styles.documentScanned}>✓ Scanned</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.documentBox} onPress={handleScanBack}>
              {backDocument ? (
                <View style={styles.thumbnailContainer}>
                  <Text style={styles.thumbnailPlaceholder}>Thumbnail</Text>
                </View>
              ) : (
                <>
                  <View style={styles.documentIcon}>
                    <Text style={styles.documentIconText}>📄</Text>
                  </View>
                  <Text style={styles.documentLabel}>Tap to Scan</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* CONFIRM BOOKING BUTTON */}
        <TouchableOpacity
          style={[styles.confirmButton, loading && styles.confirmButtonDisabled]}
          onPress={handleConfirmBooking}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.confirmButtonText}>CONFIRM BOOKING (SUBMIT)</Text>
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
  documentSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 12,
  },
  documentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  documentBox: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#dee2e6',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  documentIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  documentIconText: {
    fontSize: 30,
  },
  documentLabel: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
  documentScanned: {
    fontSize: 12,
    color: '#28a745',
    marginTop: 8,
    fontWeight: '500',
  },
  thumbnailContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e9ecef',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailPlaceholder: {
    fontSize: 14,
    color: '#6c757d',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  confirmButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  confirmButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  spacer: {
    height: 20,
  },
});

export default NewTenantBookingScreen;