/**
 * PendingRentScreen
 * 
 * Modern mobile-friendly Pending Rent Collection screen.
 * Features:
 * - Summary cards (Total Pending, Total Overdue, Occupied Rooms, Pending Tenants)
 * - Card list view with tenant info, room, rent, due date, status badges
 * - Search by tenant name
 * - Filter by payment status
 * - Loading states
 * - Empty states
 * - Pagination
 * 
 * Colors:
 * - Red = overdue
 * - Yellow = pending
 * - Green = paid
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';
import api from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Status badge colors
const STATUS_COLORS = {
  overdue: '#FF3B30',
  pending: '#FF9500',
  paid: '#34C759',
};

const STATUS_BG_COLORS = {
  overdue: '#FFF0F0',
  pending: '#FFF8E8',
  paid: '#F0FFF4',
};

export default function PendingRentScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({
    total_pending: 0,
    total_overdue: 0,
    pending_count: 0,
    overdue_count: 0,
    total_combined: 0,
  });
  const [stats, setStats] = useState({
    occupied_rooms: 0,
    active_tenants: 0,
  });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchData = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      // Build query params
      const params = new URLSearchParams();
      params.append('page', pageNum.toString());
      params.append('limit', '20');
      if (search) params.append('search', search);
      if (statusFilter) params.append('payment_status', statusFilter);

      const response = await api.get(`/rent/pending?${params.toString()}`);
      
      if (response.data.success) {
        if (append) {
          setData(prev => [...prev, ...response.data.data]);
        } else {
          setData(response.data.data);
        }
        setSummary(response.data.summary);
        setTotal(response.data.total);
        setTotalPages(response.data.total_pages);
        setPage(pageNum);
      }
    } catch (error) {
      console.error('Error fetching pending rent data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [search, statusFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get('/rent/pending/stats');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchData(1);
    fetchStats();
  }, [fetchData, fetchStats]);

  // Refetch when filters change
  useEffect(() => {
    fetchData(1);
  }, [statusFilter]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(1);
    fetchStats();
  }, [fetchData, fetchStats]);

  const handleSearch = useCallback(() => {
    fetchData(1);
  }, [fetchData]);

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && page < totalPages) {
      fetchData(page + 1, true);
    }
  }, [loadingMore, page, totalPages, fetchData]);

  const formatCurrency = (amount) => {
    return `${Number(amount).toLocaleString()} AED`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusStyle = (status) => ({
    backgroundColor: STATUS_BG_COLORS[status] || '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  });

  const getStatusTextStyle = (status) => ({
    color: STATUS_COLORS[status] || '#666',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  });

  const renderSummaryCard = (title, value, color, icon) => (
    <View style={[styles.summaryCard, { borderLeftColor: color }]}>
      <Text style={styles.summaryIcon}>{icon}</Text>
      <View style={styles.summaryContent}>
        <Text style={styles.summaryValue}>{value}</Text>
        <Text style={styles.summaryTitle}>{title}</Text>
      </View>
    </View>
  );

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.tenantName}>{item.tenant_name}</Text>
          <Text style={styles.roomNumber}>Room {item.room_number}</Text>
        </View>
        <View style={getStatusStyle(item.payment_status)}>
          <Text style={getStatusTextStyle(item.payment_status)}>
            {item.payment_status}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Monthly Rent</Text>
          <Text style={styles.cardValue}>{formatCurrency(item.monthly_rent)}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Due Date</Text>
          <Text style={styles.cardValue}>{formatDate(item.rent_due_date)}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Pending Amount</Text>
          <Text style={[styles.cardValue, styles.pendingAmount]}>
            {formatCurrency(item.pending_amount)}
          </Text>
        </View>
        {item.overdue_days > 0 && (
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Overdue Days</Text>
            <Text style={[styles.cardValue, styles.overdueDays]}>
              {item.overdue_days} days
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📋</Text>
      <Text style={styles.emptyTitle}>No Pending Rent</Text>
      <Text style={styles.emptySubtitle}>
        {statusFilter
          ? `No ${statusFilter} payments found`
          : 'All tenants have paid their rent for this period'}
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.footerText}>Loading more...</Text>
      </View>
    );
  };

  const filterButtons = [
    { label: 'All', value: '' },
    { label: 'Pending', value: 'pending' },
    { label: 'Overdue', value: 'overdue' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pending Rent Collection</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        stickyHeaderIndices={[2]} // Search bar sticks
      >
        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryRow}>
            {renderSummaryCard('Total Pending', formatCurrency(summary.total_pending), '#FF9500', '⏳')}
            {renderSummaryCard('Total Overdue', formatCurrency(summary.total_overdue), '#FF3B30', '🔴')}
          </View>
          <View style={styles.summaryRow}>
            {renderSummaryCard('Occupied Rooms', stats.occupied_rooms.toString(), '#007AFF', '🏠')}
            {renderSummaryCard('Pending Tenants', (summary.pending_count + summary.overdue_count).toString(), '#34C759', '👤')}
          </View>
        </View>

        {/* Filter Buttons */}
        <View style={styles.filterContainer}>
          {filterButtons.map((btn) => (
            <TouchableOpacity
              key={btn.value}
              style={[
                styles.filterButton,
                statusFilter === btn.value && styles.filterButtonActive,
              ]}
              onPress={() => setStatusFilter(btn.value)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  statusFilter === btn.value && styles.filterButtonTextActive,
                ]}
              >
                {btn.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by tenant name or room..."
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>

        {/* Results Count */}
        <View style={styles.resultsInfo}>
          <Text style={styles.resultsText}>
            {total} pending item{total !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Loading State */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading pending rents...</Text>
          </View>
        ) : data.length === 0 ? (
          renderEmptyState()
        ) : (
          /* Data List */
          <View style={styles.listContainer}>
            {data.map((item, index) => (
              <View key={`${item.tenant_id}-${item.period_month}-${item.period_year}-${index}`}>
                {renderItem({ item })}
              </View>
            ))}
            
            {/* Load More */}
            {page < totalPages && (
              <TouchableOpacity
                style={styles.loadMoreButton}
                onPress={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : (
                  <Text style={styles.loadMoreText}>Load More</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Bottom padding */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  summaryContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 4,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  summaryContent: {
    flex: 1,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  summaryTitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    fontWeight: '500',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  searchButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
    marginLeft: 8,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  searchButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  resultsInfo: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  resultsText: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  cardHeaderLeft: {
    flex: 1,
  },
  tenantName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  roomNumber: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  cardBody: {
    gap: 8,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
  cardValue: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  pendingAmount: {
    color: '#FF9500',
    fontWeight: '700',
  },
  overdueDays: {
    color: '#FF3B30',
    fontWeight: '700',
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  loadMoreButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  loadMoreText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  footerText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#999',
  },
});
