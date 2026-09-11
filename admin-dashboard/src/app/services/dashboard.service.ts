import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface DashboardStats {
  totalRent: number;
  collectedRent: number;
  pendingRent: number;
  totalTenants: number;
  occupiedRooms: number;
  vacantRooms: number;
  monthlyCollection: Array<{ month: string; amount: number }>;
}

export interface DailyCollection {
  date: string;
  amount: number;
  transactions: number;
}

export interface PaymentStatusChart {
  paid: number;
  pending: number;
  partial: number;
}

export interface CollectorPerformance {
  collectorId: string;
  collectorName: string;
  totalCollected: number;
  transactionsCount: number;
  averageCollection: number;
}

export interface RentTransaction {
  id: string;
  tenantName: string;
  roomNumber: string;
  amount: number;
  monthlyRent: number;
  paymentStatus: 'paid' | 'pending' | 'partial';
  collectedBy: string;
  transactionDate: string;
  paymentMethod: string;
  buildingName?: string;
}

export interface PendingRent {
  tenantId: string;
  tenantName: string;
  roomNumber: string;
  pendingAmount: number;
  totalDue: number;
  monthlyRent: number;
  reason: string;
  lastPaymentDate: string;
  daysOverdue: number;
  paymentStatus: string;
  arrearsMonths: number;
  buildingName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  constructor(private api: ApiService) { }

  // Get dashboard overview statistics
  getDashboardStats(): Observable<DashboardStats> {
    return this.api.get<any>('dashboard/stats').pipe(
      map(response => {
        if (response.success && response.data) {
          const data = response.data;
          // Map the backend response to DashboardStats interface
          return {
            totalRent: data.financial?.total_revenue || 0,
            collectedRent: data.financial?.total_revenue - data.financial?.pending_amount || 0,
            pendingRent: data.financial?.pending_amount || 0,
            totalTenants: data.tenants?.active_tenants || 0,
            occupiedRooms: data.properties?.occupied_rooms || 0,
            vacantRooms: data.properties?.vacant_rooms || 0,
            monthlyCollection: [] // This would come from a different endpoint
          };
        }
        // Return empty stats if response is not successful
        return {
          totalRent: 0,
          collectedRent: 0,
          pendingRent: 0,
          totalTenants: 0,
          occupiedRooms: 0,
          vacantRooms: 0,
          monthlyCollection: []
        };
      })
    );
  }

  // Get daily collection data for chart
  getDailyCollection(startDate?: string, endDate?: string): Observable<DailyCollection[]> {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return this.api.get<any>('dashboard/daily-collection', params).pipe(
      map(response => (response?.success && Array.isArray(response.data) ? response.data : []))
    );
  }

  // Get payment status distribution (pie chart)
  getPaymentStatusChart(): Observable<PaymentStatusChart> {
    return this.api.get<any>('dashboard/payment-status').pipe(
      map(response => response?.success && response.data ? response.data : { paid: 0, pending: 0, partial: 0 })
    );
  }

  // Get collector performance data
  getCollectorPerformance(): Observable<CollectorPerformance[]> {
    return this.api.get<any>('dashboard/collector-performance').pipe(
      map(response => {
        const list = response?.data?.collector_performance;
        if (!Array.isArray(list)) return [];
        return list.map((item: any) => ({
          collectorId: item.collector_id,
          collectorName: item.collector_name,
          totalCollected: item.total_amount ?? 0,
          transactionsCount: item.transaction_count ?? 0,
          averageCollection: item.transaction_count > 0 ? (item.total_amount / item.transaction_count) : 0
        }));
      })
    );
  }

  // Get recent rent transactions
  getRecentTransactions(limit: number = 10): Observable<RentTransaction[]> {
    return this.api.get<any>('dashboard/recent-transactions', { limit }).pipe(
      map(response => (response?.success && Array.isArray(response.data)
        ? response.data.map((item: any) => this.mapTransaction(item))
        : []))
    );
  }

  // Get pending rent list from the dedicated pending rent endpoint
  getPendingRent(): Observable<PendingRent[]> {
    return this.api.get<any>('rent/pending').pipe(
      map(response => {
        // The new endpoint returns { success, data, summary, total, page, limit, total_pages }
        if (response.success && Array.isArray(response.data)) {
          return response.data.map((item: any) => this.mapPendingRentItem(item));
        }
        // Fallback: if response is already an array
        if (Array.isArray(response)) {
          return response.map((item: any) => this.mapPendingRentItem(item));
        }
        return [];
      })
    );
  }

  private mapPendingRentItem(item: any): PendingRent {
    return {
      tenantId: item.tenant_id || item.tenantId || '',
      tenantName: item.tenant_name || item.tenantName || '',
      roomNumber: item.room_number || item.roomNumber || '',
      pendingAmount: item.pending_amount ?? item.pendingAmount ?? 0,
      totalDue: item.total_due ?? item.totalDue ?? 0,
      monthlyRent: item.monthly_rent ?? item.monthlyRent ?? 0,
      reason: item.pending_reason || item.reason || '',
      lastPaymentDate: item.rent_due_date || item.lastPaymentDate || '',
      daysOverdue: item.overdue_days ?? item.daysOverdue ?? 0,
      paymentStatus: item.payment_status || item.paymentStatus || 'pending',
      arrearsMonths: item.arrears_months ?? item.arrearsMonths ?? 0,
      buildingName: item.building_name || item.buildingName || ''
    };
  }

  // Get filtered transactions
  getFilteredTransactions(filters: {
    buildingId?: string;
    startDate?: string;
    endDate?: string;
    collectorId?: string;
    status?: string;
  }): Observable<RentTransaction[]> {
    return this.api.get<any>('dashboard/filtered-transactions', filters).pipe(
      map(response => (response?.success && Array.isArray(response.data)
        ? response.data.map((item: any) => this.mapTransaction(item))
        : []))
    );
  }

  private mapTransaction(item: any): RentTransaction {
    return {
      id: item.id || item.$id || '',
      tenantName: item.tenant_name || '',
      roomNumber: item.room_number || '',
      amount: item.amount ?? 0,
      monthlyRent: item.monthly_rent ?? 0,
      paymentStatus: item.payment_status || 'pending',
      collectedBy: item.collected_by_name || item.collected_by || '',
      transactionDate: item.transaction_date || '',
      paymentMethod: item.payment_method || '',
      buildingName: item.building_name || ''
    };
  }
}