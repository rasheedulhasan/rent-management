import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Building, CreateBuildingDto } from '../../../services/building.service';

export interface DialogData {
  mode: 'add' | 'edit';
  building?: Building;
}

@Component({
  selector: 'app-add-building-dialog',
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './add-building-dialog.component.html',
  styleUrl: './add-building-dialog.component.scss'
})
export class AddBuildingDialogComponent {
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

  constructor(
    public dialogRef: MatDialogRef<AddBuildingDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {
    if (data.mode === 'edit' && data.building) {
      // For edit mode, populate with existing building data
      this.buildingData = {
        name: data.building.name,
        address: data.building.address,
        total_floors: data.building.total_floors,
        total_rooms: data.building.total_rooms,
        description: data.building.description || '',
        status: data.building.status
      };
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.isFormValid()) {
      // Ensure numeric values are numbers
      const submitData = { ...this.buildingData };
      if (submitData.total_floors) {
        submitData.total_floors = Number(submitData.total_floors);
      }
      if (submitData.total_rooms) {
        submitData.total_rooms = Number(submitData.total_rooms);
      }
      this.dialogRef.close(submitData);
    }
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