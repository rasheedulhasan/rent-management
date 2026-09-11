import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatBadgeModule } from '@angular/material/badge';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export interface Alert {
  id: string;
  title: string;
  message: string;
  type: 'overdue' | 'pending' | 'system' | 'warning' | 'info';
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
  read: boolean;
  actionUrl?: string;
  data?: any;
}

@Component({
  selector: 'app-alerts',
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatBadgeModule,
    MatListModule,
    MatDividerModule,
    MatProgressBarModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './alerts.component.html',
  styleUrl: './alerts.component.scss'
})
export class AlertsComponent implements OnInit {
  alerts: Alert[] = [];
  filteredAlerts: Alert[] = [];
  loading = false;
  filterType: string = 'all';
  filterPriority: string = 'all';
  filterRead: string = 'all';

  // Mock data for development
  mockAlerts: Alert[] = [
    {
      id: '1',
      title: 'Overdue Rent Alert',
      message: 'Tenant John Doe in Room 101 has overdue rent of $1,200 (30 days overdue)',
      type: 'overdue',
      priority: 'high',
      createdAt: new Date('2024-01-15T10:30:00'),
      read: false,
      actionUrl: '/pending-rent'
    },
    {
      id: '2',
      title: 'Long Pending Tenant',
      message: 'Tenant Alice Smith has pending rent for 45 days. Consider sending a reminder.',
      type: 'pending',
      priority: 'high',
      createdAt: new Date('2024-01-14T14:20:00'),
      read: false,
      actionUrl: '/pending-rent'
    },
    {
      id: '3',
      title: 'System Maintenance',
      message: 'Scheduled maintenance on Sunday, 2 AM - 4 AM. System may be unavailable.',
      type: 'system',
      priority: 'medium',
      createdAt: new Date('2024-01-13T09:15:00'),
      read: true,
      actionUrl: '/settings'
    },
    {
      id: '4',
      title: 'Collector Performance',
      message: 'Collector Jane Smith collected 95% of assigned rent this month. Great performance!',
      type: 'info',
      priority: 'low',
      createdAt: new Date('2024-01-12T16:45:00'),
      read: true
    },
    {
      id: '5',
      title: 'Building A Maintenance Due',
      message: 'Quarterly maintenance for Building A is due next week. Schedule with maintenance team.',
      type: 'warning',
      priority: 'medium',
      createdAt: new Date('2024-01-11T11:10:00'),
      read: false
    },
    {
      id: '6',
      title: 'Multiple Overdue Cases',
      message: '3 tenants in Building B have overdue rent exceeding 60 days. Requires immediate attention.',
      type: 'overdue',
      priority: 'high',
      createdAt: new Date('2024-01-10T08:30:00'),
      read: false,
      actionUrl: '/pending-rent'
    },
    {
      id: '7',
      title: 'New User Registered',
      message: 'New collector "Michael Brown" has been added to the system.',
      type: 'info',
      priority: 'low',
      createdAt: new Date('2024-01-09T13:25:00'),
      read: true
    },
    {
      id: '8',
      title: 'Payment Gateway Issue',
      message: 'Credit card payments are experiencing delays. Alternative payment methods recommended.',
      type: 'warning',
      priority: 'medium',
      createdAt: new Date('2024-01-08T15:40:00'),
      read: false
    }
  ];

  typeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'overdue', label: 'Overdue Rent' },
    { value: 'pending', label: 'Pending Tenants' },
    { value: 'system', label: 'System' },
    { value: 'warning', label: 'Warnings' },
    { value: 'info', label: 'Info' }
  ];

  priorityOptions = [
    { value: 'all', label: 'All Priorities' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ];

  readOptions = [
    { value: 'all', label: 'All' },
    { value: 'unread', label: 'Unread Only' },
    { value: 'read', label: 'Read Only' }
  ];

  constructor(private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.loadAlerts();
  }

  loadAlerts(): void {
    this.loading = true;
    // In a real app, you would fetch alerts from an API
    setTimeout(() => {
      this.alerts = this.mockAlerts;
      this.filteredAlerts = [...this.alerts];
      this.loading = false;
    }, 500);
  }

  applyFilters(): void {
    let filtered = [...this.alerts];

    // Apply type filter
    if (this.filterType !== 'all') {
      filtered = filtered.filter(alert => alert.type === this.filterType);
    }

    // Apply priority filter
    if (this.filterPriority !== 'all') {
      filtered = filtered.filter(alert => alert.priority === this.filterPriority);
    }

    // Apply read filter
    if (this.filterRead !== 'all') {
      const readStatus = this.filterRead === 'read';
      filtered = filtered.filter(alert => alert.read === readStatus);
    }

    this.filteredAlerts = filtered;
  }

  resetFilters(): void {
    this.filterType = 'all';
    this.filterPriority = 'all';
    this.filterRead = 'all';
    this.filteredAlerts = [...this.alerts];
  }

  markAsRead(alert: Alert): void {
    alert.read = true;
    this.applyFilters();
    this.snackBar.open('Alert marked as read', 'Close', { duration: 2000 });
  }

  markAllAsRead(): void {
    this.alerts.forEach(alert => alert.read = true);
    this.applyFilters();
    this.snackBar.open('All alerts marked as read', 'Close', { duration: 2000 });
  }

  deleteAlert(alert: Alert): void {
    this.alerts = this.alerts.filter(a => a.id !== alert.id);
    this.applyFilters();
    this.snackBar.open('Alert deleted', 'Close', { duration: 2000 });
  }

  clearAllAlerts(): void {
    if (confirm('Are you sure you want to clear all alerts? This action cannot be undone.')) {
      this.alerts = [];
      this.filteredAlerts = [];
      this.snackBar.open('All alerts cleared', 'Close', { duration: 2000 });
    }
  }

  getAlertIcon(type: string): string {
    switch (type) {
      case 'overdue': return 'warning';
      case 'pending': return 'schedule';
      case 'system': return 'build';
      case 'warning': return 'error_outline';
      case 'info': return 'info';
      default: return 'notifications';
    }
  }

  getAlertColor(type: string): string {
    switch (type) {
      case 'overdue': return 'warn';
      case 'pending': return 'accent';
      case 'system': return 'primary';
      case 'warning': return 'warn';
      case 'info': return 'primary';
      default: return '';
    }
  }

  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'high': return 'warn';
      case 'medium': return 'accent';
      case 'low': return 'primary';
      default: return '';
    }
  }

  getPriorityLabel(priority: string): string {
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case 'overdue': return 'Overdue Rent';
      case 'pending': return 'Pending Tenant';
      case 'system': return 'System';
      case 'warning': return 'Warning';
      case 'info': return 'Information';
      default: return type;
    }
  }

  getUnreadCount(): number {
    return this.alerts.filter(alert => !alert.read).length;
  }

  getHighPriorityCount(): number {
    return this.alerts.filter(alert => alert.priority === 'high').length;
  }

  getOverdueAlertCount(): number {
    return this.alerts.filter(alert => alert.type === 'overdue').length;
  }

  formatDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }

  navigateToAction(alert: Alert): void {
    if (alert.actionUrl) {
      // In a real app, you would use router.navigate
      this.snackBar.open(`Navigating to ${alert.actionUrl}`, 'Close', { duration: 2000 });
      // this.router.navigate([alert.actionUrl]);
    }
  }
}
