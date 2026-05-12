# Rent Management System - Complete API Reference

> **Base URL:** `http://localhost:3001/api` (Development) / `https://monkfish-app-a3cq3.ondigitalocean.app/api` (Production)

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Buildings](#2-buildings)
3. [Rooms](#3-rooms)
4. [Tenants](#4-tenants)
5. [Transactions (Rent Collections)](#5-transactions-rent-collections)
6. [Users](#6-users)
7. [Dashboard](#7-dashboard)
8. [Health Check](#8-health-check)
9. [Common Response Format](#9-common-response-format)
10. [Database Schema - Field Reference](#10-database-schema---field-reference)

---

## 1. Authentication

### POST `/api/users/validate`
Validate user credentials and login.

**Request Body:**
```json
{
  "username": "string (required)",
  "password": "string (required)"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": { "...userObject" },
    "token": "jwt-token-placeholder"
  },
  "message": "Login successful"
}
```

**Error Response (401):**
```json
{ "success": false, "error": "Invalid credentials" }
```

**Mobile App Usage:**
- [`LoginScreen.js`](mobile-app/src/components/LoginScreen.js) -> [`AuthService.login()`](mobile-app/src/services/authService.js) -> [`authApi.login()`](mobile-app/src/services/api.js:68) -> `POST /api/users/validate`
- Token stored in AsyncStorage with 24hr expiry
- Also calls `POST /api/users/logout` on logout
- Calls `GET /api/users/profile` to fetch profile (referenced in api.js but not implemented in backend routes)

---

## 2. Buildings

### GET `/api/buildings`
List all buildings with optional filters.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | No | Filter: `active` / `inactive` |
| `limit` | number | No | Results per page (default: 25) |
| `offset` | number | No | Pagination offset (default: 0) |

**Success Response (200):**
```json
{
  "success": true,
  "data": [ "...buildingObjects" ],
  "total": 25
}
```

### GET `/api/buildings/:id`
Get a single building by ID.

**Path Parameters:** `id` (string, required)

**Success Response (200):** `{ "success": true, "data": { ...buildingObject } }`

**Error Response (404):** `{ "success": false, "error": "Building not found" }`

### POST `/api/buildings`
Create a new building.

**Request Body:**
```json
{
  "name": "string (required)",
  "address": "string (required)",
  "total_floors": "number (required)",
  "total_rooms": "number (required)",
  "description": "string (optional)",
  "status": "string (required) - 'active' / 'inactive'"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": { "...buildingObject" },
  "message": "Building created successfully"
}
```

### PUT `/api/buildings/:id`
Update an existing building. `id` (string, required). Body: partial building fields.

**Success Response (200):**
```json
{
  "success": true,
  "data": { "...updatedBuildingObject" },
  "message": "Building updated successfully"
}
```

### DELETE `/api/buildings/:id`
Delete a building. `id` (string, required).

**Success Response (200):** `{ "success": true, "message": "Building deleted successfully" }`

### GET `/api/buildings/:id/stats`
Get building with statistics (rooms count, occupancy, etc.). `id` (string, required).

**Success Response (200):** `{ "success": true, "data": { ...buildingWithStats } }`

### GET `/api/buildings/search/:query`
Search buildings by name. `query` (string, required).

**Success Response (200):**
```json
{
  "success": true,
  "data": [ "...matchingBuildings" ],
  "total": 5
}
```

---

## 3. Rooms

### GET `/api/rooms`
List all rooms with optional filters.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `building_id` | string | No | Filter by building |
| `status` | string | No | `vacant` / `occupied` / `under_maintenance` |
| `floor` | number | No | Filter by floor number |
| `limit` | number | No | Default: 25 |
| `offset` | number | No | Default: 0 |

**Success Response (200):**
```json
{
  "success": true,
  "data": [ "...roomObjects" ],
  "total": 25
}
```

### GET `/api/rooms/:id`
Get a single room by ID. `id` (string, required).

**Success Response (200):** `{ "success": true, "data": { ...roomObject } }`

### POST `/api/rooms`
Create a new room.

**Request Body:**
```json
{
  "building_id": "string (required)",
  "room_number": "string (required)",
  "floor": "number (required)",
  "type": "string (required) - 'apartment' / 'studio' / 'shop' etc.",
  "monthly_rent": "number (required)",
  "size": "string (optional) - e.g. '500 sq ft'",
  "amenities": "string (optional) - comma-separated",
  "status": "string (required) - 'vacant' / 'occupied' / 'under_maintenance'"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": { "...roomObject" },
  "message": "Room created successfully"
}
```

### PUT `/api/rooms/:id`
Update a room. `id` (string, required). Body: partial room fields.

### DELETE `/api/rooms/:id`
Delete a room. `id` (string, required).

### GET `/api/rooms/building/:buildingId`
Get all rooms in a specific building.

**Path Parameters:** `buildingId` (string, required)

**Query Parameters:** `status` (string, optional)

**Success Response (200):**
```json
{
  "success": true,
  "data": [ "...roomObjects" ],
  "total": 10
}
```

### PATCH `/api/rooms/:id/status`
Update room status only. `id` (string, required).

**Request Body:**
```json
{ "status": "string (required) - 'vacant' / 'occupied' / 'under_maintenance'" }
```

### GET `/api/rooms/:id/with-tenant`
Get room details including current tenant info. `id` (string, required).

**Success Response (200):** `{ "success": true, "data": { ...roomWithTenantObject } }`

### GET `/api/rooms/search/filter`
Search/filter rooms by multiple criteria.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `building_id` | string | No | |
| `floor` | number | No | |
| `min_rent` | number | No | |
| `max_rent` | number | No | |

---

## 4. Tenants

### GET `/api/tenants`
List all tenants with optional filters.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | No | `active` / `inactive` / `moved_out` |
| `room_id` | string | No | Filter by room |
| `limit` | number | No | Default: 25 |
| `offset` | number | No | Default: 0 |

**Success Response (200):**
```json
{
  "success": true,
  "data": [ "...tenantObjects" ],
  "total": 25
}
```

### GET `/api/tenants/:id`
Get a single tenant by ID. `id` (string, required).

### POST `/api/tenants`
Create a new tenant.

**Request Body:**
```json
{
  "room_id": "string (required)",
  "full_name": "string (required)",
  "phone_number": "string (required)",
  "email": "string (optional)",
  "id_number": "string (optional)",
  "emergency_contact": "string (optional)",
  "check_in_date": "datetime (required)",
  "check_out_date": "datetime (optional)",
  "monthly_rent": "number (required)",
  "security_deposit": "number (optional)",
  "status": "string (required) - 'active' / 'inactive' / 'moved_out'",
  "notes": "string (optional)"
}
```

### PUT `/api/tenants/:id`
Update a tenant. `id` (string, required). Body: partial tenant fields.

### DELETE `/api/tenants/:id`
Delete a tenant. `id` (string, required).

### GET `/api/tenants/room/:roomId`
Get tenants assigned to a specific room. `roomId` (string, required).

**Query Parameters:** `status` (string, optional)

### PATCH `/api/tenants/:id/status`
Update tenant status only. `id` (string, required).

**Request Body:**
```json
{ "status": "string (required) - 'active' / 'inactive' / 'moved_out'" }
```

### GET `/api/tenants/:id/with-transactions`
Get tenant details including their transaction history. `id` (string, required).

### GET `/api/tenants/search/:query`
Search tenants by name, phone, email, etc. `query` (string, required).

### GET `/api/tenants/stats/active-count`
Get count of active tenants.

**Success Response (200):**
```json
{ "success": true, "data": { "active_tenants": 42 } }
```

**Mobile App Usage:**
- [`CollectionForm.js`](mobile-app/src/components/CollectionForm.js) -> [`rentCollectionsApi.getTenants()`](mobile-app/src/services/api.js:132) -> `GET /api/tenants`
- [`syncService.js`](mobile-app/src/services/syncService.js) -> `syncTenants()` -> `GET /api/tenants`
- Tenants cached locally via offlineStore for offline access

---

## 5. Transactions (Rent Collections)

### GET `/api/transactions`
List all transactions with optional filters. Ordered by `transaction_date` DESC.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | No | Payment status: `paid` / `pending` / `partial` |
| `tenant_id` | string | No | |
| `room_id` | string | No | |
| `collected_by` | string | No | User ID of collector |
| `period_year` | number | No | |
| `period_month` | number | No | 1-12 |
| `limit` | number | No | Default: 25 |
| `offset` | number | No | Default: 0 |

### GET `/api/transactions/:id`
Get a single transaction by ID. `id` (string, required).

### POST `/api/transactions`
Create a new rent transaction (collection).

**Request Body:**
```json
{
  "tenant_id": "string (required)",
  "room_id": "string (required)",
  "collected_by": "string (required) - User ID",
  "amount": "number (required)",
  "monthly_rent": "number (required)",
  "payment_method": "string (required) - 'cash' / 'online' / 'bank_transfer'",
  "payment_status": "string (required) - 'paid' / 'pending' / 'partial'",
  "transaction_date": "datetime (required)",
  "rent_due_date": "datetime (required)",
  "period_month": "number (required) - 1-12",
  "period_year": "number (required) - e.g. 2024",
  "partial_payment_reason": "string (optional)",
  "pending_reason": "string (optional)",
  "remarks": "string (optional)",
  "receipt_number": "string (optional)"
}
```

**Mobile App Data Transformation** ([`api.js:104`](mobile-app/src/services/api.js:104)):
```javascript
// rentCollectionsApi.submitCollection() transforms:
{
  tenant_id: collectionData.tenantId,
  room_id: selectedTenant.room_id || selectedTenant.roomId,
  collected_by: collectionData.collectedBy,
  amount: collectionData.amount,
  payment_method: collectionData.paymentMode,
  payment_status: 'paid',
  monthly_rent: selectedTenant.monthly_rent || selectedTenant.monthlyRent,
  rent_due_date: new Date().toISOString().split('T')[0],
  remarks: collectionData.notes || '',
  transaction_date: collectionData.collectedAt || new Date().toISOString()
}
```

### PUT `/api/transactions/:id`
Update a transaction. `id` (string, required). Body: partial transaction fields.

### DELETE `/api/transactions/:id`
Delete a transaction. `id` (string, required).

### PATCH `/api/transactions/:id/status`
Update payment status only. `id` (string, required).

**Request Body:**
```json
{
  "status": "string (required) - 'paid' / 'pending' / 'partial'",
  "reason": "string (optional)"
}
```

### GET `/api/transactions/tenant/:tenantId`
Get all transactions for a specific tenant. `tenantId` (string, required).

**Query Parameters:** `status` (string, optional)

### GET `/api/transactions/room/:roomId`
Get all transactions for a specific room. `roomId` (string, required).

**Query Parameters:** `status` (string, optional)

### GET `/api/transactions/collector/:userId`
Get all transactions collected by a specific user. `userId` (string, required).

**Query Parameters:** `status` (string, optional)

### GET `/api/transactions/period/:year/:month`
Get all transactions for a specific period.

**Path Parameters:** `year` (number, required), `month` (number, required, 1-12)

**Query Parameters:** `status` (string, optional)

### GET `/api/transactions/search/:field/:query`
Search transactions by a specific field.

**Path Parameters:** `field` (string, required), `query` (string, required)

### GET `/api/transactions/revenue/monthly/:year`
Get monthly revenue breakdown for a year. `year` (number, required).

---

## 6. Users

### GET `/api/users`
List all users with optional filters.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `role` | string | No | `admin` / `collector` / `manager` |
| `status` | string | No | `active` / `inactive` |
| `limit` | number | No | Default: 25 |
| `offset` | number | No | Default: 0 |

### GET `/api/users/:id`
Get a single user by ID. `id` (string, required).

### POST `/api/users`
Create a new user.

**Request Body:**
```json
{
  "username": "string (required)",
  "full_name": "string (required)",
  "email": "string (required)",
  "phone": "string (optional)",
  "role": "string (required) - 'admin' / 'collector' / 'manager'",
  "status": "string (required) - 'active' / 'inactive'",
  "permissions": "string (optional) - JSON string"
}
```

### PUT `/api/users/:id`
Update a user. `id` (string, required). Body: partial user fields.

### DELETE `/api/users/:id`
Delete a user. `id` (string, required).

### GET `/api/users/username/:username`
Get user by username. `username` (string, required).

### GET `/api/users/email/:email`
Get user by email. `email` (string, required).

### PATCH `/api/users/:id/status`
Update user status only. `id` (string, required).

**Request Body:** `{ "status": "string (required) - 'active' / 'inactive'" }`

### GET `/api/users/role/collectors`
Get all users with role `collector`.

### GET `/api/users/role/admins`
Get all users with role `admin`.

### GET `/api/users/search/:query`
Search users by name, username, email, etc. `query` (string, required).

---

## 7. Dashboard

### GET `/api/dashboard/stats`
Get overall dashboard statistics.

**Query Parameters:** `start_date` (string, optional), `end_date` (string, optional)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "financial": { "...transactionStats" },
    "properties": {
      "total_buildings": 5,
      "total_rooms": 50,
      "vacant_rooms": 10,
      "occupied_rooms": 40,
      "occupancy_rate": "80.00"
    },
    "tenants": { "active_tenants": 38 },
    "staff": { "total_collectors": 6 }
  }
}
```

### GET `/api/dashboard/financial`
Get financial overview for a year.

**Query Parameters:** `year` (number, optional, defaults to current year)

### GET `/api/dashboard/properties`
Get property overview (buildings, rooms, status distribution).

### GET `/api/dashboard/tenants`
Get tenant overview with status counts and recent tenants (last 30 days, top 10).

### GET `/api/dashboard/collection-performance`
Get collection performance by collector for a period.

**Query Parameters:** `year` (number, optional), `month` (number, optional, 1-12)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "period": { "year": 2024, "month": 5 },
    "collector_performance": [
      {
        "collector_id": "string",
        "collector_name": "string",
        "total_amount": 15000,
        "transaction_count": 20,
        "paid_count": 18,
        "success_rate": "90.00"
      }
    ],
    "total_collectors": 6
  }
}
```

---

## 8. Health Check

### GET `/health`
Server health check endpoint.

**Success Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2026-05-11T12:00:00.000Z",
  "service": "Rent Collection System API"
}
```

---

## 9. Common Response Format

All API responses follow a consistent format:

**Success:**
```json
{
  "success": true,
  "data": { ... } or [ ... ],
  "total": 25,
  "message": "Action completed successfully"
}
```

**Error:**
```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

**HTTP Status Codes Used:**
| Code | Description |
|------|-------------|
| 200 | Success (GET, PUT, PATCH, DELETE) |
| 201 | Created (POST) |
| 400 | Bad Request (validation / business logic error) |
| 401 | Unauthorized (invalid credentials) |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## 10. Database Schema - Field Reference

### `buildings` Collection
| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `$id` | string | auto | Appwrite document ID |
| `name` | string(255) | Yes | Building name |
| `address` | string(500) | Yes | Full address |
| `total_floors` | integer | Yes | Number of floors |
| `total_rooms` | integer | Yes | Total rooms |
| `description` | string(1000) | No | Additional details |
| `status` | string(50) | Yes | `active` / `inactive` |

### `rooms` Collection
| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `$id` | string | auto | Appwrite document ID |
| `building_id` | string(36) | Yes | Reference to `buildings.$id` |
| `room_number` | string(50) | Yes | Room/partition number |
| `floor` | integer | Yes | Floor number |
| `type` | string(50) | Yes | `apartment` / `studio` / `shop` etc. |
| `monthly_rent` | double | Yes | Monthly rent amount |
| `size` | string(50) | No | Room size (sq ft) |
| `amenities` | string(500) | No | Comma-separated amenities |
| `status` | string(50) | Yes | `vacant` / `occupied` / `under_maintenance` |

### `tenants` Collection
| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `$id` | string | auto | Appwrite document ID |
| `room_id` | string(36) | Yes | Reference to `rooms.$id` |
| `full_name` | string(255) | Yes | Tenant full name |
| `phone_number` | string(20) | Yes | Contact phone |
| `email` | string(255) | No | Email address |
| `id_number` | string(50) | No | ID/Passport number |
| `emergency_contact` | string(255) | No | Emergency contact |
| `check_in_date` | datetime | Yes | Move-in date |
| `check_out_date` | datetime | No | Move-out date |
| `monthly_rent` | double | Yes | Agreed monthly rent |
| `security_deposit` | double | No | Deposit amount |
| `status` | string(50) | Yes | `active` / `inactive` / `moved_out` |
| `notes` | string(1000) | No | Additional notes |

### `users` Collection
| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `$id` | string | auto | Appwrite document ID |
| `username` | string(100) | Yes | Login username |
| `full_name` | string(255) | Yes | Full name |
| `email` | string(255) | Yes | Email address |
| `phone` | string(20) | No | Phone number |
| `role` | string(50) | Yes | `admin` / `collector` / `manager` |
| `status` | string(50) | Yes | `active` / `inactive` |
| `permissions` | string(500) | No | JSON string of permissions |

### `rent_transactions` Collection
| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `$id` | string | auto | Appwrite document ID |
| `tenant_id` | string(36) | Yes | Reference to `tenants.$id` |
| `room_id` | string(36) | Yes | Reference to `rooms.$id` |
| `collected_by` | string(36) | Yes | Reference to `users.$id` |
| `amount` | double | Yes | Amount paid |
| `monthly_rent` | double | Yes | Full monthly rent amount |
| `payment_method` | string(50) | Yes | `cash` / `online` / `bank_transfer` |
| `payment_status` | string(50) | Yes | `paid` / `pending` / `partial` |
| `transaction_date` | datetime | Yes | Date of transaction |
| `rent_due_date` | datetime | Yes | Due date for rent |
| `period_month` | integer | Yes | Month (1-12) |
| `period_year` | integer | Yes | Year (e.g., 2024) |
| `partial_payment_reason` | string(500) | No | Reason for partial payment |
| `pending_reason` | string(500) | No | Reason for pending payment |
| `remarks` | string(1000) | No | Additional remarks |
| `receipt_number` | string(100) | No | Receipt number |

---

## API Endpoint Summary Table

| # | Method | Endpoint | Description |
|---|--------|----------|-------------|
| 1 | POST | `/api/users/validate` | Login |
| 2 | GET | `/api/buildings` | List buildings |
| 3 | GET | `/api/buildings/:id` | Get building |
| 4 | POST | `/api/buildings` | Create building |
| 5 | PUT | `/api/buildings/:id` | Update building |
| 6 | DELETE | `/api/buildings/:id` | Delete building |
| 7 | GET | `/api/buildings/:id/stats` | Building stats |
| 8 | GET | `/api/buildings/search/:query` | Search buildings |
| 9 | GET | `/api/rooms` | List rooms |
| 10 | GET | `/api/rooms/:id` | Get room |
| 11 | POST | `/api/rooms` | Create room |
| 12 | PUT | `/api/rooms/:id` | Update room |
| 13 | DELETE | `/api/rooms/:id` | Delete room |
| 14 | GET | `/api/rooms/building/:buildingId` | Rooms by building |
| 15 | PATCH | `/api/rooms/:id/status` | Update room status |
| 16 | GET | `/api/rooms/:id/with-tenant` | Room with tenant |
| 17 | GET | `/api/rooms/search/filter` | Search rooms |
| 18 | GET | `/api/tenants` | List tenants |
| 19 | GET | `/api/tenants/:id` | Get tenant |
| 20 | POST | `/api/tenants` | Create tenant |
| 21 | PUT | `/api/tenants/:id` | Update tenant |
| 22 | DELETE | `/api/tenants/:id` | Delete tenant |
| 23 | GET | `/api/tenants/room/:roomId` | Tenants by room |
| 24 | PATCH | `/api/tenants/:id/status` | Update tenant status |
| 25 | GET | `/api/tenants/:id/with-transactions` | Tenant with transactions |
| 26 | GET | `/api/tenants/search/:query` | Search tenants |
| 27 | GET | `/api/tenants/stats/active-count` | Active tenant count |
| 28 | GET | `/api/transactions` | List transactions |
| 29 | GET | `/api/transactions/:id` | Get transaction |
| 30 | POST | `/api/transactions` | Create transaction |
| 31 | PUT | `/api/transactions/:id` | Update transaction |
| 32 | DELETE | `/api/transactions/:id` | Delete transaction |
| 33 | PATCH | `/api/transactions/:id/status` | Update payment status |
| 34 | GET | `/api/transactions/tenant/:tenantId` | Transactions by tenant |
| 35 | GET | `/api/transactions/room/:roomId` | Transactions by room |
| 36 | GET | `/api/transactions/collector/:userId` | Transactions by collector |
| 37 | GET | `/api/transactions/period/:year/:month` | Transactions by period |
| 38 | GET | `/api/transactions/search/:field/:query` | Search transactions |
| 39 | GET | `/api/transactions/revenue/monthly/:year` | Monthly revenue |
| 40 | GET | `/api/users` | List users |
| 41 | GET | `/api/users/:id` | Get user |
| 42 | POST | `/api/users` | Create user |
| 43 | PUT | `/api/users/:id` | Update user |
| 44 | DELETE | `/api/users/:id` | Delete user |
| 45 | GET | `/api/users/username/:username` | User by username |
| 46 | GET | `/api/users/email/:email` | User by email |
| 47 | PATCH | `/api/users/:id/status` | Update user status |
| 48 | GET | `/api/users/role/collectors` | List collectors |
| 49 | GET | `/api/users/role/admins` | List admins |
| 50 | GET | `/api/users/search/:query` | Search users |
| 51 | GET | `/api/dashboard/stats` | Dashboard stats |
| 52 | GET | `/api/dashboard/financial` | Financial overview |
| 53 | GET | `/api/dashboard/properties` | Property overview |
| 54 | GET | `/api/dashboard/tenants` | Tenant overview |
| 55 | GET | `/api/dashboard/collection-performance` | Collection performance |
| 56 | GET | `/health` | Health check |

---

## Relationships Diagram

```
Buildings ──has many──> Rooms ──has one──> Tenants ──has many──> Transactions
                                                                    │
                                                                    └── collected_by ──> Users
```

---

*Generated from source code analysis of [`src/routes/`](src/routes/) and [`mobile-app/src/services/`](mobile-app/src/services/)*
