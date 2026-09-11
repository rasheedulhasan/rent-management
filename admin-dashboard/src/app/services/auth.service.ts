import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';

export interface AuthUser {
  $id: string;
  username: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
}

export interface LoginResponse {
  success: boolean;
  data: {
    user: AuthUser;
    token: string;
  };
  message?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = 'https://seashell-app-ydu9s.ondigitalocean.app/api';
  private currentUserSubject = new BehaviorSubject<AuthUser | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private isBrowser: boolean;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.loadStoredUser();
  }

  private loadStoredUser(): void {
    if (!this.isBrowser) return;
    try {
      const stored = localStorage.getItem('currentUser');
      if (stored) {
        const user = JSON.parse(stored);
        this.currentUserSubject.next(user);
      }
    } catch {
      localStorage.removeItem('currentUser');
    }
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API_URL}/users/validate`, { username, password }).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.setSession(response.data.user, response.data.token);
        }
      }),
      catchError(error => {
        const errorMsg = error.error?.error || error.message || 'Login failed';
        return of({ success: false, error: errorMsg } as LoginResponse);
      })
    );
  }

  private setSession(user: AuthUser, token: string): void {
    if (!this.isBrowser) return;
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('authToken', token);
    this.currentUserSubject.next(user);
  }

  logout(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
    this.currentUserSubject.next(null);
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUserSubject.getValue();
  }

  isLoggedIn(): boolean {
    const user = this.getCurrentUser();
    return !!user && user.status === 'active';
  }

  isAdmin(): boolean {
    const user = this.getCurrentUser();
    return !!user && user.role === 'admin' && user.status === 'active';
  }

  getToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem('authToken');
  }
}
