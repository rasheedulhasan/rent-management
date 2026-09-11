import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatMenuModule } from '@angular/material/menu';
import { Tenant, TenantService } from '../../services/tenant.service';

export interface TenantWithRentStatus extends Tenant {
  rentStatus: 'paid' | 'pending' | 'overdue';
  lastPaymentDate?: string;
  nextPaymentDate: string;
}

@Component({
  selector: 'app-tenants',
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    MatMenuModule
  ],
  templateUrl: './tenants.component.html',
  styleUrl: './tenants.component.scss'
})
export class TenantsComponent implements OnInit {
  displayedColumns: string[] = ['fullName', 'phone', 'email', 'roomId', 'monthlyRent', 'rentStatus', 'checkInDate', 'status', 'actions'];
  dataSource: TenantWithRentStatus[] = [];
  filteredDataSource: TenantWithRentStatus[] = [];
  loading = false;
  searchQuery = '';
  statusFilter: string = 'all';
  rentStatusFilter: string = 'all';
  
  // Pagination
  pageSize = 10;
  pageIndex = 0;
  pageSizeOptions = [5, 10, 25, 50];
  totalItems = 0;

  statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'moved_out', label: 'Moved Out' }
  ];

  rentStatusOptions = [
    { value: 'all', label: 'All Rent Status' },
    { value: 'paid', label: 'Paid' },
    { value: 'pending', label: 'Pending' },
    { value: 'overdue', label: 'Overdue' }
  ];

  constructor(
    private tenantService: TenantService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadTenants();
  }

  loadTenants(): void {
    this.loading = true;
    
    this.tenantService.getAllTenants().subscribe({
      next: (response) => {
        this.dataSource = response.data.map(tenant => this.normalizeTenant(tenant));
        this.filteredDataSource = [...this.dataSource];
        this.totalItems = this.dataSource.length;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading tenants:', error);
        this.loading = false;
        this.dataSource = [];
        this.filteredDataSource = [];
        this.totalItems = 0;
        this.snackBar.open('Failed to load tenants. Please try again.', 'Close', { duration: 5000 });
      }
    });
  }

  private normalizeTenant(appwriteTenant: any): TenantWithRentStatus {
    const rentStatus = this.getRandomRentStatus();
    const lastPaymentDate = this.getRandomDate();
    const nextPaymentDate = this.getNextPaymentDate();

    return {
      id: appwriteTenant.$id || appwriteTenant.id,
      room_id: appwriteTenant.room_id,
      full_name: appwriteTenant.full_name,
      phone_number: appwriteTenant.phone_number,
      email: appwriteTenant.email || '',
      id_number: appwriteTenant.id_number || '',
      emergency_contact: appwriteTenant.emergency_contact || '',
      check_in_date: appwriteTenant.check_in_date,
      check_out_date: appwriteTenant.check_out_date || null,
      monthly_rent: appwriteTenant.monthly_rent,
      security_deposit: appwriteTenant.security_deposit || 0,
      status: appwriteTenant.status,
      notes: appwriteTenant.notes || '',
      createdAt: appwriteTenant.$createdAt || appwriteTenant.createdAt,
      updatedAt: appwriteTenant.$updatedAt || appwriteTenant.updatedAt,
      rentStatus,
      lastPaymentDate,
      nextPaymentDate
    };
  }

  applyFilters(): void {
    let filtered = [...this.dataSource];

    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(tenant => tenant.status === this.statusFilter);
    }

    if (this.rentStatusFilter !== 'all') {
      filtered = filtered.filter(tenant => tenant.rentStatus === this.rentStatusFilter);
    }

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(tenant =>
        tenant.full_name.toLowerCase().includes(query) ||
        tenant.phone_number.toLowerCase().includes(query) ||
        tenant.email?.toLowerCase().includes(query) ||
        tenant.room_id.toLowerCase().includes(query)
      );
    }

    this.filteredDataSource = filtered;
    this.totalItems = filtered.length;
    this.pageIndex = 0;
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.rentStatusFilter = 'all';
    this.filteredDataSource = [...this.dataSource];
    this.totalItems = this.dataSource.length;
    this.pageIndex = 0;
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'active': return 'Active';
      case 'inactive': return 'Inactive';
      case 'moved_out': return 'Moved Out';
      default: return status;
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'warn';
      case 'moved_out': return '';
      default: return '';
    }
  }

  getRentStatusLabel(status: string): string {
    switch (status) {
      case 'paid': return 'Paid';
      case 'pending': return 'Pending';
      case 'overdue': return 'Overdue';
      default: return status;
    }
  }

  getRentStatusColor(status: string): string {
    switch (status) {
      case 'paid': return 'success';
      case 'pending': return 'primary';
      case 'overdue': return 'warn';
      default: return '';
    }
  }

  getRentStatusIcon(status: string): string {
    switch (status) {
      case 'paid': return 'check_circle';
      case 'pending': return 'pending';
      case 'overdue': return 'warning';
      default: return 'help';
    }
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0
    }).format(amount);
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  openAddTenantPage(): void {
    this.router.navigate(['/tenants/add']);
  }

  openEditTenantPage(tenant: TenantWithRentStatus): void {
    this.router.navigate(['/tenants/add'], {
      state: { mode: 'edit', tenant }
    });
  }

  toggleTenantStatus(tenant: TenantWithRentStatus): void {
    const newStatus = tenant.status === 'active' ? 'inactive' : 'active';
    
    this.loading = true;
    this.tenantService.updateTenant(tenant.id, { status: newStatus }).subscribe({
      next: (response) => {
        if (response.success) {
          this.snackBar.open(`Tenant ${newStatus === 'active' ? 'activated' : 'deactivated'}`, 'Close', { duration: 3000 });
          this.loadTenants();
        } else {
          this.snackBar.open(`Failed to update tenant status: ${response.message || 'Unknown error'}`, 'Close', { duration: 5000 });
          this.loading = false;
        }
      },
      error: (error) => {
        console.error('Error updating tenant status:', error);
        this.snackBar.open('Failed to update tenant status. Please try again.', 'Close', { duration: 5000 });
        this.loading = false;
      }
    });
  }

  deleteTenant(tenant: TenantWithRentStatus): void {
    if (confirm(`Are you sure you want to delete ${tenant.full_name}? This action cannot be undone.`)) {
      this.loading = true;
      this.tenantService.deleteTenant(tenant.id).subscribe({
        next: (response) => {
          if (response.success) {
            this.snackBar.open('Tenant deleted successfully', 'Close', { duration: 3000 });
            this.loadTenants();
          } else {
            this.snackBar.open(`Failed to delete tenant: ${response.message || 'Unknown error'}`, 'Close', { duration: 5000 });
            this.loading = false;
          }
        },
        error: (error) => {
          console.error('Error deleting tenant:', error);
          this.snackBar.open('Failed to delete tenant. Please try again.', 'Close', { duration: 5000 });
          this.loading = false;
        }
      });
    }
  }

  handlePageEvent(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
  }

  getPaginatedData(): TenantWithRentStatus[] {
    const startIndex = this.pageIndex * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return this.filteredDataSource.slice(startIndex, endIndex);
  }

  getNextPaymentDate(): string {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
    return nextMonth.toISOString().split('T')[0];
  }

  getRandomRentStatus(): 'paid' | 'pending' | 'overdue' {
    const statuses: ('paid' | 'pending' | 'overdue')[] = ['paid', 'pending', 'overdue'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  }

  getRandomDate(): string {
    const today = new Date();
    const pastDate = new Date(today);
    pastDate.setDate(today.getDate() - Math.floor(Math.random() * 30));
    return pastDate.toISOString().split('T')[0];
  }

  getStats() {
    const total = this.dataSource.length;
    const active = this.dataSource.filter(t => t.status === 'active').length;
    const paid = this.dataSource.filter(t => t.rentStatus === 'paid').length;
    const pending = this.dataSource.filter(t => t.rentStatus === 'pending').length;
    const overdue = this.dataSource.filter(t => t.rentStatus === 'overdue').length;
    
    return { total, active, paid, pending, overdue };
  }
}