import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface Tenant {
  id: string;
  room_id: string;
  full_name: string;
  phone_number: string;
  email?: string;
  id_number?: string;
  emergency_contact?: string;
  check_in_date: string; // ISO string
  check_out_date?: string | null;
  monthly_rent: number;
  security_deposit?: number;
  status: 'active' | 'inactive' | 'moved_out';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantDto {
  room_id: string;
  full_name: string;
  phone_number: string;
  email?: string;
  id_number?: string;
  emergency_contact?: string;
  check_in_date: string;
  check_out_date?: string | null;
  monthly_rent: number;
  security_deposit?: number;
  status?: 'active' | 'inactive' | 'moved_out';
  notes?: string;
}

export interface UpdateTenantDto {
  room_id?: string;
  full_name?: string;
  phone_number?: string;
  email?: string;
  id_number?: string;
  emergency_contact?: string;
  check_in_date?: string;
  check_out_date?: string | null;
  monthly_rent?: number;
  security_deposit?: number;
  status?: 'active' | 'inactive' | 'moved_out';
  notes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TenantService {
  constructor(private api: ApiService) { }

  // Get all tenants with optional filters
  getAllTenants(filters?: { status?: string; room_id?: string; limit?: number; offset?: number }): Observable<{ success: boolean; data: Tenant[]; total: number }> {
    return this.api.get<{ success: boolean; data: Tenant[]; total: number }>('tenants', filters);
  }

  // Get tenant by ID
  getTenantById(id: string): Observable<{ success: boolean; data: Tenant }> {
    return this.api.get<{ success: boolean; data: Tenant }>(`tenants/${id}`);
  }

  // Create new tenant
  createTenant(tenant: CreateTenantDto): Observable<{ success: boolean; data: Tenant; message: string }> {
    return this.api.post<{ success: boolean; data: Tenant; message: string }>('tenants', tenant);
  }

  // Update tenant
  updateTenant(id: string, tenant: UpdateTenantDto): Observable<{ success: boolean; data: Tenant; message: string }> {
    return this.api.put<{ success: boolean; data: Tenant; message: string }>(`tenants/${id}`, tenant);
  }

  // Delete tenant
  deleteTenant(id: string): Observable<{ success: boolean; message: string }> {
    return this.api.delete<{ success: boolean; message: string }>(`tenants/${id}`);
  }

  // Get tenants by room
  getTenantsByRoom(roomId: string, status?: string): Observable<{ success: boolean; data: Tenant[] }> {
    const params: any = {};
    if (status) params.status = status;
    return this.api.get<{ success: boolean; data: Tenant[] }>(`tenants/room/${roomId}`, params);
  }

  // Get tenants by status
  getTenantsByStatus(status: string): Observable<{ success: boolean; data: Tenant[] }> {
    return this.api.get<{ success: boolean; data: Tenant[] }>('tenants', { status });
  }

  // Search tenants by name or phone
  searchTenants(searchTerm: string): Observable<{ success: boolean; data: Tenant[] }> {
    return this.api.get<{ success: boolean; data: Tenant[] }>('tenants/search', { q: searchTerm });
  }
}