import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState, createContext, useContext, useCallback, useMemo } from 'react';

// Create context for network status
const NetworkContext = createContext();

export const NetworkProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState(true);
  const [connectionType, setConnectionType] = useState('unknown');
  const [networkListeners, setNetworkListeners] = useState([]);

  useEffect(() => {
    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected;
      const reachable = state.isInternetReachable;
      const type = state.type;
      
      setIsConnected(connected);
      setIsInternetReachable(reachable !== null ? reachable : connected);
      setConnectionType(type);
      
      // Notify all listeners when network status changes
      if (connected && reachable) {
        networkListeners.forEach(listener => {
          if (typeof listener === 'function') {
            listener(true);
          }
        });
      }
    });

    // Get initial network state
    NetInfo.fetch().then(state => {
      setIsConnected(state.isConnected);
      setIsInternetReachable(state.isInternetReachable !== null ? state.isInternetReachable : state.isConnected);
      setConnectionType(state.type);
    });

    return () => {
      unsubscribe();
    };
  }, [networkListeners]);

  const addNetworkListener = useCallback((listener) => {
    setNetworkListeners(prev => [...prev, listener]);
    
    // Return cleanup function
    return () => {
      setNetworkListeners(prev => prev.filter(l => l !== listener));
    };
  }, []);

  const removeNetworkListener = useCallback((listener) => {
    setNetworkListeners(prev => prev.filter(l => l !== listener));
  }, []);

  const value = useMemo(() => ({
    isConnected,
    isInternetReachable,
    connectionType,
    isOnline: isConnected && isInternetReachable,
    addNetworkListener,
    removeNetworkListener,
  }), [isConnected, isInternetReachable, connectionType, addNetworkListener, removeNetworkListener]);

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within NetworkProvider');
  }
  return context;
};

// Utility functions for network detection
export const checkNetworkConnection = async () => {
  try {
    const state = await NetInfo.fetch();
    return {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable !== null ? state.isInternetReachable : state.isConnected,
      type: state.type,
      details: state.details,
    };
  } catch (error) {
    console.error('Error checking network connection:', error);
    return {
      isConnected: false,
      isInternetReachable: false,
      type: 'unknown',
      details: null,
    };
  }
};

export const waitForConnection = (timeout = 30000) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkConnection = async () => {
      const state = await NetInfo.fetch();
      const isOnline = state.isConnected && 
        (state.isInternetReachable !== null ? state.isInternetReachable : state.isConnected);
      
      if (isOnline) {
        resolve(true);
        return;
      }
      
      if (Date.now() - startTime > timeout) {
        reject(new Error('Network connection timeout'));
        return;
      }
      
      // Check again after 1 second
      setTimeout(checkConnection, 1000);
    };
    
    checkConnection();
  });
};

// Network-aware fetch wrapper
export const networkFetch = async (url, options = {}, retryCount = 3) => {
  const { isOnline } = await checkNetworkConnection();
  
  if (!isOnline) {
    throw new Error('No network connection available');
  }
  
  let lastError;
  
  for (let i = 0; i < retryCount; i++) {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      lastError = error;
      
      // Wait before retrying (exponential backoff)
      if (i < retryCount - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError;
};

export default {
  NetworkProvider,
  useNetwork,
  checkNetworkConnection,
  waitForConnection,
  networkFetch,
};