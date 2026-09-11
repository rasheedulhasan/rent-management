import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  username = '';
  password = '';
  loading = false;
  errorMessage = '';
  hidePassword = true;
  returnUrl = '/dashboard';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // If already logged in as admin, redirect to dashboard
    if (this.authService.isAdmin()) {
      this.router.navigate(['/dashboard']);
      return;
    }

    // Get return URL from query params
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
  }

  onSubmit(): void {
    if (!this.username.trim() || !this.password.trim()) {
      this.errorMessage = 'Please enter both username and password';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.authService.login(this.username.trim(), this.password.trim()).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          // Check if user has admin role
          if (this.authService.isAdmin()) {
            this.router.navigateByUrl(this.returnUrl);
          } else {
            this.authService.logout();
            this.errorMessage = 'Access denied. Only admin users can access this dashboard.';
          }
        } else {
          this.errorMessage = response.error || 'Invalid username or password';
        }
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Connection error. Please try again.';
      }
    });
  }
}
