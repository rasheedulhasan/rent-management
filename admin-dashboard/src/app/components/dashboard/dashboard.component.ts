import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DashboardService, DashboardStats } from '../../services/dashboard.service';
import { AddTenantDialogComponent } from '../tenants/add-tenant-dialog/add-tenant-dialog.component';
import { TenantService } from '../../services/tenant.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatButtonModule,
    MatSnackBarModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  stats: DashboardStats | null = null;
  loading = true;
  error: string | null = null;

  // Mock data for demonstration
  mockStats: DashboardStats = {
    totalRent: 125000,
    collectedRent: 98000,
    pendingRent: 27000,
    totalTenants: 45,
    occupiedRooms: 38,
    vacantRooms: 12,
    monthlyCollection: [
      { month: 'Jan', amount: 12000 },
      { month: 'Feb', amount: 13500 },
      { month: 'Mar', amount: 14200 },
      { month: 'Apr', amount: 12800 },
      { month: 'May', amount: 15000 },
      { month: 'Jun', amount: 16500 }
    ]
  };

  constructor(
    private dashboardService: DashboardService,
    private dialog: MatDialog,
    private tenantService: TenantService,
    private snackBar: MatSnackBar,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadDashboardStats();
  }

  loadDashboardStats(): void {
    this.loading = true;
    this.error = null;

    // Call the actual service
    this.dashboardService.getDashboardStats().subscribe({
      next: (data) => {
        this.stats = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load dashboard statistics';
        this.loading = false;
        // Fallback to mock data for demonstration
        this.stats = this.mockStats;
      }
    });
  }

  getCollectionRate(): number {
    if (!this.stats || this.stats.totalRent === 0) return 0;
    return (this.stats.collectedRent / this.stats.totalRent) * 100;
  }

  getOccupancyRate(): number {
    if (!this.stats || (this.stats.occupiedRooms + this.stats.vacantRooms) === 0) return 0;
    return (this.stats.occupiedRooms / (this.stats.occupiedRooms + this.stats.vacantRooms)) * 100;
  }

  calculateTotalMonthlyCollection(): number {
    if (!this.stats || !this.stats.monthlyCollection) return 0;
    return this.stats.monthlyCollection.reduce((sum: number, item: any) => sum + item.amount, 0);
  }

  calculateAverageMonthlyCollection(): number {
    if (!this.stats || !this.stats.monthlyCollection || this.stats.monthlyCollection.length === 0) return 0;
    return this.calculateTotalMonthlyCollection() / this.stats.monthlyCollection.length;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  openAddTenantDialog(): void {
    const dialogRef = this.dialog.open(AddTenantDialogComponent, {
      width: '600px',
      data: { mode: 'add' }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Create tenant via service
        this.tenantService.createTenant(result).subscribe({
          next: (response) => {
            // Show success message
            this.snackBar.open('Tenant added successfully!', 'Close', {
              duration: 3000,
              horizontalPosition: 'right',
              verticalPosition: 'top'
            });
            // Increment total tenants count locally
            if (this.stats) {
              this.stats.totalTenants += 1;
            } else if (this.mockStats) {
              this.mockStats.totalTenants += 1;
            }
            // Refresh dashboard stats to ensure data consistency
            this.loadDashboardStats();
          },
          error: (err) => {
            console.error('Error creating tenant:', err);
            this.snackBar.open('Failed to add tenant. Please try again.', 'Close', {
              duration: 5000,
              horizontalPosition: 'right',
              verticalPosition: 'top'
            });
          }
        });
      }
    });
  }

  navigateToTenants(): void {
    this.router.navigate(['/tenants']);
  }
}