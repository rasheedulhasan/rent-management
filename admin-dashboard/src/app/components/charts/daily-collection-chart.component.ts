import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-daily-collection-chart',
  standalone: true,
  imports: [
    CommonModule,
    BaseChartDirective,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    FormsModule
  ],
  templateUrl: './daily-collection-chart.component.html',
  styleUrl: './daily-collection-chart.component.scss'
})
export class DailyCollectionChartComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();
  
  // Chart configuration
  public barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            return value !== null ? `$${value.toLocaleString()}` : '$0';
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => {
            return `$${Number(value).toLocaleString()}`;
          }
        }
      }
    }
  };

  public barChartType: ChartType = 'bar';
  public barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: []
  };

  // Time period options
  timePeriods = [
    { value: '7', label: 'Last 7 Days' },
    { value: '30', label: 'Last 30 Days' },
    { value: '90', label: 'Last 90 Days' }
  ];
  selectedPeriod = '30';

  loading = true;
  error: string | null = null;

  // Mock data for demonstration
  mockData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        data: [3200, 2800, 4100, 3500, 5200, 4800, 3900],
        label: 'Daily Collection',
        backgroundColor: 'rgba(33, 150, 243, 0.7)',
        borderColor: 'rgba(33, 150, 243, 1)',
        borderWidth: 1
      }
    ]
  };

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.loadChartData();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadChartData(): void {
    this.loading = true;
    this.error = null;

    // For now, use mock data since backend might not be ready
    // In production, you would call the actual service:
    // this.subscriptions.add(
    //   this.dashboardService.getDailyCollection().subscribe({
    //     next: (data) => this.updateChartData(data),
    //     error: (err) => this.handleError(err)
    //   })
    // );

    // Using mock data for now
    setTimeout(() => {
      this.updateChartData(this.mockData);
      this.loading = false;
    }, 800);
  }

  updateChartData(data: any): void {
    this.barChartData = {
      labels: data.labels,
      datasets: data.datasets
    };
  }

  handleError(error: any): void {
    console.error('Error loading chart data:', error);
    this.error = 'Failed to load chart data';
    this.loading = false;
    
    // Fallback to mock data
    this.updateChartData(this.mockData);
  }

  onPeriodChange(): void {
    this.loadChartData();
  }

  refreshChart(): void {
    this.loadChartData();
  }
}