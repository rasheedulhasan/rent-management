import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RoomService, Room } from '../../services/room.service';

@Component({
  selector: 'app-rooms',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './rooms.component.html',
  styleUrl: './rooms.component.scss'
})
export class RoomsComponent implements OnInit {
  displayedColumns: string[] = [
    'room_number',
    'building_name',
    'floor',
    'type',
    'monthly_rent',
    'status',
    'current_tenant'
  ];

  rooms: Room[] = [];

  loading = false;
  totalRooms = 0;

  // Server-side pagination — default 50 per page
  pageSize = 50;
  pageIndex = 0;
  pageSizeOptions = [10, 25, 50, 100];

  // Filters
  searchTerm = '';
  statusFilter = 'all';
  statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'vacant', label: 'Vacant' },
    { value: 'occupied', label: 'Occupied' },
    { value: 'under_maintenance', label: 'Under Maintenance' }
  ];

  private searchTimer: any = null;

  importing = false;

  constructor(
    private roomService: RoomService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadRooms();
  }

  loadRooms(): void {
    this.loading = true;
    this.roomService.getRoomsPaged({
      status: this.statusFilter,
      search: this.searchTerm.trim(),
      limit: this.pageSize,
      offset: this.pageIndex * this.pageSize
    }).subscribe({
      next: ({ rooms, total }) => {
        this.rooms = rooms;
        this.totalRooms = total;
        this.loading = false;
      },
      error: (error) => {
        console.error('Failed to load rooms:', error);
        this.rooms = [];
        this.totalRooms = 0;
        this.loading = false;
        this.snackBar.open('Failed to load rooms', 'Close', { duration: 4000 });
      }
    });
  }

  // Debounced so we don't hit the server on every keystroke
  onSearchChange(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.pageIndex = 0;
      this.loadRooms();
    }, 400);
  }

  onStatusChange(): void {
    this.pageIndex = 0;
    this.loadRooms();
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadRooms();
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.statusFilter = 'all';
    this.pageIndex = 0;
    this.loadRooms();
  }

  // ── CSV template + import ───────────────────────────────────

  onDownloadTemplate(): void {
    this.roomService.getCsvTemplate().subscribe({
      next: (csv) => {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'rooms-template.csv';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Failed to download template:', error);
        this.snackBar.open('Failed to download template', 'Close', { duration: 4000 });
      }
    });
  }

  onUploadClick(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const csv = String(reader.result || '');
      this.importing = true;

      this.roomService.importCsv(csv).subscribe({
        next: (res) => {
          this.importing = false;
          input.value = '';

          if (res.success) {
            const d = res.data || {};
            this.snackBar.open(
              `Imported: ${d.inserted || 0} added, ${d.updated || 0} updated, ${d.failed || 0} failed`,
              'Close',
              { duration: 6000 }
            );
            if (d.errors && d.errors.length > 0) {
              console.warn('CSV import row errors:', d.errors);
            }
            this.pageIndex = 0;
            this.loadRooms();
          } else {
            this.snackBar.open(res.error || 'Import failed', 'Close', { duration: 6000 });
          }
        },
        error: (error) => {
          this.importing = false;
          input.value = '';
          console.error('CSV import failed:', error);
          this.snackBar.open('Import failed. Please check the file format.', 'Close', { duration: 6000 });
        }
      });
    };

    reader.onerror = () => {
      this.snackBar.open('Could not read the file', 'Close', { duration: 4000 });
    };

    reader.readAsText(file);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'vacant': return 'status-vacant';
      case 'occupied': return 'status-occupied';
      case 'under_maintenance': return 'status-maintenance';
      default: return '';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'vacant': return 'Vacant';
      case 'occupied': return 'Occupied';
      case 'under_maintenance': return 'Under Maintenance';
      default: return status;
    }
  }
}
