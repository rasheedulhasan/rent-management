import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TenantService, CreateTenantDto, Tenant } from '../../../services/tenant.service';

@Component({
  selector: 'app-add-tenant',
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
    MatDatepickerModule,
    MatNativeDateModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './add-tenant.component.html',
  styleUrl: './add-tenant.component.scss'
})
export class AddTenantComponent {
  tenantData: Partial<CreateTenantDto> = {
    room_id: '',
    full_name: '',
    phone_number: '',
    email: '',
    id_number: '',
    emergency_contact: '',
    check_in_date: new Date().toISOString().split('T')[0],
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

  saving = false;
  isEditMode = false;
  tenantId: string | null = null;

  constructor(
    private tenantService: TenantService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar
  ) {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state) {
      const state = navigation.extras.state as any;
      if (state.mode === 'edit' && state.tenant) {
        this.isEditMode = true;
        this.tenantId = state.tenant.id;
        this.populateForm(state.tenant);
      }
    }
  }

  private populateForm(tenant: Tenant): void {
    this.tenantData = {
      room_id: tenant.room_id,
      full_name: tenant.full_name,
      phone_number: tenant.phone_number,
      email: tenant.email || '',
      id_number: tenant.id_number || '',
      emergency_contact: tenant.emergency_contact || '',
      check_in_date: tenant.check_in_date.split('T')[0],
      check_out_date: tenant.check_out_date ? tenant.check_out_date.split('T')[0] : '',
      monthly_rent: tenant.monthly_rent,
      security_deposit: tenant.security_deposit || 0,
      status: tenant.status,
      notes: tenant.notes || ''
    };
  }

  onSubmit(): void {
    if (!this.isFormValid()) return;

    this.saving = true;
    const submitData = { ...this.tenantData };
    if (submitData.check_in_date) {
      submitData.check_in_date = new Date(submitData.check_in_date).toISOString();
    }
    if (submitData.check_out_date) {
      submitData.check_out_date = new Date(submitData.check_out_date).toISOString();
    } else {
      submitData.check_out_date = null;
    }

    if (this.isEditMode && this.tenantId) {
      this.tenantService.updateTenant(this.tenantId, submitData).subscribe({
        next: (response) => {
          if (response.success) {
            this.snackBar.open('Tenant updated successfully', 'Close', { duration: 3000 });
            this.router.navigate(['/tenants']);
          } else {
            this.snackBar.open(`Failed to update tenant: ${response.message || 'Unknown error'}`, 'Close', { duration: 5000 });
            this.saving = false;
          }
        },
        error: (error) => {
          console.error('Error updating tenant:', error);
          this.snackBar.open('Failed to update tenant. Please try again.', 'Close', { duration: 5000 });
          this.saving = false;
        }
      });
    } else {
      this.tenantService.createTenant(submitData as CreateTenantDto).subscribe({
        next: (response) => {
          if (response.success) {
            this.snackBar.open('Tenant added successfully', 'Close', { duration: 3000 });
            this.router.navigate(['/tenants']);
          } else {
            this.snackBar.open(`Failed to add tenant: ${response.message || 'Unknown error'}`, 'Close', { duration: 5000 });
            this.saving = false;
          }
        },
        error: (error) => {
          console.error('Error adding tenant:', error);
          this.snackBar.open('Failed to add tenant. Please try again.', 'Close', { duration: 5000 });
          this.saving = false;
        }
      });
    }
  }

  onCancel(): void {
    this.router.navigate(['/tenants']);
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

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  }
}
