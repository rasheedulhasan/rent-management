import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { User, CreateUserDto } from '../../../services/user.service';

export interface DialogData {
  mode: 'add' | 'edit';
  user?: User;
}

@Component({
  selector: 'app-add-user-dialog',
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
  templateUrl: './add-user-dialog.component.html',
  styleUrl: './add-user-dialog.component.scss'
})
export class AddUserDialogComponent {
  userData: Partial<CreateUserDto> = {
    username: '',
    fullName: '',
    email: '',
    phone: '',
    role: 'collector',
    status: 'active',
    password: ''
  };

  showPassword = false;
  roles = [
    { value: 'admin', label: 'Admin' },
    { value: 'collector', label: 'Collector' },
    { value: 'manager', label: 'Manager' }
  ];

  statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ];

  constructor(
    public dialogRef: MatDialogRef<AddUserDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {
    if (data.mode === 'edit' && data.user) {
      // For edit mode, populate with existing user data
      this.userData = {
        username: data.user.username,
        fullName: data.user.fullName,
        email: data.user.email,
        phone: data.user.phone || '',
        role: data.user.role,
        status: data.user.status || 'active',
        password: '' // Don't show password in edit mode
      };
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.isFormValid()) {
      this.dialogRef.close(this.userData);
    }
  }

  isFormValid(): boolean {
    return !!(
      this.userData.username?.trim() &&
      this.userData.fullName?.trim() &&
      this.userData.email?.trim() &&
      this.userData.role &&
      this.userData.status &&
      (this.data.mode === 'edit' || this.userData.password?.trim())
    );
  }

  generatePassword(): void {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.userData.password = password;
  }

  getPasswordStrength(): string {
    const password = this.userData.password || '';
    if (password.length === 0) return 'None';
    if (password.length < 6) return 'Weak';
    if (password.length < 10) return 'Medium';
    
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*]/.test(password);
    
    const score = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
    
    if (score >= 4) return 'Strong';
    if (score >= 3) return 'Good';
    return 'Fair';
  }

  getPasswordStrengthClass(): string {
    const strength = this.getPasswordStrength();
    switch (strength) {
      case 'Strong': return 'strength-strong';
      case 'Good': return 'strength-good';
      case 'Medium': return 'strength-medium';
      case 'Fair': return 'strength-fair';
      case 'Weak': return 'strength-weak';
      default: return 'strength-none';
    }
  }
}