import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone?: string;
  role: 'admin' | 'collector' | 'manager';
  status: 'active' | 'inactive';
  permissions?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface CreateUserDto {
  username: string;
  fullName: string;
  email: string;
  phone?: string;
  role: 'admin' | 'collector' | 'manager';
  password: string;
  status?: 'active' | 'inactive';
}

export interface UpdateUserDto {
  username?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  role?: 'admin' | 'collector' | 'manager';
  status?: 'active' | 'inactive';
  permissions?: string[];
}

export interface UsersResponse {
  success: boolean;
  data: User[];
  total: number;
  message?: string;
  error?: string;
}

export interface UserResponse {
  success: boolean;
  data: User;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  constructor(private api: ApiService) { }

  // Get all users with pagination and filters
  getAllUsers(filters?: { role?: string; status?: string; limit?: number; offset?: number }): Observable<UsersResponse> {
    return this.api.get<UsersResponse>('users', filters);
  }

  // Get user by ID
  getUserById(id: string): Observable<UserResponse> {
    return this.api.get<UserResponse>(`users/${id}`);
  }

  // Create new user
  createUser(user: CreateUserDto): Observable<UserResponse> {
    return this.api.post<UserResponse>('users', user);
  }

  // Update user
  updateUser(id: string, user: UpdateUserDto): Observable<UserResponse> {
    return this.api.put<UserResponse>(`users/${id}`, user);
  }

  // Delete user
  deleteUser(id: string): Observable<{ success: boolean; message: string }> {
    return this.api.delete<{ success: boolean; message: string }>(`users/${id}`);
  }

  // Get users by role
  getUsersByRole(role: string): Observable<UsersResponse> {
    return this.api.get<UsersResponse>('users', { role });
  }

  // Get collectors only
  getCollectors(): Observable<UsersResponse> {
    return this.getUsersByRole('collector');
  }

  // Search users
  searchUsers(query: string): Observable<UsersResponse> {
    return this.api.get<UsersResponse>(`users/search/${query}`);
  }
}