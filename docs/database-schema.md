# Database Schema Documentation

## Overview
This document describes the database schema for the Rent Collection System using Appwrite.

## Database Structure
- **Database Name**: Rent Collection Database
- **Database ID**: `rent_collection_db`

## Collections

### 1. Buildings (`buildings`)
Stores building information.

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string(255) | Yes | Building name |
| `address` | string(500) | Yes | Full address |
| `total_floors` | integer | Yes | Number of floors |
| `total_rooms` | integer | Yes | Total rooms in building |
| `description` | string(1000) | No | Additional details |
| `status` | string(50) | Yes | `active`/`inactive` |

**Indexes**:
- `idx_buildings_status` on `status`

### 2. Rooms (`rooms`)
Stores room/partition information.

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `building_id` | string(36) | Yes | Reference to building |
| `room_number` | string(50) | Yes | Room/partition number |
| `floor` | integer | Yes | Floor number |
| `type` | string(50) | Yes | `apartment`/`studio`/`shop` etc. |
| `monthly_rent` | double | Yes | Monthly rent amount |
| `size` | string(50) | No | Room size (sq ft) |
| `amenities` | string(500) | No | Comma-separated amenities |
| `status` | string(50) | Yes | `vacant`/`occupied`/`under_maintenance` |

**Indexes**:
- `idx_rooms_building` on `building_id`
- `idx_rooms_status` on `status`

### 3. Tenants (`tenants`)
Stores tenant/customer information.

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `room_id` | string(36) | Yes | Reference to room |
| `full_name` | string(255) | Yes | Tenant full name |
| `phone_number` | string(20) | Yes | Contact phone |
| `email` | string(255) | No | Email address |
| `id_number` | string(50) | No | ID/Passport number |
| `emergency_contact` | string(255) | No | Emergency contact |
| `check_in_date` | datetime | Yes | Move-in date |
| `check_out_date` | datetime | No | Move-out date |
| `monthly_rent` | double | Yes | Agreed monthly rent |
| `security_deposit` | double | No | Deposit amount |
| `status` | string(50) | Yes | `active`/`inactive`/`moved_out` |
| `notes` | string(1000) | No | Additional notes |

**Indexes**:
- `idx_tenants_room` on `room_id`
- `idx_tenants_status` on `status`
- `idx_tenants_phone` on `phone_number`

### 4. Users (`users`)
Stores staff/collector information.

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | string(100) | Yes | Username for login |
| `full_name` | string(255) | Yes | Full name |
| `email` | string(255) | Yes | Email address |
| `phone` | string(20) | No | Phone number |
| `role` | string(50) | Yes | `admin`/`collector`/`manager` |
| `status` | string(50) | Yes | `active`/`inactive` |
| `permissions` | string(500) | No | JSON string of permissions |

**Indexes**:
- `idx_users_email` on `email`
- `idx_users_role` on `role`

### 5. Rent Transactions (`rent_transactions`)
Stores rent payment transactions.

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `tenant_id` | string(36) | Yes | Reference to tenant |
| `room_id` | string(36) | Yes | Reference to room |
| `collected_by` | string(36) | Yes | Reference to user who collected |
| `amount` | double | Yes | Amount paid |
| `monthly_rent` | double | Yes | Full monthly rent amount |
| `payment_method` | string(50) | Yes | `cash`/`online`/`bank_transfer` |
| `payment_status` | string(50) | Yes | `paid`/`pending`/`partial` |
| `transaction_date` | datetime | Yes | Date of transaction |
| `rent_due_date` | datetime | Yes | Due date for rent |
| `period_month` | integer | Yes | Month (1-12) |
| `period_year` | integer | Yes | Year (e.g., 2024) |
| `partial_payment_reason` | string(500) | No | Reason for partial payment |
| `pending_reason` | string(500) | No | Reason for pending payment |
| `remarks` | string(1000) | No | Additional remarks |
| `receipt_number` | string(100) | No | Receipt number |

**Indexes**:
- `idx_transactions_tenant` on `tenant_id`
- `idx_transactions_status` on `payment_status`
- `idx_transactions_period` on `period_year, period_month`
- `idx_transactions_date` on `transaction_date`

## Relationships

1. **Tenant → Room**: One tenant belongs to one room (room_id)
2. **Room → Building**: One room belongs to one building (building_id)
3. **Rent Transaction → Tenant**: One transaction belongs to one tenant (tenant_id)
4. **Rent Transaction → User**: Collected by a user (collected_by)

## Enum Values

### Payment Status
- `paid`: Full payment received
- `pending`: No payment received
- `partial`: Partial payment received

### Payment Method
- `cash`: Cash payment
- `online`: Online payment
- `bank_transfer`: Bank transfer

### Room Status
- `vacant`: Available for rent
- `occupied`: Currently occupied
- `under_maintenance`: Not available

### Tenant Status
- `active`: Currently residing
- `inactive`: Not active
- `moved_out`: Has moved out

### User Role
- `admin`: Full system access
- `collector`: Can collect payments
- `manager`: Can manage buildings and rooms

## Data Flow
1. Create building → Create rooms → Assign tenants → Record transactions
2. Each transaction links to tenant, room, and collector
3. Dashboard stats aggregate from transactions and tenant status