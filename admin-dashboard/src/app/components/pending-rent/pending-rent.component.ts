import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { FormsModule } from '@angular/forms';
import { DashboardService, PendingRent } from '../../services/dashboard.service';

@Component({
  selector: 'app-pending-rent',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatChipsModule,
    MatTooltipModule,
    MatMenuModule,
    FormsModule
  ],
  templateUrl: './pending-rent.component.html',
  styleUrl: './pending-rent.component.scss'
})
export class PendingRentComponent implements OnInit {
  displayedColumns: string[] = ['tenantName', 'roomNumber', 'buildingName', 'pendingAmount', 'daysOverdue', 'lastPaymentDate', 'reason', 'actions'];
  dataSource = new MatTableDataSource<PendingRent>([]);
  
  // Filter options
  buildingFilter = 'all';
  overdueFilter = 'all';
  searchTerm = '';
  
  buildingOptions = [
    { value: 'all', label: 'All Buildings' },
    { value: 'Building A', label: 'Building A' },
    { value: 'Building B', label: 'Building B' },
    { value: 'Building C', label: 'Building C' }
  ];
  
  overdueOptions = [
    { value: 'all', label: 'All' },
    { value: 'overdue-7', label: 'Overdue 7+ days' },
    { value: 'overdue-30', label: 'Overdue 30+ days' },
    { value: 'critical', label: 'Critical (>60 days)' }
  ];
  
  totalPendingAmount = 0;
  totalOverdueTenants = 0;
  criticalCases = 0;

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.loadPendingRentData();
  }

  loadPendingRentData(): void {
    // For now, use mock data. Replace with API call later
    const mockData: PendingRent[] = [
      {
        tenantId: '1',
        tenantName: 'John Smith',
        roomNumber: 'A-101',
        buildingName: 'Building A',
        pendingAmount: 1200,
        totalDue: 1200,
        lastPaymentDate: '2024-01-15',
        daysOverdue: 45,
        reason: 'Financial difficulties'
      },
      {
        tenantId: '2',
        tenantName: 'Maria Garcia',
        roomNumber: 'B-205',
        buildingName: 'Building B',
        pendingAmount: 950,
        totalDue: 950,
        lastPaymentDate: '2024-02-28',
        daysOverdue: 22,
        reason: 'Traveling abroad'
      },
      {
        tenantId: '3',
        tenantName: 'Robert Johnson',
        roomNumber: 'C-312',
        buildingName: 'Building C',
        pendingAmount: 1500,
        totalDue: 1500,
        lastPaymentDate: '2023-12-15',
        daysOverdue: 75,
        reason: 'Job loss'
      },
      {
        tenantId: '4',
        tenantName: 'Sarah Williams',
        roomNumber: 'A-108',
        buildingName: 'Building A',
        pendingAmount: 1100,
        totalDue: 1100,
        lastPaymentDate: '2024-02-10',
        daysOverdue: 28,
        reason: 'Medical emergency'
      },
      {
        tenantId: '5',
        tenantName: 'David Brown',
        roomNumber: 'B-201',
        buildingName: 'Building B',
        pendingAmount: 850,
        totalDue: 850,
        lastPaymentDate: '2024-03-05',
        daysOverdue: 8,
        reason: 'Payment processing delay'
      }
    ];
    
    this.dataSource.data = mockData;
    this.calculateTotals();
  }

  calculateTotals(): void {
    this.totalPendingAmount = this.dataSource.data.reduce((sum, item) => sum + item.pendingAmount, 0);
    this.totalOverdueTenants = this.dataSource.data.filter(item => item.daysOverdue > 0).length;
    this.criticalCases = this.dataSource.data.filter(item => item.daysOverdue > 60).length;
  }

  applyFilter(): void {
    let filteredData = this.dataSource.data;
    
    // Apply building filter
    if (this.buildingFilter !== 'all') {
      filteredData = filteredData.filter(item => item.buildingName === this.buildingFilter);
    }
    
    // Apply overdue filter
    if (this.overdueFilter !== 'all') {
      switch (this.overdueFilter) {
        case 'overdue-7':
          filteredData = filteredData.filter(item => item.daysOverdue >= 7);
          break;
        case 'overdue-30':
          filteredData = filteredData.filter(item => item.daysOverdue >= 30);
          break;
        case 'critical':
          filteredData = filteredData.filter(item => item.daysOverdue >= 60);
          break;
      }
    }
    
    // Apply search filter
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filteredData = filteredData.filter(item =>
        item.tenantName.toLowerCase().includes(term) ||
        item.roomNumber.toLowerCase().includes(term) ||
        (item.buildingName && item.buildingName.toLowerCase().includes(term))
      );
    }
    
    this.dataSource.data = filteredData;
  }

  resetFilters(): void {
    this.buildingFilter = 'all';
    this.overdueFilter = 'all';
    this.searchTerm = '';
    this.loadPendingRentData();
  }

  getStatusLabel(daysOverdue: number): string {
    if (daysOverdue >= 60) return 'Critical';
    if (daysOverdue >= 30) return 'Overdue';
    if (daysOverdue >= 7) return 'Warning';
    return 'Pending';
  }

  sendReminder(tenant: PendingRent): void {
    console.log('Sending reminder to:', tenant.tenantName);
    // Implement reminder logic here
    alert(`Reminder sent to ${tenant.tenantName}`);
  }

  initiatePayment(tenant: PendingRent): void {
    console.log('Initiating payment for:', tenant.tenantName);
    // Implement payment initiation logic here
    alert(`Payment initiated for ${tenant.tenantName} - Amount: $${tenant.pendingAmount}`);
  }

  viewTenantDetails(tenant: PendingRent): void {
    console.log('Viewing details for:', tenant.tenantName);
    // Implement view details logic here
    alert(`Tenant Details:\nName: ${tenant.tenantName}\nRoom: ${tenant.roomNumber}\nPending: $${tenant.pendingAmount}\nOverdue: ${tenant.daysOverdue} days`);
  }

  exportPendingReport(): void {
    console.log('Exporting pending rent report');
    // Implement export logic here
    alert('Pending rent report exported successfully');
  }

  getDaysAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day';
    if (diffDays < 30) return `${diffDays} days`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months`;
    return `${Math.floor(diffDays / 365)} years`;
  }

  getAverageOverdue(): number {
    if (this.dataSource.data.length === 0) return 0;
    const total = this.dataSource.data.reduce((sum, item) => sum + item.daysOverdue, 0);
    return Math.round(total / this.dataSource.data.length);
  }

  getOldestOverdue(): number {
    if (this.dataSource.data.length === 0) return 0;
    return Math.max(...this.dataSource.data.map(item => item.daysOverdue));
  }

  sendBulkReminders(): void {
    const overdueTenants = this.dataSource.data.filter(item => item.daysOverdue > 0);
    if (overdueTenants.length === 0) {
      alert('No overdue tenants to send reminders to');
      return;
    }
    
    console.log('Sending bulk reminders to', overdueTenants.length, 'tenants');
    // Implement bulk reminder logic here
    alert(`Bulk reminders sent to ${overdueTenants.length} overdue tenants`);
  }

  generateReport(): void {
    console.log('Generating monthly report');
    // Implement report generation logic here
    alert('Monthly report generated successfully');
  }

  getStatusClass(daysOverdue: number): string {
    if (daysOverdue >= 60) return 'status-critical';
    if (daysOverdue >= 30) return 'status-overdue';
    if (daysOverdue >= 7) return 'status-warning';
    return 'status-pending';
  }
}
