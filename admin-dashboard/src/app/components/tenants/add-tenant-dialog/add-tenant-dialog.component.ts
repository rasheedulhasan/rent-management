import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { Tenant, CreateTenantDto } from '../../../services/tenant.service';

export interface DialogData {
  mode: 'add' | 'edit';
  tenant?: Tenant;
}

@Component({
  selector: 'app-add-tenant-dialog',
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  templateUrl: './add-tenant-dialog.component.html',
  styleUrl: './add-tenant-dialog.component.scss'
})
export class AddTenantDialogComponent {
  tenantData: Partial<CreateTenantDto> = {
    room_id: '',
    full_name: '',
    phone_number: '',
    email: '',
    id_number: '',
    emergency_contact: '',
    check_in_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    check_out_date: '',
    monthly_rent: 0,
    security_deposit: 0,
    status: 'active',
    notes: ''
  };

  statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'moved_out', label: 'Moved Out' }
  ];

  constructor(
    public dialogRef: MatDialogRef<AddTenantDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {
    if (data.mode === 'edit' && data.tenant) {
      // For edit mode, populate with existing tenant data
      this.tenantData = {
        room_id: data.tenant.room_id,
        full_name: data.tenant.full_name,
        phone_number: data.tenant.phone_number,
        email: data.tenant.email || '',
        id_number: data.tenant.id_number || '',
        emergency_contact: data.tenant.emergency_contact || '',
        check_in_date: data.tenant.check_in_date.split('T')[0],
        check_out_date: data.tenant.check_out_date ? data.tenant.check_out_date.split('T')[0] : '',
        monthly_rent: data.tenant.monthly_rent,
        security_deposit: data.tenant.security_deposit || 0,
        status: data.tenant.status,
        notes: data.tenant.notes || ''
      };
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.isFormValid()) {
      // Convert dates to ISO strings
      const submitData = { ...this.tenantData };
      if (submitData.check_in_date) {
        submitData.check_in_date = new Date(submitData.check_in_date).toISOString();
      }
      if (submitData.check_out_date) {
        submitData.check_out_date = new Date(submitData.check_out_date).toISOString();
      } else {
        submitData.check_out_date = null;
      }
      this.dialogRef.close(submitData);
    }
  }

  isFormValid(): boolean {
    return !!(
      this.tenantData.room_id?.trim() &&
      this.tenantData.full_name?.trim() &&
      this.tenantData.phone_number?.trim() &&
      this.tenantData.check_in_date &&
      this.tenantData.monthly_rent &&
      this.tenantData.monthly_rent > 0
    );
  }

  // Helper to format currency
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  }
}