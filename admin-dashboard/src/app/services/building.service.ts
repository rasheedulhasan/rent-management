import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface Building {
  id: string;
  name: string;
  address: string;
  total_floors: number;
  total_rooms: number;
  description?: string;
  status: 'active' | 'inactive';
  created_at?: string;
  updated_at?: string;
}

export interface CreateBuildingDto {
  name: string;
  address?: string;
  total_floors?: number;
  total_rooms?: number;
  description?: string;
  status?: 'active' | 'inactive';
}

@Injectable({
  providedIn: 'root'
})
export class BuildingService {
  constructor(private api: ApiService) { }

  // Get all buildings
  getAllBuildings(): Observable<Building[]> {
    return this.api.get<{ success: boolean; data: Building[]; total: number }>('buildings')
      .pipe(map(response => response.data));
  }

  // Get building by ID
  getBuildingById(id: string): Observable<Building> {
    return this.api.get<{ success: boolean; data: Building }>(`buildings/${id}`)
      .pipe(map(response => response.data));
  }

  // Create new building
  createBuilding(building: CreateBuildingDto): Observable<Building> {
    return this.api.post<{ success: boolean; data: Building; message: string }>('buildings', building)
      .pipe(map(response => response.data));
  }

  // Update building
  updateBuilding(id: string, building: Partial<Building>): Observable<Building> {
    return this.api.put<{ success: boolean; data: Building; message: string }>(`buildings/${id}`, building)
      .pipe(map(response => response.data));
  }

  // Delete building
  deleteBuilding(id: string): Observable<{ success: boolean; message: string }> {
    return this.api.delete<{ success: boolean; message: string }>(`buildings/${id}`);
  }

  // Get buildings for dropdown (active only)
  getActiveBuildings(): Observable<Building[]> {
    return this.api.get<{ success: boolean; data: Building[]; total: number }>('buildings', { status: 'active' })
      .pipe(map(response => response.data));
  }
}