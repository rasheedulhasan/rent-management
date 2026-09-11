import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DashboardService, DashboardStats } from '../../services/dashboard.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
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

  constructor(
    private dashboardService: DashboardService,
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
        this.stats = null;
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
      currency: 'AED',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  openAddTenantPage(): void {
    this.router.navigate(['/tenants/add']);
  }

  navigateToTenants(): void {
    this.router.navigate(['/tenants']);
  }
}