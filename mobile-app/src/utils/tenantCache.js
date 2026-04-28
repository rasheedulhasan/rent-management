// Tenant caching utility
import { useNetwork } from '../services/network';
import { useOfflineStore } from '../store/offlineStore';
import { rentCollectionsApi } from '../services/api';

export const useTenantCache = () => {
  const { isOnline } = useNetwork();
  const { cacheTenants, getCachedTenants, getTenantById } = useOfflineStore();

  const loadTenants = async (forceRefresh = false) => {
    try {
      // If online and (force refresh or no cached data), fetch from server
      if (isOnline && (forceRefresh || (await getCachedTenants()).length === 0)) {
        const freshTenants = await rentCollectionsApi.getTenants();
        await cacheTenants(freshTenants);
        return freshTenants;
      } else {
        // Use cached tenants
        const cachedTenants = await getCachedTenants();
        return cachedTenants;
      }
    } catch (error) {
      console.error('Error loading tenants:', error);
      
      // Fallback to cached data if available
      try {
        const cachedTenants = await getCachedTenants();
        if (cachedTenants.length > 0) {
          return cachedTenants;
        }
      } catch (cacheError) {
        console.error('Error getting cached tenants:', cacheError);
      }
      
      throw error;
    }
  };

  const refreshTenants = async () => {
    if (!isOnline) {
      throw new Error('Cannot refresh tenants while offline');
    }
    
    return await loadTenants(true);
  };

  const searchTenants = async (searchTerm) => {
    const tenants = await loadTenants();
    
    if (!searchTerm) {
      return tenants;
    }
    
    const term = searchTerm.toLowerCase();
    return tenants.filter(tenant => 
      tenant.name?.toLowerCase().includes(term) ||
      tenant.building?.toLowerCase().includes(term) ||
      tenant.roomNumber?.toLowerCase().includes(term) ||
      tenant.phone?.includes(term)
    );
  };

  const getTenant = async (tenantId) => {
    // Try to get from cache first
    const cachedTenant = await getTenantById(tenantId);
    if (cachedTenant) {
      return cachedTenant;
    }
    
    // If not in cache and online, try to fetch from server
    if (isOnline) {
      try {
        const tenants = await rentCollectionsApi.getTenants();
        const tenant = tenants.find(t => t.id === tenantId || t.tenantId === tenantId);
        if (tenant) {
          // Cache this tenant
          await cacheTenants([tenant]);
          return tenant;
        }
      } catch (error) {
        console.error('Error fetching tenant from server:', error);
      }
    }
    
    return null;
  };

  const getTenantStats = async () => {
    const tenants = await loadTenants();
    
    const totalTenants = tenants.length;
    const totalMonthlyRent = tenants.reduce((sum, tenant) => sum + (tenant.monthlyRent || 0), 0);
    const buildings = [...new Set(tenants.map(t => t.building).filter(Boolean))];
    
    return {
      totalTenants,
      totalMonthlyRent,
      buildingCount: buildings.length,
      buildings,
    };
  };

  return {
    loadTenants,
    refreshTenants,
    searchTenants,
    getTenant,
    getTenantStats,
  };
};

// Cache expiration utility (optional)
const CACHE_EXPIRY_DAYS = 7;

export const isCacheExpired = (lastSyncDate) => {
  if (!lastSyncDate) return true;
  
  const lastSync = new Date(lastSyncDate);
  const now = new Date();
  const diffDays = (now - lastSync) / (1000 * 60 * 60 * 24);
  
  return diffDays > CACHE_EXPIRY_DAYS;
};

export default {
  useTenantCache,
  isCacheExpired,
};