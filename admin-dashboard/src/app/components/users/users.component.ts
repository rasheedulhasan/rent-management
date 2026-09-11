import { Component, OnInit, ViewChild } from '@angular/core';
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
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { User, UserService, CreateUserDto } from '../../services/user.service';

@Component({
  selector: 'app-users',
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
    private router: Router,
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
          console.warn('API returned error:', response.error);
          this.dataSource = [];
          this.filteredDataSource = [];
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading users:', error);
        this.loading = false;
        this.dataSource = [];
        this.filteredDataSource = [];
        this.snackBar.open('Failed to load users.', 'Close', { duration: 5000, panelClass: ['error-snackbar'] });
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

  openAddUserPage(): void {
    this.router.navigate(['/users/add']);
  }

  openEditUserPage(user: User): void {
    this.router.navigate(['/users/add'], {
      state: { mode: 'edit', user }
    });
  }

  toggleUserStatus(user: User): void {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    
    this.userService.updateUser(user.id, { status: newStatus }).subscribe({
      next: () => {
        const index = this.dataSource.findIndex(u => u.id === user.id);
        if (index !== -1) {
          this.dataSource[index].status = newStatus;
          this.filteredDataSource = [...this.dataSource];
        }
        this.snackBar.open(`User ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`, 'Close', { duration: 3000 });
      },
      error: (error) => {
        console.error('Error updating user status:', error);
        this.snackBar.open('Failed to update user status', 'Close', { duration: 5000, panelClass: ['error-snackbar'] });
      }
    });
  }

  deleteUser(user: User): void {
    if (confirm(`Are you sure you want to delete ${user.fullName}? This action cannot be undone.`)) {
      this.userService.deleteUser(user.id).subscribe({
        next: () => {
          this.dataSource = this.dataSource.filter(u => u.id !== user.id);
          this.filteredDataSource = [...this.dataSource];
          this.snackBar.open('User deleted successfully', 'Close', { duration: 3000 });
        },
        error: (error) => {
          console.error('Error deleting user:', error);
          this.snackBar.open('Failed to delete user', 'Close', { duration: 5000, panelClass: ['error-snackbar'] });
        }
      });
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
