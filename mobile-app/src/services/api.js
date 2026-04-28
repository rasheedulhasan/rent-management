// API service for communicating with backend
import axios from 'axios';

// Use environment variable or fallback to local IP for development
// For production, set REACT_NATIVE_API_BASE_URL in .env or build configuration
const API_BASE_URL = process.env.REACT_NATIVE_API_BASE_URL || 'http://192.168.1.213:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, // Increased timeout for mobile networks
  headers: {
    'Content-Type': 'application/json',
  },
});

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
      return response.data;
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