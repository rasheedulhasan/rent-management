import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  SafeAreaView, 
  StatusBar, 
  ScrollView, 
  TouchableOpacity,
  Modal 
} from 'react-native';
import NetworkStatusBanner from './src/components/NetworkStatusBanner';
import SyncStatus from './src/components/SyncStatus';
import CollectionForm from './src/components/CollectionForm';
import OfflineTest from './src/components/OfflineTest';
import { NetworkProvider } from './src/services/network';
import { SyncProvider } from './src/services/syncService';
import { OfflineStoreProvider } from './src/store/offlineStore';

export default function App() {
  const [showTestScreen, setShowTestScreen] = useState(false);

  const MainApp = () => (
    <ScrollView style={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Rent Collection</Text>
        <Text style={styles.subtitle}>Offline-capable rent management</Text>
      </View>
      <SyncStatus />
      <CollectionForm />
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Collections</Text>
        <Text style={styles.placeholder}>No collections yet</Text>
      </View>
      <TouchableOpacity 
        style={styles.testButton}
        onPress={() => setShowTestScreen(true)}
      >
        <Text style={styles.testButtonText}>🧪 Test Offline Features</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const TestScreen = () => (
    <View style={styles.testContainer}>
      <View style={styles.testHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setShowTestScreen(false)}
        >
          <Text style={styles.backButtonText}>← Back to App</Text>
        </TouchableOpacity>
        <Text style={styles.testTitle}>Offline Functionality Tests</Text>
      </View>
      <OfflineTest />
    </View>
  );

  return (
    <OfflineStoreProvider>
      <NetworkProvider>
        <SyncProvider>
          <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <NetworkStatusBanner />
            {showTestScreen ? <TestScreen /> : <MainApp />}
          </SafeAreaView>
        </SyncProvider>
      </NetworkProvider>
    </OfflineStoreProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  section: {
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  placeholder: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  testButton: {
    backgroundColor: '#6C757D',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  testButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
  testContainer: {
    flex: 1,
  },
  testHeader: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 12,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  testTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
});