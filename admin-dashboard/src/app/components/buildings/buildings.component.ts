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
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatMenuModule } from '@angular/material/menu';
import { Building, BuildingService } from '../../services/building.service';
import { RoomService } from '../../services/room.service';

@Component({
  selector: 'app-buildings',
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
  totalRoomCount = 0;

  statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ];

  constructor(
    private buildingService: BuildingService,
    private roomService: RoomService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadBuildings();
    this.loadRoomCount();
  }

  loadRoomCount(): void {
    this.roomService.getRoomCount().subscribe({
      next: (count) => { this.totalRoomCount = count; },
      error: (error) => {
        console.error('Failed to load room count:', error);
        this.totalRoomCount = 0;
      }
    });
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
        this.dataSource = [];
        this.filteredDataSource = [];
        this.totalItems = 0;
        this.loading = false;
        this.snackBar.open('Failed to load buildings', 'Close', { duration: 3000 });
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
    this.filteredDataSource = this.filteredDataSource.slice(startIndex, endIndex);
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.updatePagedData();
  }

  openAddBuildingPage(): void {
    this.router.navigate(['/buildings/add']);
  }

  deleteBuilding(id: string): void {
    if (confirm('Are you sure you want to delete this building?')) {
      this.buildingService.deleteBuilding(id).subscribe({
        next: () => {
          this.snackBar.open('Building deleted successfully', 'Close', { duration: 3000 });
          this.loadBuildings();
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
    // Actual number of room records — not the building's declared total_rooms capacity.
    return this.totalRoomCount;
  }
}