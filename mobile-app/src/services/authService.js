import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from './api';
import { errorHandler } from '../utils/errorHandler';

const AUTH_STORAGE_KEY = '@rent_management_auth';
const USER_STORAGE_KEY = '@rent_management_user';

class AuthService {
  // Check if user is authenticated
  static async isAuthenticated() {
    try {
      const authData = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (!authData) return false;

      const parsedData = JSON.parse(authData);
      // Check if token exists and is not expired
      if (parsedData.token && parsedData.expiresAt) {
        const now = new Date().getTime();
        if (now < parsedData.expiresAt) {
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error checking authentication:', error);
      return false;
    }
  }

  // Login with username and password
  static async login(username, password) {
    try {
      // Call authentication API
      const response = await authApi.login(username, password);
      
      if (response.success) {
        const { user, token } = response.data;
        
        // Calculate token expiration (24 hours from now)
        const expiresAt = new Date().getTime() + (24 * 60 * 60 * 1000);
        
        // Store authentication data
        const authData = {
          token,
          expiresAt,
          userId: user.id,
          username: user.username,
        };
        
        await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
        
        return {
          success: true,
          user,
          token,
        };
      } else {
        return {
          success: false,
          error: response.error || 'Login failed',
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorInfo = errorHandler.handleApiError(error, 'Login');
      return {
        success: false,
        error: errorInfo.userMessage,
        technicalError: errorInfo.technicalMessage,
      };
    }
  }

  // Get current user data
  static async getCurrentUser() {
    try {
      const userData = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (!userData) return null;
      
      return JSON.parse(userData);
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  // Get authentication token
  static async getToken() {
    try {
      const authData = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (!authData) return null;
      
      const parsedData = JSON.parse(authData);
      return parsedData.token;
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  }

  // Logout user
  static async logout() {
    try {
      // Call logout API if needed
      await authApi.logout();
    } catch (error) {
      // Ignore logout API errors
      console.warn('Logout API error (ignored):', error);
    } finally {
      // Clear local storage
      await AsyncStorage.multiRemove([AUTH_STORAGE_KEY, USER_STORAGE_KEY]);
    }
  }

  // Check and refresh token if needed
  static async checkAndRefreshToken() {
    try {
      const authData = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (!authData) return false;

      const parsedData = JSON.parse(authData);
      const now = new Date().getTime();
      const timeUntilExpiry = parsedData.expiresAt - now;
      
      // If token expires in less than 1 hour, refresh it
      if (timeUntilExpiry < 60 * 60 * 1000) {
        // In a real app, call refresh token endpoint
        // For now, we'll just extend the expiration
        const newExpiresAt = now + (24 * 60 * 60 * 1000);
        parsedData.expiresAt = newExpiresAt;
        await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsedData));
      }
      
      return true;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
  }

  // Initialize authentication state
  static async initialize() {
    try {
      const isAuthenticated = await this.isAuthenticated();
      if (isAuthenticated) {
        await this.checkAndRefreshToken();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error initializing auth:', error);
      return false;
    }
  }
}

export default AuthService;