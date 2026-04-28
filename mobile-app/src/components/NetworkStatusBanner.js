import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetwork } from '../services/network';

const NetworkStatusBanner = () => {
  const { isOnline, connectionType } = useNetwork();

  if (isOnline) {
    return (
      <View style={[styles.banner, styles.onlineBanner]}>
        <Text style={styles.bannerText}>
          ✅ Online ({connectionType}) - Data will sync automatically
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.banner, styles.offlineBanner]}>
      <Text style={styles.bannerText}>
        ⚠️ Offline Mode - Collections saved locally. Will sync when connection is restored.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineBanner: {
    backgroundColor: '#d4edda',
    borderBottomWidth: 1,
    borderBottomColor: '#c3e6cb',
  },
  offlineBanner: {
    backgroundColor: '#fff3cd',
    borderBottomWidth: 1,
    borderBottomColor: '#ffeaa7',
  },
  bannerText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default NetworkStatusBanner;