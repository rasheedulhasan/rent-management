import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AppwriteConfigService {
  // Appwrite configuration - these should match your backend configuration
  private readonly endpoint = 'https://cloud.appwrite.io/v1';
  private readonly projectId = 'rent_collection_db';
  private readonly databaseId = 'rent_collection_db';
  
  // Collection IDs
  readonly collections = {
    buildings: 'buildings',
    rooms: 'rooms',
    tenants: 'tenants',
    users: 'users',
    rentTransactions: 'rent_transactions'
  };

  constructor() { }

  getEndpoint(): string {
    return this.endpoint;
  }

  getProjectId(): string {
    return this.projectId;
  }

  getDatabaseId(): string {
    return this.databaseId;
  }
}