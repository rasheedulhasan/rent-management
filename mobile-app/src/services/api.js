// API service for communicating with backend
import axios from 'axios';

// Use environment variable or fallback to local IP for development
// For production, set REACT_NATIVE_API_BASE_URL in .env or build configuration
const API_BASE_URL = process.env.REACT_NATIVE_API_BASE_URL || 'https://monkfish-app-a3cq3.ondigitalocean.app/rent-management/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, // Increased timeout for mobile networks
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
      const response = await api.post('/rent_collections', collectionData);
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
      const response = await api.get(`/rent_collections/check?localId=${localId}`);
      return response.data.exists;
    } catch (error) {
      // If endpoint doesn't exist, assume no duplicate
      return false;
    }
  },
};

export default api;