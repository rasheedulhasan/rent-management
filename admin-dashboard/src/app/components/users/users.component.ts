import { Component, OnInit, ViewChild } from '@angular/core';
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
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { User, UserService, CreateUserDto } from '../../services/user.service';
import { AddUserDialogComponent } from './add-user-dialog/add-user-dialog.component';

@Component({
  selector: 'app-users',
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
    MatPaginatorModule,
    MatChipsModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatSortModule,
    MatMenuModule
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = ['id', 'fullName', 'email', 'phone', 'role', 'status', 'createdAt', 'actions'];
  dataSource: User[] = [];
  filteredDataSource: User[] = [];
  loading = false;
  searchQuery = '';
  roleFilter: string = 'all';
  statusFilter: string = 'all';

  // Mock data for development (will be replaced with API)
  mockUsers: User[] = [
    { id: '1', username: 'ali_khan', fullName: 'Ali Khan', email: 'ali@test.com', phone: '0500000001', role: 'collector', status: 'active', permissions: ['collect', 'view'], createdAt: '2024-01-15T10:30:00Z' },
    { id: '2', username: 'ahmed_raza', fullName: 'Ahmed Raza', email: 'ahmed@test.com', phone: '0500000002', role: 'collector', status: 'active', permissions: ['collect', 'view'], createdAt: '2024-02-10T14:20:00Z' },
    { id: '3', username: 'usman_tariq', fullName: 'Usman Tariq', email: 'usman@test.com', phone: '0500000003', role: 'collector', status: 'active', permissions: ['collect', 'view'], createdAt: '2024-03-01T11:45:00Z' },
    { id: '4', username: 'john_admin', fullName: 'John Admin', email: 'john@example.com', phone: '+1234567890', role: 'admin', status: 'active', permissions: ['all'], createdAt: '2024-01-01T09:00:00Z' },
    { id: '5', username: 'sarah_manager', fullName: 'Sarah Manager', email: 'sarah@example.com', phone: '+1234567891', role: 'manager', status: 'active', permissions: ['manage', 'view'], createdAt: '2024-01-20T16:30:00Z' },
    { id: '6', username: 'michael_collector', fullName: 'Michael Collector', email: 'michael@example.com', phone: '+1234567892', role: 'collector', status: 'inactive', permissions: ['collect'], createdAt: '2023-12-05T13:10:00Z' },
  ];

  roleOptions = [
    { value: 'all', label: 'All Roles' },
    { value: 'admin', label: 'Admin' },
    { value: 'collector', label: 'Collector' },
    { value: 'manager', label: 'Manager' }
  ];

  statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ];

  constructor(
    private userService: UserService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  private transformUserFromApi(user: any): User {
    return {
      id: user.$id || user.id,
      username: user.username,
      fullName: user.full_name || user.fullName || '',
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      status: user.status,
      permissions: typeof user.permissions === 'string' ? user.permissions.split(',').map((p: string) => p.trim()) : user.permissions || [],
      createdAt: user.$createdAt || user.createdAt,
      updatedAt: user.$updatedAt || user.updatedAt
    };
  }

  loadUsers(): void {
    this.loading = true;
    
    this.userService.getAllUsers().subscribe({
      next: (response) => {
        if (response.success) {
          const users = response.data.map(user => this.transformUserFromApi(user));
          this.dataSource = users;
          this.filteredDataSource = [...users];
        } else {
          // If API returns error, fallback to mock data
          console.warn('API returned error, using mock data:', response.error);
          this.dataSource = this.mockUsers;
          this.filteredDataSource = [...this.mockUsers];
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading users:', error);
        this.loading = false;
        // Fallback to mock data
        this.dataSource = this.mockUsers;
        this.filteredDataSource = [...this.mockUsers];
        this.snackBar.open('Failed to load users. Using mock data.', 'Close', { duration: 5000, panelClass: ['warning-snackbar'] });
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.dataSource];

    // Apply role filter
    if (this.roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === this.roleFilter);
    }

    // Apply status filter
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(user => user.status === this.statusFilter);
    }

    // Apply search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(user =>
        user.fullName.toLowerCase().includes(query) ||
        user.username.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query)
      );
    }

    this.filteredDataSource = filtered;
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.roleFilter = 'all';
    this.statusFilter = 'all';
    this.filteredDataSource = [...this.dataSource];
  }

  getRoleLabel(role: string): string {
    switch (role) {
      case 'admin': return 'Admin';
      case 'collector': return 'Collector';
      case 'manager': return 'Manager';
      default: return role;
    }
  }

  getRoleColor(role: string): string {
    switch (role) {
      case 'admin': return 'primary';
      case 'collector': return 'accent';
      case 'manager': return 'warn';
      default: return '';
    }
  }

  getStatusLabel(status: string): string {
    return status === 'active' ? 'Active' : 'Inactive';
  }

  getStatusColor(status: string): string {
    return status === 'active' ? 'success' : 'warn';
  }

  openAddUserDialog(): void {
    const dialogRef = this.dialog.open(AddUserDialogComponent, {
      width: '500px',
      data: { mode: 'add' }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // In a real app, you would call userService.createUser(result)
        // For now, add to mock data
        const newUser: User = {
          id: (this.dataSource.length + 1).toString(),
          username: result.username,
          fullName: result.fullName,
          email: result.email,
          phone: result.phone,
          role: result.role,
          status: 'active',
          permissions: result.role === 'admin' ? ['all'] : result.role === 'collector' ? ['collect', 'view'] : ['manage', 'view'],
          createdAt: new Date().toISOString()
        };
        
        this.dataSource = [newUser, ...this.dataSource];
        this.filteredDataSource = [...this.dataSource];
        this.snackBar.open('User added successfully', 'Close', { duration: 3000 });
      }
    });
  }

  openEditUserDialog(user: User): void {
    const dialogRef = this.dialog.open(AddUserDialogComponent, {
      width: '500px',
      data: { mode: 'edit', user }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // In a real app, you would call userService.updateUser(user.id, result)
        // For now, update mock data
        const index = this.dataSource.findIndex(u => u.id === user.id);
        if (index !== -1) {
          this.dataSource[index] = { ...this.dataSource[index], ...result };
          this.filteredDataSource = [...this.dataSource];
          this.snackBar.open('User updated successfully', 'Close', { duration: 3000 });
        }
      }
    });
  }

  toggleUserStatus(user: User): void {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    
    // In a real app, you would call userService.updateUser(user.id, { status: newStatus })
    const index = this.dataSource.findIndex(u => u.id === user.id);
    if (index !== -1) {
      this.dataSource[index].status = newStatus;
      this.filteredDataSource = [...this.dataSource];
      this.snackBar.open(`User ${newStatus === 'active' ? 'activated' : 'deactivated'}`, 'Close', { duration: 3000 });
    }
  }

  deleteUser(user: User): void {
    if (confirm(`Are you sure you want to delete ${user.fullName}? This action cannot be undone.`)) {
      // In a real app, you would call userService.deleteUser(user.id)
      this.dataSource = this.dataSource.filter(u => u.id !== user.id);
      this.filteredDataSource = [...this.dataSource];
      this.snackBar.open('User deleted successfully', 'Close', { duration: 3000 });
    }
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  getStats() {
    const total = this.dataSource.length;
    const active = this.dataSource.filter(u => u.status === 'active').length;
    const collectors = this.dataSource.filter(u => u.role === 'collector').length;
    const admins = this.dataSource.filter(u => u.role === 'admin').length;
    
    return { total, active, collectors, admins };
  }
}
