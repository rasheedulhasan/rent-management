import { Component } from '@angular/core';
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
import { UserService, CreateUserDto, User } from '../../../services/user.service';

@Component({
  selector: 'app-add-user',
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
  templateUrl: './add-user.component.html',
  styleUrl: './add-user.component.scss'
})
export class AddUserComponent {
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
  saving = false;
  isEditMode = false;
  userId: string | null = null;

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
    private userService: UserService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state) {
      const state = navigation.extras.state as any;
      if (state.mode === 'edit' && state.user) {
        this.isEditMode = true;
        this.userId = state.user.id;
        this.populateForm(state.user);
      }
    }
  }

  private populateForm(user: User): void {
    this.userData = {
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      status: user.status || 'active',
      password: ''
    };
  }

  onSubmit(): void {
    if (!this.isFormValid()) return;

    this.saving = true;

    if (this.isEditMode && this.userId) {
      this.userService.updateUser(this.userId, {
        username: this.userData.username,
        fullName: this.userData.fullName,
        email: this.userData.email,
        phone: this.userData.phone,
        role: this.userData.role as 'admin' | 'collector' | 'manager',
        status: this.userData.status as 'active' | 'inactive'
      }).subscribe({
        next: (response) => {
          if (response.success) {
            this.snackBar.open('User updated successfully', 'Close', { duration: 3000 });
            this.router.navigate(['/users']);
          } else {
            this.snackBar.open(`Failed to update user: ${response.message || 'Unknown error'}`, 'Close', { duration: 5000 });
            this.saving = false;
          }
        },
        error: (error) => {
          console.error('Error updating user:', error);
          this.snackBar.open('Failed to update user. Please try again.', 'Close', { duration: 5000 });
          this.saving = false;
        }
      });
    } else {
      this.userService.createUser(this.userData as CreateUserDto).subscribe({
        next: (response) => {
          if (response.success) {
            this.snackBar.open('User added successfully', 'Close', { duration: 3000 });
            this.router.navigate(['/users']);
          } else {
            this.snackBar.open(`Failed to add user: ${response.message || 'Unknown error'}`, 'Close', { duration: 5000 });
            this.saving = false;
          }
        },
        error: (error) => {
          console.error('Error adding user:', error);
          this.snackBar.open('Failed to add user. Please try again.', 'Close', { duration: 5000 });
          this.saving = false;
        }
      });
    }
  }

  onCancel(): void {
    this.router.navigate(['/users']);
  }

  isFormValid(): boolean {
    return !!(
      this.userData.username?.trim() &&
      this.userData.fullName?.trim() &&
      this.userData.email?.trim() &&
      this.userData.role &&
      this.userData.status &&
      (this.isEditMode || this.userData.password?.trim())
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
