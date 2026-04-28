# Rent Management Mobile App - Offline Capable

A React Native (Expo) mobile application for rent collection with full offline capability, automatic background sync, and robust error handling.

## Features

- **Full Offline Operation**: Collect rent without internet connection
- **Automatic Background Sync**: Syncs pending collections when connection is restored
- **SQLite Local Storage**: Production-grade local database for offline data
- **Network Detection**: Real-time network status monitoring
- **Error Handling**: Comprehensive error handling with retry logic
- **Manual Sync**: User-controlled synchronization with progress tracking
- **Tenant Caching**: Cache tenant data for offline access
- **UI Indicators**: Visual feedback for network status and sync state

## Project Structure

```
mobile-app/
├── App.js                    # Main application component
├── package.json              # Dependencies and scripts
├── src/
│   ├── components/           # React components
│   │   ├── CollectionForm.js # Rent collection form with offline flow
│   │   ├── NetworkStatusBanner.js # Network status UI
│   │   ├── SyncStatus.js     # Sync status and controls
│   │   └── OfflineTest.js    # Offline functionality testing
│   ├── services/             # Business logic services
│   │   ├── api.js            # API communication layer
│   │   ├── network.js        # Network detection service
│   │   └── syncService.js    # Background sync engine
│   ├── store/                # Local storage
│   │   └── offlineStore.js   # SQLite database with context provider
│   └── utils/                # Utility functions
│       ├── errorHandler.js   # Error handling utilities
│       └── tenantCache.js    # Tenant caching with hooks
```

## Key Components

### 1. Offline Store (`src/store/offlineStore.js`)
- SQLite database for local storage
- Tables: `pending_collections`, `cached_tenants`, `sync_history`
- Context provider for React components
- CRUD operations with async/await

### 2. Sync Engine (`src/services/syncService.js`)
- Automatic sync on network restoration
- Manual sync with progress tracking
- Retry logic with exponential backoff
- Error handling and status reporting

### 3. Network Detection (`src/services/network.js`)
- Real-time network status monitoring
- Connection type detection (WiFi, cellular, etc.)
- Event listeners for network changes

### 4. Collection Form (`src/components/CollectionForm.js`)
- Conditional online/offline submission
- Form validation
- Error handling with retry options
- Integration with offline store and sync engine

### 5. Error Handling (`src/utils/errorHandler.js`)
- Categorized error handling (network, server, validation)
- User-friendly error messages
- Retry logic and exponential backoff
- Error logging and reporting

## Installation

1. Navigate to the mobile-app directory:
   ```bash
   cd mobile-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Expo development server:
   ```bash
   npx expo start
   ```

4. Run on your preferred platform:
   - Press `a` for Android emulator
   - Press `i` for iOS simulator
   - Scan QR code with Expo Go app on physical device

## Dependencies

- **expo-sqlite**: SQLite database for local storage
- **@react-native-async-storage/async-storage**: Simple key-value storage
- **@react-native-community/netinfo**: Network information
- **axios**: HTTP client for API calls
- **react-native-uuid**: UUID generation for unique IDs
- **@react-native-picker/picker**: Dropdown picker component

## Testing Offline Functionality

The app includes a built-in testing screen to verify offline functionality:

1. **Access Test Screen**: Tap "Test Offline Features" button on main screen
2. **Run Tests**: Use the test controls to verify:
   - Network detection
   - Offline storage
   - Sync engine
   - Error handling
   - Manual sync

### Manual Testing Steps:
1. Turn off WiFi/mobile data
2. Submit a rent collection (should save offline)
3. Check pending collections count increases
4. Turn network back on
5. Observe automatic sync
6. Verify collection appears in server

## Error Handling Scenarios

The app handles various error scenarios:

1. **Network Errors**: Falls back to offline storage, retries when online
2. **Server Errors**: Marks failed items for retry, shows user-friendly messages
3. **Validation Errors**: Client-side validation with clear feedback
4. **Storage Errors**: Retry logic with exponential backoff

## Performance Considerations

- **Non-blocking UI**: All database operations run in background
- **Batch Processing**: Collections synced in batches to prevent UI freeze
- **Memory Management**: SQLite database with proper connection management
- **Background Sync**: Minimal battery impact with intelligent scheduling

## Future Enhancements

1. **Conflict Resolution**: Handle data conflicts when same record modified offline by multiple users
2. **Background Fetch**: Use Expo's BackgroundFetch API for periodic sync
3. **Data Compression**: Compress offline data to save storage space
4. **Analytics**: Track sync success rates and error patterns
5. **Push Notifications**: Notify users when sync completes or fails

## API Integration

The app expects a backend API with the following endpoints:

- `GET /api/tenants` - Retrieve tenant list
- `POST /api/rent-collections` - Submit rent collection
- The API should support idempotent operations using `localId` field

Configure the API base URL in `src/services/api.js`.

## License

Proprietary - Rent Management System