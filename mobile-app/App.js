import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import NetworkStatusBanner from './src/components/NetworkStatusBanner';
import SyncStatus from './src/components/SyncStatus';
import CollectionForm from './src/components/CollectionForm';
import OfflineTest from './src/components/OfflineTest';
import LoginScreen from './src/components/LoginScreen';
import { NetworkProvider } from './src/services/network';
import { SyncProvider } from './src/services/syncService';
import { OfflineStoreProvider } from './src/store/offlineStore';
import AuthService from './src/services/authService';

export default function App() {
  const [showTestScreen, setShowTestScreen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      const authenticated = await AuthService.isAuthenticated();
      if (authenticated) {
        const currentUser = await AuthService.getCurrentUser();
        setUser(currentUser);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Error checking authentication:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = async () => {
    const currentUser = await AuthService.getCurrentUser();
    setUser(currentUser);
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    await AuthService.logout();
    setIsAuthenticated(false);
    setUser(null);
  };

  const MainApp = () => (
    <ScrollView style={styles.content}>
      <View style={styles.header}>
        <View style={styles.userHeader}>
          <View>
            <Text style={styles.title}>Rent Collection</Text>
            <Text style={styles.subtitle}>Offline-capable rent management</Text>
          </View>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
        {user && (
          <Text style={styles.welcomeText}>
            Welcome back, {user.name || user.username}!
          </Text>
        )}
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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContent}>
          <View style={styles.loadingLogo}>
            <Text style={styles.loadingLogoText}>RM</Text>
          </View>
          <Text style={styles.loadingText}>Loading Rent Management</Text>
          <ActivityIndicator size="large" color="#007AFF" style={styles.loadingSpinner} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

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
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  header: {
    marginBottom: 32,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  welcomeText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e6f2ff',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  placeholder: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 24,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  testButton: {
    backgroundColor: '#6C757D',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 24,
    shadowColor: '#6C757D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  testButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  testContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  testHeader: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    marginRight: 16,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  testTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingLogo: {
    width: 80,
    height: 80,
    backgroundColor: '#007AFF',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  loadingLogoText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 24,
  },
  loadingSpinner: {
    marginTop: 8,
  },
});