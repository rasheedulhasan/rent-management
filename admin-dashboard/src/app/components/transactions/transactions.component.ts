import { Component, OnInit, ViewChild } from '@angular/core';
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
import { MatMenuModule } from '@angular/material/menu';
import { FormsModule } from '@angular/forms';
import { DashboardService, RentTransaction } from '../../services/dashboard.service';

@Component({
  selector: 'app-transactions',
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
    MatMenuModule,
    FormsModule
  ],
  templateUrl: './transactions.component.html',
  styleUrl: './transactions.component.scss'
})
export class TransactionsComponent implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = ['tenantName', 'roomNumber', 'amount', 'paymentStatus', 'collectedBy', 'transactionDate', 'paymentMethod', 'actions'];
  dataSource = new MatTableDataSource<RentTransaction>([]);

  // Filter options
  statusFilter = 'all';
  paymentMethodFilter = 'all';
  dateRange = { start: null as Date | null, end: null as Date | null };
  
  statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'paid', label: 'Paid' },
    { value: 'pending', label: 'Pending' },
    { value: 'partial', label: 'Partial' }
  ];

  paymentMethodOptions = [
    { value: 'all', label: 'All Methods' },
    { value: 'cash', label: 'Cash' },
    { value: 'online', label: 'Online' },
    { value: 'bank_transfer', label: 'Bank Transfer' }
  ];

  loading = true;
  totalTransactions = 0;
  totalAmount = 0;

  // Mock data
  mockTransactions: RentTransaction[] = [
    { id: '1', tenantName: 'John Smith', roomNumber: 'A101', amount: 1200, monthlyRent: 1200, paymentStatus: 'paid', collectedBy: 'Alice Johnson', transactionDate: '2024-03-15', paymentMethod: 'online', buildingName: 'Main Building' },
    { id: '2', tenantName: 'Maria Garcia', roomNumber: 'B205', amount: 950, monthlyRent: 950, paymentStatus: 'paid', collectedBy: 'Bob Wilson', transactionDate: '2024-03-14', paymentMethod: 'cash', buildingName: 'Annex Building' },
    { id: '3', tenantName: 'David Chen', roomNumber: 'C312', amount: 0, monthlyRent: 1100, paymentStatus: 'pending', collectedBy: 'N/A', transactionDate: '2024-03-13', paymentMethod: 'N/A', buildingName: 'Main Building' },
    { id: '4', tenantName: 'Sarah Williams', roomNumber: 'A102', amount: 600, monthlyRent: 1200, paymentStatus: 'partial', collectedBy: 'Alice Johnson', transactionDate: '2024-03-12', paymentMethod: 'bank_transfer', buildingName: 'Main Building' },
    { id: '5', tenantName: 'Robert Brown', roomNumber: 'D401', amount: 850, monthlyRent: 850, paymentStatus: 'paid', collectedBy: 'Carol Davis', transactionDate: '2024-03-11', paymentMethod: 'online', buildingName: 'West Wing' },
    { id: '6', tenantName: 'Lisa Taylor', roomNumber: 'B210', amount: 0, monthlyRent: 900, paymentStatus: 'pending', collectedBy: 'N/A', transactionDate: '2024-03-10', paymentMethod: 'N/A', buildingName: 'Annex Building' },
    { id: '7', tenantName: 'Michael Lee', roomNumber: 'C305', amount: 1100, monthlyRent: 1100, paymentStatus: 'paid', collectedBy: 'Bob Wilson', transactionDate: '2024-03-09', paymentMethod: 'cash', buildingName: 'Main Building' },
    { id: '8', tenantName: 'Emma Wilson', roomNumber: 'A201', amount: 500, monthlyRent: 1000, paymentStatus: 'partial', collectedBy: 'Alice Johnson', transactionDate: '2024-03-08', paymentMethod: 'online', buildingName: 'Main Building' },
    { id: '9', tenantName: 'James Miller', roomNumber: 'D105', amount: 750, monthlyRent: 750, paymentStatus: 'paid', collectedBy: 'Carol Davis', transactionDate: '2024-03-07', paymentMethod: 'bank_transfer', buildingName: 'West Wing' },
    { id: '10', tenantName: 'Olivia Davis', roomNumber: 'B115', amount: 0, monthlyRent: 950, paymentStatus: 'pending', collectedBy: 'N/A', transactionDate: '2024-03-06', paymentMethod: 'N/A', buildingName: 'Annex Building' }
  ];

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.loadTransactions();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  loadTransactions(): void {
    this.loading = true;

    // For now, use mock data
    // In production: this.dashboardService.getRecentTransactions(50).subscribe(...)
    
    setTimeout(() => {
      this.dataSource.data = this.mockTransactions;
      this.calculateTotals();
      this.loading = false;
    }, 1000);
  }

  calculateTotals(): void {
    this.totalTransactions = this.dataSource.data.length;
    this.totalAmount = this.dataSource.data
      .filter(t => t.paymentStatus === 'paid' || t.paymentStatus === 'partial')
      .reduce((sum, transaction) => sum + transaction.amount, 0);
  }

  applyFilter(event?: Event): void {
    let filteredData = [...this.mockTransactions];

    // Apply search filter if event is provided (from search input)
    if (event) {
      const filterValue = (event.target as HTMLInputElement).value.toLowerCase();
      if (filterValue) {
        filteredData = filteredData.filter(t =>
          t.tenantName.toLowerCase().includes(filterValue) ||
          t.roomNumber.toLowerCase().includes(filterValue) ||
          t.collectedBy.toLowerCase().includes(filterValue)
        );
      }
    }

    // Apply status filter
    if (this.statusFilter !== 'all') {
      filteredData = filteredData.filter(t => t.paymentStatus === this.statusFilter);
    }

    // Apply payment method filter
    if (this.paymentMethodFilter !== 'all') {
      filteredData = filteredData.filter(t => t.paymentMethod === this.paymentMethodFilter);
    }

    // Apply date range filter
    if (this.dateRange.start && this.dateRange.end) {
      filteredData = filteredData.filter(t => {
        const transactionDate = new Date(t.transactionDate);
        return transactionDate >= this.dateRange.start! && transactionDate <= this.dateRange.end!;
      });
    }

    this.dataSource.data = filteredData;
    this.calculateTotals();
  }

  clearFilters(): void {
    this.statusFilter = 'all';
    this.paymentMethodFilter = 'all';
    this.dateRange = { start: null, end: null };
    this.applyFilter();
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'paid': return 'status-paid';
      case 'pending': return 'status-pending';
      case 'partial': return 'status-partial';
      default: return '';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'paid': return 'Paid';
      case 'pending': return 'Pending';
      case 'partial': return 'Partial';
      default: return status;
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  viewTransaction(id: string): void {
    console.log('View transaction:', id);
    // Navigate to transaction detail or show dialog
  }

  editTransaction(id: string): void {
    console.log('Edit transaction:', id);
    // Open edit dialog
  }

  deleteTransaction(id: string): void {
    if (confirm('Are you sure you want to delete this transaction?')) {
      console.log('Delete transaction:', id);
      // Call delete API
    }
  }

  // Additional methods for template
  resetFilters(): void {
    this.clearFilters();
  }

  applyFilters(): void {
    this.applyFilter();
  }

  getFilteredTotal(): number {
    return this.dataSource.filteredData
      .filter(t => t.paymentStatus === 'paid' || t.paymentStatus === 'partial')
      .reduce((sum, transaction) => sum + transaction.amount, 0);
  }

  getStatusLabel(status: string): string {
    return this.getStatusText(status);
  }

  getPaymentMethodIcon(method: string): string {
    switch (method) {
      case 'cash': return 'payments';
      case 'online': return 'credit_card';
      case 'bank_transfer': return 'account_balance';
      default: return 'payment';
    }
  }

  getPaymentMethodLabel(method: string): string {
    switch (method) {
      case 'cash': return 'Cash';
      case 'online': return 'Online';
      case 'bank_transfer': return 'Bank Transfer';
      default: return method;
    }
  }

  viewTransactionDetails(transaction: RentTransaction): void {
    this.viewTransaction(transaction.id);
  }

  downloadReceipt(transaction: RentTransaction): void {
    console.log('Download receipt for transaction:', transaction.id);
    // Implement receipt download
  }

  sendReminder(transaction: RentTransaction): void {
    console.log('Send reminder for transaction:', transaction.id);
    // Implement reminder sending
  }

  exportToCSV(): void {
    console.log('Export to CSV');
    // Implement CSV export
  }

  exportToPDF(): void {
    console.log('Export to PDF');
    // Implement PDF export
  }

  getTotalCollected(): number {
    return this.dataSource.data
      .filter(t => t.paymentStatus === 'paid')
      .reduce((sum, transaction) => sum + transaction.amount, 0);
  }

  getTotalPending(): number {
    return this.dataSource.data
      .filter(t => t.paymentStatus === 'pending')
      .reduce((sum, transaction) => sum + transaction.monthlyRent, 0);
  }
}