// API service for communicating with backend
import axios from 'axios';
import { Platform } from 'react-native';

// Determine API base URL based on environment
// For development on Android emulator: use 10.0.2.2:3001
// For development on iOS simulator: use localhost:3001
// For physical device development: use your computer's IP address
// For production: use environment variable or production URL
let API_BASE_URL;

if (__DEV__) {
  // Development mode
  if (Platform.OS === 'android') {
    // Android emulator uses 10.0.2.2 to connect to localhost on host machine
    API_BASE_URL = 'http://10.0.2.2:3001/api';
  } else if (Platform.OS === 'ios') {
    // iOS simulator can use localhost
    API_BASE_URL = 'http://localhost:3001/api';
  } else {
    // Fallback for web or other platforms
    API_BASE_URL = 'http://localhost:3001/api';
  }
} else {
  // Production mode - use environment variable or production URL
  API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ||
                 process.env.REACT_NATIVE_API_BASE_URL ||
                 'https://monkfish-app-a3cq3.ondigitalocean.app/api';
}

console.log('API Base URL:', API_BASE_URL, 'Platform:', Platform.OS);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // Increased timeout for mobile networks and development
  headers: {
    'Content-Type': 'application/json',
  },
});

// Authentication API
export const authApi = {
  // Validate user credentials (login)
  login: async (username, password) => {
    try {
      const response = await api.post('/users/validate', { username, password });
      return response.data;
    } catch (error) {
      console.error('Error during login:', error);
      throw error;
    }
  },

  // Get current user profile
  getProfile: async () => {
    try {
      const response = await api.get('/users/profile');
      return response.data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      throw error;
    }
  },

  // Logout
  logout: async () => {
    try {
      const response = await api.post('/users/logout');
      return response.data;
    } catch (error) {
      console.error('Error during logout:', error);
      throw error;
    }
  },
};

// Rent collections API
export const rentCollectionsApi = {
  // Submit a rent collection
  submitCollection: async (collectionData) => {
    try {
      // Transform mobile app data format to backend format
      const selectedTenant = collectionData.tenant;
      const transformedData = {
        tenant_id: collectionData.tenantId,
        // Use room_id from tenant if available, otherwise use a default
        room_id: selectedTenant?.room_id || selectedTenant?.roomId || selectedTenant?.roomNumber || 'default_room',
        collected_by: collectionData.collectedBy,
        amount: collectionData.amount,
        payment_method: collectionData.paymentMode,
        payment_status: 'paid', // Default to paid for collections
        monthly_rent: selectedTenant?.monthly_rent || selectedTenant?.monthlyRent || 0,
        rent_due_date: new Date().toISOString().split('T')[0], // Today's date as due date
        remarks: collectionData.notes || '',
        transaction_date: collectionData.collectedAt || new Date().toISOString(),
      };
      
      console.log('Submitting transaction:', transformedData);
      const response = await api.post('/transactions', transformedData);
      return response.data;
    } catch (error) {
      console.error('Error submitting collection:', error);
      throw error;
    }
  },

  // Get tenants list
  getTenants: async () => {
    try {
      const response = await api.get('/tenants');
      // Backend returns { success: true, data: [], total: ... }
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.error || 'Failed to fetch tenants');
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
      throw error;
    }
  },

  // Check if collection already exists (idempotency check)
  checkDuplicate: async (localId) => {
    try {
      const response = await api.get(`/transactions/check?localId=${localId}`);
      return response.data.exists;
    } catch (error) {
      // If endpoint doesn't exist, assume no duplicate
      return false;
    }
  },
};

export default api;