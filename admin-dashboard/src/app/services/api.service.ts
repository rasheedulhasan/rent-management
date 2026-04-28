import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly apiUrl = 'http://localhost:3001/api'; // Backend API URL

  constructor(private http: HttpClient) { }

  // Generic GET request
  get<T>(endpoint: string, params?: any): Observable<T> {
    const options = {
      params: this.createParams(params)
    };
    return this.http.get<T>(`${this.apiUrl}/${endpoint}`, options)
      .pipe(catchError(this.handleError));
  }

  // Generic POST request
  post<T>(endpoint: string, data: any): Observable<T> {
    return this.http.post<T>(`${this.apiUrl}/${endpoint}`, data)
      .pipe(catchError(this.handleError));
  }

  // Generic PUT request
  put<T>(endpoint: string, data: any): Observable<T> {
    return this.http.put<T>(`${this.apiUrl}/${endpoint}`, data)
      .pipe(catchError(this.handleError));
  }

  // Generic DELETE request
  delete<T>(endpoint: string, id?: string): Observable<T> {
    const url = id ? `${this.apiUrl}/${endpoint}/${id}` : `${this.apiUrl}/${endpoint}`;
    return this.http.delete<T>(url)
      .pipe(catchError(this.handleError));
  }

  // Create HTTP params from object
  private createParams(params: any): HttpParams {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key].toString());
        }
      });
    }
    return httpParams;
  }

  // Error handling
  private handleError(error: any) {
    console.error('API Error:', error);
    let errorMessage = 'An error occurred';
    
    // Check if ErrorEvent is available (browser environment)
    if (typeof ErrorEvent !== 'undefined' && error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else {
      // Server-side error or network error
      errorMessage = error.error?.message || error.statusText || 'Server error';
    }
    
    return throwError(() => new Error(errorMessage));
  }
}