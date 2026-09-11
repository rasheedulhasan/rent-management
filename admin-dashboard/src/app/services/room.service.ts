import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface Room {
  id: string;
  room_number: string;
  building_id: string;
  building_name?: string;
  floor: number;
  type: string;
  monthly_rent: number;
  status: 'vacant' | 'occupied' | 'under_maintenance';
  current_tenant?: any;
}

@Injectable({
  providedIn: 'root'
})
export class RoomService {
  constructor(private api: ApiService) { }

  /**
   * Get rooms, optionally filtered by status.
   */
  getRooms(status?: string): Observable<Room[]> {
    const params = status ? { status } : undefined;
    return this.api.get<{ success: boolean; data: any[]; total: number }>('rooms', params)
      .pipe(map(response => (response.data || []).map(r => this.normalize(r))));
  }

  /**
   * Get only AVAILABLE (vacant) rooms — used for the Add Tenant dropdown.
   * Uses the populated endpoint so each room includes its building name.
   */
  getAvailableRooms(): Observable<Room[]> {
    return this.api.get<{ success: boolean; data: any[]; total: number }>(
      'rooms/populated',
      { status: 'vacant', limit: 200 }
    ).pipe(map(response => (response.data || []).map(r => this.normalize(r))));
  }

  /**
   * Server-side paginated + filtered room list.
   * (filtering/paging/search all happen in the database, not the browser)
   */
  getRoomsPaged(params: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Observable<{ rooms: Room[]; total: number }> {
    const query: any = {
      limit: params.limit ?? 50,
      offset: params.offset ?? 0
    };
    if (params.status && params.status !== 'all') {
      query.status = params.status;
    }
    if (params.search) {
      query.search = params.search;
    }

    return this.api.get<{ success: boolean; data: any[]; total: number }>('rooms/populated', query)
      .pipe(map(response => ({
        rooms: (response.data || []).map(r => this.normalize(r)),
        total: response.total || 0
      })));
  }

  /**
   * Count of actual room records in the database.
   */
  getRoomCount(): Observable<number> {
    return this.api.get<{ success: boolean; data: any[]; total: number }>('rooms', { limit: 1 })
      .pipe(map(response => response.total || 0));
  }

  /**
   * Get a single room by id.
   */
  getRoomById(id: string): Observable<Room> {
    return this.api.get<{ success: boolean; data: any }>(`rooms/${id}`)
      .pipe(map(response => this.normalize(response.data)));
  }

  /**
   * Download the CSV import template (text).
   */
  getCsvTemplate(): Observable<string> {
    return this.api.getText('rooms/csv/template');
  }

  /**
   * Bulk import/update rooms from CSV text.
   */
  importCsv(csv: string): Observable<{ success: boolean; message?: string; data?: any; error?: string }> {
    return this.api.post<{ success: boolean; message?: string; data?: any; error?: string }>(
      'rooms/csv/import',
      { csv }
    );
  }

  /**
   * Normalize the raw API room (Appwrite-style `$id`) to a frontend Room.
   */
  private normalize(room: any): Room {
    return {
      id: room.$id || room.id,
      room_number: room.room_number,
      building_id: room.building_id,
      building_name: room.building_name || '',
      floor: room.floor,
      type: room.type,
      monthly_rent: room.monthly_rent,
      status: room.status,
      current_tenant: room.current_tenant || null
    };
  }
}
