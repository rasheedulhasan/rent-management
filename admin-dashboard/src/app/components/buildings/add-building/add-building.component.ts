import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BuildingService, CreateBuildingDto } from '../../../services/building.service';

@Component({
  selector: 'app-add-building',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './add-building.component.html',
  styleUrl: './add-building.component.scss'
})
export class AddBuildingComponent {
  buildingData: Partial<CreateBuildingDto> = {
    name: '',
    address: '',
    total_floors: 1,
    total_rooms: 0,
    description: '',
    status: 'active'
  };

  statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ];

  saving = false;

  constructor(
    private buildingService: BuildingService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  onSubmit(): void {
    if (!this.isFormValid()) return;

    this.saving = true;
    const submitData = { ...this.buildingData };
    if (submitData.total_floors) {
      submitData.total_floors = Number(submitData.total_floors);
    }
    if (submitData.total_rooms) {
      submitData.total_rooms = Number(submitData.total_rooms);
    }

    this.buildingService.createBuilding(submitData as CreateBuildingDto).subscribe({
      next: () => {
        this.snackBar.open('Building added successfully', 'Close', { duration: 3000 });
        this.router.navigate(['/buildings']);
      },
      error: (error) => {
        console.error('Failed to add building:', error);
        this.snackBar.open('Failed to add building', 'Close', { duration: 3000 });
        this.saving = false;
      }
    });
  }

  onCancel(): void {
    this.router.navigate(['/buildings']);
  }

  isFormValid(): boolean {
    return !!(
      this.buildingData.name?.trim() &&
      this.buildingData.address?.trim() &&
      this.buildingData.total_floors &&
      this.buildingData.total_floors > 0 &&
      this.buildingData.total_rooms !== undefined &&
      this.buildingData.total_rooms >= 0
    );
  }
}
