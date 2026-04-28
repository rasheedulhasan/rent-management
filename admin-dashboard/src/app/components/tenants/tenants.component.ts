import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
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
import { AddTenantDialogComponent } from './add-tenant-dialog/add-tenant-dialog.component';

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
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
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

  // Mock data for development (will be replaced with API)
  mockTenants: TenantWithRentStatus[] = [
    {
      id: '1',
      room_id: '101',
      full_name: 'John Smith',
      phone_number: '+971501234567',
      email: 'john.smith@example.com',
      id_number: '784-1990-1234567-1',
      emergency_contact: '+971501234568',
      check_in_date: '2024-01-15',
      check_out_date: null,
      monthly_rent: 5000,
      security_deposit: 10000,
      status: 'active',
      notes: 'Pays on time',
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T10:30:00Z',
      rentStatus: 'paid',
      lastPaymentDate: '2024-03-01',
      nextPaymentDate: '2024-04-01'
    },
    {
      id: '2',
      room_id: '102',
      full_name: 'Maria Garcia',
      phone_number: '+971502345678',
      email: 'maria.garcia@example.com',
      id_number: '784-1991-2345678-2',
      emergency_contact: '+971502345679',
      check_in_date: '2024-02-10',
      check_out_date: null,
      monthly_rent: 4500,
      security_deposit: 9000,
      status: 'active',
      notes: 'New tenant',
      createdAt: '2024-02-10T14:20:00Z',
      updatedAt: '2024-02-10T14:20:00Z',
      rentStatus: 'pending',
      lastPaymentDate: '2024-02-01',
      nextPaymentDate: '2024-03-01'
    },
    {
      id: '3',
      room_id: '201',
      full_name: 'Ahmed Khan',
      phone_number: '+971503456789',
      email: 'ahmed.khan@example.com',
      id_number: '784-1992-3456789-3',
      emergency_contact: '+971503456780',
      check_in_date: '2023-11-05',
      check_out_date: null,
      monthly_rent: 5500,
      security_deposit: 11000,
      status: 'active',
      notes: 'Long-term tenant',
      createdAt: '2023-11-05T09:15:00Z',
      updatedAt: '2023-11-05T09:15:00Z',
      rentStatus: 'paid',
      lastPaymentDate: '2024-03-05',
      nextPaymentDate: '2024-04-05'
    },
    {
      id: '4',
      room_id: '202',
      full_name: 'Sarah Johnson',
      phone_number: '+971504567890',
      email: 'sarah.j@example.com',
      id_number: '784-1993-4567890-4',
      emergency_contact: '+971504567891',
      check_in_date: '2024-03-01',
      check_out_date: null,
      monthly_rent: 4800,
      security_deposit: 9600,
      status: 'active',
      notes: 'Student',
      createdAt: '2024-03-01T11:45:00Z',
      updatedAt: '2024-03-01T11:45:00Z',
      rentStatus: 'overdue',
      lastPaymentDate: '2024-02-01',
      nextPaymentDate: '2024-03-01'
    },
    {
      id: '5',
      room_id: '103',
      full_name: 'David Lee',
      phone_number: '+971505678901',
      email: 'david.lee@example.com',
      id_number: '784-1994-5678901-5',
      emergency_contact: '+971505678902',
      check_in_date: '2023-12-20',
      check_out_date: null,
      monthly_rent: 5200,
      security_deposit: 10400,
      status: 'active',
      notes: 'Corporate tenant',
      createdAt: '2023-12-20T16:30:00Z',
      updatedAt: '2023-12-20T16:30:00Z',
      rentStatus: 'paid',
      lastPaymentDate: '2024-03-15',
      nextPaymentDate: '2024-04-15'
    },
    {
      id: '6',
      room_id: '203',
      full_name: 'Fatima Ali',
      phone_number: '+971506789012',
      email: 'fatima.ali@example.com',
      id_number: '784-1995-6789012-6',
      emergency_contact: '+971506789013',
      check_in_date: '2024-01-25',
      check_out_date: null,
      monthly_rent: 4700,
      security_deposit: 9400,
      status: 'inactive',
      notes: 'Moved out last month',
      createdAt: '2024-01-25T13:10:00Z',
      updatedAt: '2024-03-01T10:20:00Z',
      rentStatus: 'pending',
      lastPaymentDate: '2024-02-25',
      nextPaymentDate: '2024-03-25'
    },
    {
      id: '7',
      room_id: '104',
      full_name: 'Robert Chen',
      phone_number: '+971507890123',
      email: 'robert.chen@example.com',
      id_number: '784-1996-7890123-7',
      emergency_contact: '+971507890124',
      check_in_date: '2024-02-15',
      check_out_date: null,
      monthly_rent: 5100,
      security_deposit: 10200,
      status: 'active',
      notes: 'Pays via bank transfer',
      createdAt: '2024-02-15T15:45:00Z',
      updatedAt: '2024-02-15T15:45:00Z',
      rentStatus: 'paid',
      lastPaymentDate: '2024-03-10',
      nextPaymentDate: '2024-04-10'
    },
    {
      id: '8',
      room_id: '204',
      full_name: 'Emma Wilson',
      phone_number: '+971508901234',
      email: 'emma.wilson@example.com',
      id_number: '784-1997-8901234-8',
      emergency_contact: '+971508901235',
      check_in_date: '2023-10-10',
      check_out_date: null,
      monthly_rent: 5300,
      security_deposit: 10600,
      status: 'active',
      notes: 'Family tenant',
      createdAt: '2023-10-10T12:00:00Z',
      updatedAt: '2023-10-10T12:00:00Z',
      rentStatus: 'pending',
      lastPaymentDate: '2024-02-10',
      nextPaymentDate: '2024-03-10'
    }
  ];

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
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadTenants();
  }

  loadTenants(): void {
    this.loading = true;
    
    this.tenantService.getAllTenants().subscribe({
      next: (response) => {
        // Normalize Appwrite documents: map $id to id, $createdAt to createdAt, etc.
        this.dataSource = response.data.map(tenant => this.normalizeTenant(tenant));
        this.filteredDataSource = [...this.dataSource];
        this.totalItems = this.dataSource.length;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading tenants:', error);
        this.loading = false;
        // Show empty state instead of mock data
        this.dataSource = [];
        this.filteredDataSource = [];
        this.totalItems = 0;
        this.snackBar.open('Failed to load tenants. Please try again.', 'Close', { duration: 5000 });
      }
    });
  }

  // Normalize Appwrite document by removing $ prefix from system fields
  private normalizeTenant(appwriteTenant: any): TenantWithRentStatus {
    // Extract rent status from transactions (for now use random)
    // In a real app, you would calculate based on payment history
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

    // Apply status filter
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(tenant => tenant.status === this.statusFilter);
    }

    // Apply rent status filter
    if (this.rentStatusFilter !== 'all') {
      filtered = filtered.filter(tenant => tenant.rentStatus === this.rentStatusFilter);
    }

    // Apply search filter
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
    this.pageIndex = 0; // Reset to first page when filters change
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
      case 'paid': return 'success'; // Green
      case 'pending': return 'primary'; // Blue
      case 'overdue': return 'warn'; // Orange/Red
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

  openAddTenantDialog(): void {
    const dialogRef = this.dialog.open(AddTenantDialogComponent, {
      width: '600px',
      data: { mode: 'add' }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loading = true;
        this.tenantService.createTenant(result).subscribe({
          next: (response) => {
            if (response.success) {
              this.snackBar.open('Tenant added successfully', 'Close', { duration: 3000 });
              this.loadTenants(); // Refresh the list
            } else {
              this.snackBar.open(`Failed to add tenant: ${response.message || 'Unknown error'}`, 'Close', { duration: 5000 });
              this.loading = false;
            }
          },
          error: (error) => {
            console.error('Error adding tenant:', error);
            this.snackBar.open('Failed to add tenant. Please try again.', 'Close', { duration: 5000 });
            this.loading = false;
          }
        });
      }
    });
  }

  openEditTenantDialog(tenant: TenantWithRentStatus): void {
    const dialogRef = this.dialog.open(AddTenantDialogComponent, {
      width: '600px',
      data: { mode: 'edit', tenant }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loading = true;
        this.tenantService.updateTenant(tenant.id, result).subscribe({
          next: (response) => {
            if (response.success) {
              this.snackBar.open('Tenant updated successfully', 'Close', { duration: 3000 });
              this.loadTenants(); // Refresh the list
            } else {
              this.snackBar.open(`Failed to update tenant: ${response.message || 'Unknown error'}`, 'Close', { duration: 5000 });
              this.loading = false;
            }
          },
          error: (error) => {
            console.error('Error updating tenant:', error);
            this.snackBar.open('Failed to update tenant. Please try again.', 'Close', { duration: 5000 });
            this.loading = false;
          }
        });
      }
    });
  }

  toggleTenantStatus(tenant: TenantWithRentStatus): void {
    const newStatus = tenant.status === 'active' ? 'inactive' : 'active';
    
    this.loading = true;
    this.tenantService.updateTenant(tenant.id, { status: newStatus }).subscribe({
      next: (response) => {
        if (response.success) {
          this.snackBar.open(`Tenant ${newStatus === 'active' ? 'activated' : 'deactivated'}`, 'Close', { duration: 3000 });
          this.loadTenants(); // Refresh the list
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
            this.loadTenants(); // Refresh the list
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