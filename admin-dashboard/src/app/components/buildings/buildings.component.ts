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
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatMenuModule } from '@angular/material/menu';
import { Building, BuildingService } from '../../services/building.service';
import { AddBuildingDialogComponent } from './add-building-dialog/add-building-dialog.component';

@Component({
  selector: 'app-buildings',
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
    MatTooltipModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    MatMenuModule
  ],
  templateUrl: './buildings.component.html',
  styleUrl: './buildings.component.scss'
})
export class BuildingsComponent implements OnInit {
  displayedColumns: string[] = ['id', 'name', 'status', 'created_at', 'actions'];
  dataSource: Building[] = [];
  filteredDataSource: Building[] = [];
  loading = false;
  searchQuery = '';
  statusFilter: string = 'all';

  // Pagination
  pageSize = 10;
  pageIndex = 0;
  pageSizeOptions = [5, 10, 25, 50];
  totalItems = 0;

  // Mock data for development (will be replaced with API)
  mockBuildings: Building[] = [
    {
      id: '1',
      name: 'Al Noor Building',
      address: '123 Al Noor Street, Dubai',
      total_floors: 5,
      total_rooms: 20,
      description: 'Luxury residential building',
      status: 'active',
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-15T10:30:00Z'
    },
    {
      id: '2',
      name: 'Sunrise Tower',
      address: '456 Sunrise Road, Dubai',
      total_floors: 10,
      total_rooms: 40,
      description: 'Modern high-rise with amenities',
      status: 'active',
      created_at: '2024-02-10T14:20:00Z',
      updated_at: '2024-02-10T14:20:00Z'
    },
    {
      id: '3',
      name: 'Palm Residency',
      address: '789 Palm Jumeirah, Dubai',
      total_floors: 8,
      total_rooms: 32,
      description: 'Beachfront apartments',
      status: 'active',
      created_at: '2024-03-01T11:45:00Z',
      updated_at: '2024-03-01T11:45:00Z'
    },
    {
      id: '4',
      name: 'City View Apartments',
      address: '101 Downtown, Dubai',
      total_floors: 12,
      total_rooms: 48,
      description: 'City center luxury apartments',
      status: 'active',
      created_at: '2024-03-15T09:15:00Z',
      updated_at: '2024-03-15T09:15:00Z'
    },
    {
      id: '5',
      name: 'Green Park Building',
      address: '202 Green Park, Dubai',
      total_floors: 6,
      total_rooms: 24,
      description: 'Eco-friendly building with garden',
      status: 'inactive',
      created_at: '2024-04-01T13:10:00Z',
      updated_at: '2024-04-01T13:10:00Z'
    }
  ];

  statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ];

  constructor(
    private buildingService: BuildingService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadBuildings();
  }

  loadBuildings(): void {
    this.loading = true;
    this.buildingService.getAllBuildings().subscribe({
      next: (buildings) => {
        this.dataSource = buildings;
        this.filteredDataSource = [...this.dataSource];
        this.totalItems = this.filteredDataSource.length;
        this.updatePagedData();
        this.loading = false;
      },
      error: (error) => {
        console.error('Failed to load buildings:', error);
        // Fallback to mock data if API fails
        this.dataSource = this.mockBuildings;
        this.filteredDataSource = [...this.dataSource];
        this.totalItems = this.filteredDataSource.length;
        this.updatePagedData();
        this.loading = false;
        this.snackBar.open('Using mock data due to API error', 'Close', { duration: 3000 });
      }
    });
  }

  applyFilters(): void {
    let filtered = this.dataSource;

    // Search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(building =>
        building.name.toLowerCase().includes(query) ||
        building.address.toLowerCase().includes(query) ||
        building.description?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(building => building.status === this.statusFilter);
    }

    this.filteredDataSource = filtered;
    this.totalItems = filtered.length;
    this.pageIndex = 0;
    this.updatePagedData();
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.applyFilters();
  }

  updatePagedData(): void {
    const startIndex = this.pageIndex * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    // For now, we'll just slice the filtered data (client-side pagination)
    // In a real app, you'd implement server-side pagination
    this.filteredDataSource = this.filteredDataSource.slice(startIndex, endIndex);
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.updatePagedData();
  }

  openAddBuildingDialog(): void {
    const dialogRef = this.dialog.open(AddBuildingDialogComponent, {
      width: '500px',
      data: {}
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.buildingService.createBuilding(result).subscribe({
          next: (newBuilding) => {
            this.snackBar.open('Building added successfully', 'Close', { duration: 3000 });
            this.loadBuildings(); // Reload list
          },
          error: (error) => {
            console.error('Failed to add building:', error);
            this.snackBar.open('Failed to add building', 'Close', { duration: 3000 });
          }
        });
      }
    });
  }

  deleteBuilding(id: string): void {
    if (confirm('Are you sure you want to delete this building?')) {
      this.buildingService.deleteBuilding(id).subscribe({
        next: () => {
          this.snackBar.open('Building deleted successfully', 'Close', { duration: 3000 });
          this.loadBuildings(); // Reload list
        },
        error: (error) => {
          console.error('Failed to delete building:', error);
          this.snackBar.open('Failed to delete building', 'Close', { duration: 3000 });
        }
      });
    }
  }

  formatDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getStats(): { total: number, active: number, inactive: number } {
    const total = this.dataSource.length;
    const active = this.dataSource.filter(b => b.status === 'active').length;
    const inactive = total - active;
    return { total, active, inactive };
  }

  getTotalRooms(): number {
    return this.dataSource.reduce((sum, b) => sum + b.total_rooms, 0);
  }
}