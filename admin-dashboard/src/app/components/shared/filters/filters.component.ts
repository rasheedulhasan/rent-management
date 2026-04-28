import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';

export interface FilterOption {
  value: string;
  label: string;
}

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

export interface FilterConfig {
  showBuildingFilter?: boolean;
  showDateRangeFilter?: boolean;
  showCollectorFilter?: boolean;
  showStatusFilter?: boolean;
  showPaymentMethodFilter?: boolean;
  showSearchFilter?: boolean;
  title?: string;
}

@Component({
  selector: 'app-filters',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule
  ],
  templateUrl: './filters.component.html',
  styleUrl: './filters.component.scss'
})
export class FiltersComponent implements OnInit {
  @Input() config: FilterConfig = {
    showBuildingFilter: true,
    showDateRangeFilter: true,
    showCollectorFilter: true,
    showStatusFilter: true,
    showPaymentMethodFilter: false,
    showSearchFilter: true,
    title: 'Filters'
  };

  @Input() buildingOptions: FilterOption[] = [
    { value: 'all', label: 'All Buildings' },
    { value: 'building-a', label: 'Building A' },
    { value: 'building-b', label: 'Building B' },
    { value: 'building-c', label: 'Building C' }
  ];

  @Input() collectorOptions: FilterOption[] = [
    { value: 'all', label: 'All Collectors' },
    { value: 'john-doe', label: 'John Doe' },
    { value: 'jane-smith', label: 'Jane Smith' },
    { value: 'robert-johnson', label: 'Robert Johnson' }
  ];

  @Input() statusOptions: FilterOption[] = [
    { value: 'all', label: 'All Status' },
    { value: 'paid', label: 'Paid' },
    { value: 'pending', label: 'Pending' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'partial', label: 'Partial' }
  ];

  @Input() paymentMethodOptions: FilterOption[] = [
    { value: 'all', label: 'All Methods' },
    { value: 'cash', label: 'Cash' },
    { value: 'bank-transfer', label: 'Bank Transfer' },
    { value: 'check', label: 'Check' },
    { value: 'online', label: 'Online Payment' }
  ];

  @Output() filterChange = new EventEmitter<any>();
  @Output() filterReset = new EventEmitter<void>();

  // Filter values
  buildingFilter = 'all';
  collectorFilter = 'all';
  statusFilter = 'all';
  paymentMethodFilter = 'all';
  searchTerm = '';
  dateRange: DateRange = { start: null, end: null };

  // Active filters count
  activeFiltersCount = 0;

  ngOnInit(): void {
    this.calculateActiveFilters();
  }

  onFilterChange(): void {
    this.calculateActiveFilters();
    
    const filters = {
      building: this.buildingFilter !== 'all' ? this.buildingFilter : null,
      collector: this.collectorFilter !== 'all' ? this.collectorFilter : null,
      status: this.statusFilter !== 'all' ? this.statusFilter : null,
      paymentMethod: this.paymentMethodFilter !== 'all' ? this.paymentMethodFilter : null,
      search: this.searchTerm || null,
      dateRange: this.dateRange.start || this.dateRange.end ? this.dateRange : null
    };

    this.filterChange.emit(filters);
  }

  resetFilters(): void {
    this.buildingFilter = 'all';
    this.collectorFilter = 'all';
    this.statusFilter = 'all';
    this.paymentMethodFilter = 'all';
    this.searchTerm = '';
    this.dateRange = { start: null, end: null };
    
    this.calculateActiveFilters();
    this.filterReset.emit();
    this.filterChange.emit({
      building: null,
      collector: null,
      status: null,
      paymentMethod: null,
      search: null,
      dateRange: null
    });
  }

  calculateActiveFilters(): void {
    let count = 0;
    
    if (this.buildingFilter !== 'all') count++;
    if (this.collectorFilter !== 'all') count++;
    if (this.statusFilter !== 'all') count++;
    if (this.paymentMethodFilter !== 'all') count++;
    if (this.searchTerm) count++;
    if (this.dateRange.start || this.dateRange.end) count++;
    
    this.activeFiltersCount = count;
  }

  getActiveFilters(): string[] {
    const activeFilters: string[] = [];
    
    if (this.buildingFilter !== 'all') {
      const building = this.buildingOptions.find(opt => opt.value === this.buildingFilter);
      if (building) activeFilters.push(`Building: ${building.label}`);
    }
    
    if (this.collectorFilter !== 'all') {
      const collector = this.collectorOptions.find(opt => opt.value === this.collectorFilter);
      if (collector) activeFilters.push(`Collector: ${collector.label}`);
    }
    
    if (this.statusFilter !== 'all') {
      const status = this.statusOptions.find(opt => opt.value === this.statusFilter);
      if (status) activeFilters.push(`Status: ${status.label}`);
    }
    
    if (this.paymentMethodFilter !== 'all') {
      const method = this.paymentMethodOptions.find(opt => opt.value === this.paymentMethodFilter);
      if (method) activeFilters.push(`Method: ${method.label}`);
    }
    
    if (this.searchTerm) {
      activeFilters.push(`Search: "${this.searchTerm}"`);
    }
    
    if (this.dateRange.start || this.dateRange.end) {
      const start = this.dateRange.start ? this.formatDate(this.dateRange.start) : 'Any';
      const end = this.dateRange.end ? this.formatDate(this.dateRange.end) : 'Any';
      activeFilters.push(`Date: ${start} - ${end}`);
    }
    
    return activeFilters;
  }

  removeFilter(filterType: string): void {
    switch (filterType) {
      case 'building':
        this.buildingFilter = 'all';
        break;
      case 'collector':
        this.collectorFilter = 'all';
        break;
      case 'status':
        this.statusFilter = 'all';
        break;
      case 'paymentMethod':
        this.paymentMethodFilter = 'all';
        break;
      case 'search':
        this.searchTerm = '';
        break;
      case 'dateRange':
        this.dateRange = { start: null, end: null };
        break;
    }
    
    this.onFilterChange();
  }

  removeFilterFromChip(filterText: string): void {
    // Parse the filter text to determine which filter to remove
    if (filterText.startsWith('Building:')) {
      this.buildingFilter = 'all';
    } else if (filterText.startsWith('Collector:')) {
      this.collectorFilter = 'all';
    } else if (filterText.startsWith('Status:')) {
      this.statusFilter = 'all';
    } else if (filterText.startsWith('Method:')) {
      this.paymentMethodFilter = 'all';
    } else if (filterText.startsWith('Search:')) {
      this.searchTerm = '';
    } else if (filterText.startsWith('Date:')) {
      this.dateRange = { start: null, end: null };
    }
    
    this.onFilterChange();
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
