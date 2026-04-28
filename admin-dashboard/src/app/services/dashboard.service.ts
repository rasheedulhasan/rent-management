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
  reason: string;
  lastPaymentDate: string;
  daysOverdue: number;
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
    return this.api.get<DailyCollection[]>('dashboard/daily-collection', params);
  }

  // Get payment status distribution (pie chart)
  getPaymentStatusChart(): Observable<PaymentStatusChart> {
    return this.api.get<PaymentStatusChart>('dashboard/payment-status');
  }

  // Get collector performance data
  getCollectorPerformance(): Observable<CollectorPerformance[]> {
    return this.api.get<CollectorPerformance[]>('dashboard/collector-performance');
  }

  // Get recent rent transactions
  getRecentTransactions(limit: number = 10): Observable<RentTransaction[]> {
    return this.api.get<RentTransaction[]>('dashboard/recent-transactions', { limit });
  }

  // Get pending rent list
  getPendingRent(): Observable<PendingRent[]> {
    return this.api.get<PendingRent[]>('dashboard/pending-rent');
  }

  // Get filtered transactions
  getFilteredTransactions(filters: {
    buildingId?: string;
    startDate?: string;
    endDate?: string;
    collectorId?: string;
    status?: string;
  }): Observable<RentTransaction[]> {
    return this.api.get<RentTransaction[]>('dashboard/filtered-transactions', filters);
  }
}