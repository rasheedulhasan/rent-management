import { Alert } from 'react-native';

/**
 * Error handling utility for offline sync and network operations
 */
class ErrorHandler {
  /**
   * Handle API errors with appropriate user feedback
   */
  static handleApiError(error, context = 'operation') {
    // Determine if it's a network error (no response or network error)
    const isNetworkError = !error.response && (error.request || error.message?.includes('Network Error'));
    if (isNetworkError) {
      console.warn(`Network error in ${context}:`, error.message);
    } else {
      console.error(`API Error in ${context}:`, error);
    }
    
    let userMessage = 'An unexpected error occurred';
    let technicalMessage = error.message || 'Unknown error';
    
    // Categorize errors
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      
      switch (status) {
        case 400:
          userMessage = 'Invalid request. Please check your data.';
          break;
        case 401:
          userMessage = 'Authentication failed. Please login again.';
          break;
        case 403:
          userMessage = 'You do not have permission to perform this action.';
          break;
        case 404:
          userMessage = 'Resource not found.';
          break;
        case 409:
          userMessage = 'Conflict detected. This may be a duplicate entry.';
          break;
        case 422:
          userMessage = 'Validation error. Please check your input.';
          break;
        case 429:
          userMessage = 'Too many requests. Please try again later.';
          break;
        case 500:
          userMessage = 'Server error. Please try again later.';
          break;
        case 502:
        case 503:
        case 504:
          userMessage = 'Service temporarily unavailable. Please try again later.';
          break;
        default:
          userMessage = `Server error (${status}). Please try again.`;
      }
      
      technicalMessage = error.response.data?.message || technicalMessage;
      
    } else if (error.request) {
      // Request made but no response
      userMessage = 'Network error. Please check your internet connection.';
      technicalMessage = 'No response from server';
      
    } else if (error.message?.includes('Network Error')) {
      // Network error
      userMessage = 'Network error. Please check your internet connection.';
      technicalMessage = 'Network request failed';
      
    } else if (error.message?.includes('timeout')) {
      // Timeout
      userMessage = 'Request timeout. Please try again.';
      technicalMessage = 'Request timed out';
    }
    
    return {
      userMessage,
      technicalMessage,
      originalError: error,
      shouldRetry: this.shouldRetryError(error),
      retryAfter: this.getRetryDelay(error),
    };
  }
  
  /**
   * Determine if an error should be retried
   */
  static shouldRetryError(error) {
    // Don't retry client errors (4xx) except 429 (rate limit)
    if (error.response) {
      const status = error.response.status;
      if (status >= 400 && status < 500 && status !== 429) {
        return false;
      }
    }
    
    // Retry network errors, timeouts, and server errors
    return true;
  }
  
  /**
   * Calculate retry delay with exponential backoff
   */
  static getRetryDelay(error, attempt = 1) {
    // Base delay in milliseconds
    let baseDelay = 1000;
    
    // For rate limiting, use Retry-After header if available
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers?.['retry-after'];
      if (retryAfter) {
        return parseInt(retryAfter, 10) * 1000;
      }
      return 5000; // 5 seconds for rate limiting
    }
    
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s...
    return Math.min(baseDelay * Math.pow(2, attempt - 1), 30000); // Max 30 seconds
  }
  
  /**
   * Show user-friendly alert for error
   */
  static showErrorAlert(error, context = 'Operation') {
    const { userMessage } = this.handleApiError(error, context);
    
    Alert.alert(
      `${context} Failed`,
      userMessage,
      [
        { text: 'OK', style: 'cancel' },
        { text: 'Retry', onPress: () => {} }, // Callback should be provided by caller
      ]
    );
  }
  
  /**
   * Show error with retry option
   */
  static showErrorWithRetry(error, context, retryCallback) {
    const { userMessage } = this.handleApiError(error, context);
    
    Alert.alert(
      `${context} Failed`,
      userMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Retry', onPress: retryCallback },
      ]
    );
  }
  
  /**
   * Show offline error with options
   */
  static showOfflineError(context = 'Save') {
    Alert.alert(
      'Offline Mode',
      `You are currently offline. ${context} will be saved locally and synced when connection is restored.`,
      [
        { text: 'OK', style: 'default' },
        { text: 'View Pending', onPress: () => {} }, // Navigation callback
      ]
    );
  }
  
  /**
   * Show sync error with details
   */
  static showSyncError(failedCount, totalCount, errorDetails) {
    const message = failedCount > 0 
      ? `${failedCount} of ${totalCount} items failed to sync. ${errorDetails || ''}`
      : 'Sync failed due to network or server error.';
    
    Alert.alert(
      'Sync Failed',
      message,
      [
        { text: 'Dismiss', style: 'cancel' },
        { text: 'Retry Failed Items', onPress: () => {} }, // Callback for retry
        { text: 'View Details', onPress: () => {} }, // Callback for error details
      ]
    );
  }
  
  /**
   * Log error for debugging
   */
  static logError(error, context, additionalData = {}) {
    const errorInfo = this.handleApiError(error, context);
    
    console.error('=== ERROR LOG ===');
    console.error(`Context: ${context}`);
    console.error(`Time: ${new Date().toISOString()}`);
    console.error(`User Message: ${errorInfo.userMessage}`);
    console.error(`Technical: ${errorInfo.technicalMessage}`);
    console.error('Additional Data:', additionalData);
    console.error('Original Error:', error);
    console.error('=== END ERROR LOG ===');
    
    // In a real app, you might send this to an error tracking service
    // Sentry.captureException(error, { extra: { context, ...additionalData } });
    
    return errorInfo;
  }
  
  /**
   * Check if error is a network connectivity issue
   */
  static isNetworkError(error) {
    return (
      !error.response && 
      (error.request || 
       error.message?.includes('Network Error') || 
       error.message?.includes('network') ||
       error.code === 'NETWORK_ERROR')
    );
  }
  
  /**
   * Check if error is a timeout
   */
  static isTimeoutError(error) {
    return (
      error.code === 'ECONNABORTED' ||
      error.message?.includes('timeout') ||
      error.message?.includes('Timeout')
    );
  }
  
  /**
   * Create a user-friendly error message for display
   */
  static getUserFriendlyMessage(error) {
    const { userMessage } = this.handleApiError(error);
    return userMessage;
  }
}

export default ErrorHandler;