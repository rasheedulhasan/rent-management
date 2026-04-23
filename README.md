# Rent Collection System - Backend

A complete rent collection system built with Node.js, Express, and Appwrite for database management.

## Features

- **Complete Database Schema**: Buildings, Rooms, Tenants, Users, and Rent Transactions
- **RESTful API**: Full CRUD operations for all entities
- **Dashboard Analytics**: Financial stats, property overview, tenant management
- **Validation**: Comprehensive input validation and sanitization
- **Relationships**: Proper relationships between entities (tenant → room → building, etc.)
- **Search & Filtering**: Advanced search capabilities across all collections

## Database Schema

### Collections

1. **buildings** - Building information
2. **rooms** - Room/partition details with building reference
3. **tenants** - Tenant/customer information with room reference
4. **users** - Staff/collector information
5. **rent_transactions** - Rent payment transactions with references to tenant and collector

### Relationships
- Tenant → Room (room_id)
- Room → Building (building_id)
- Rent Transaction → Tenant (tenant_id)
- Rent Transaction → User (collected_by)

## Setup Instructions

### 1. Prerequisites
- Node.js (v14 or higher)
- Appwrite account and project
- Appwrite API key with appropriate permissions

### 2. Installation

```bash
# Clone the repository
git clone <repository-url>
cd rent-management

# Install dependencies
npm install
```

### 3. Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your Appwrite credentials:
   ```
   APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
   APPWRITE_PROJECT_ID=your_project_id_here
   APPWRITE_API_KEY=your_api_key_here
   ```

### 4. Database Setup

Run the database setup script to create collections and attributes:

```bash
npm run setup-db
```

### 5. Start the Server

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3000`

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Buildings
- `GET /api/buildings` - List all buildings
- `GET /api/buildings/:id` - Get building by ID
- `POST /api/buildings` - Create new building
- `PUT /api/buildings/:id` - Update building
- `DELETE /api/buildings/:id` - Delete building

### Rooms
- `GET /api/rooms` - List all rooms
- `GET /api/rooms/building/:buildingId` - Get rooms by building
- `POST /api/rooms` - Create new room
- `PATCH /api/rooms/:id/status` - Update room status

### Tenants
- `GET /api/tenants` - List all tenants
- `GET /api/tenants/room/:roomId` - Get tenants by room
- `POST /api/tenants` - Create new tenant
- `PATCH /api/tenants/:id/status` - Update tenant status

### Users
- `GET /api/users` - List all users
- `GET /api/users/role/collectors` - Get all collectors
- `POST /api/users` - Create new user
- `POST /api/users/validate` - Validate user credentials

### Transactions
- `GET /api/transactions` - List all transactions
- `GET /api/transactions/tenant/:tenantId` - Get transactions by tenant
- `POST /api/transactions` - Create new transaction
- `PATCH /api/transactions/:id/status` - Update payment status

### Dashboard
- `GET /api/dashboard/stats` - Overall dashboard statistics
- `GET /api/dashboard/financial` - Financial overview
- `GET /api/dashboard/properties` - Property overview
- `GET /api/dashboard/tenants` - Tenant overview
- `GET /api/dashboard/collection-performance` - Collection performance

## Data Models

### Building
```json
{
  "name": "Building A",
  "address": "123 Main St",
  "total_floors": 5,
  "total_rooms": 20,
  "description": "Commercial building",
  "status": "active"
}
```

### Room
```json
{
  "building_id": "building_id_here",
  "room_number": "101",
  "floor": 1,
  "type": "apartment",
  "monthly_rent": 1500,
  "size": "800 sq ft",
  "amenities": "AC, WiFi, Parking",
  "status": "vacant"
}
```

### Tenant
```json
{
  "room_id": "room_id_here",
  "full_name": "John Doe",
  "phone_number": "+1234567890",
  "email": "john@example.com",
  "check_in_date": "2024-01-01",
  "monthly_rent": 1500,
  "status": "active"
}
```

### Rent Transaction
```json
{
  "tenant_id": "tenant_id_here",
  "room_id": "room_id_here",
  "collected_by": "user_id_here",
  "amount": 1500,
  "monthly_rent": 1500,
  "payment_method": "cash",
  "payment_status": "paid",
  "rent_due_date": "2024-01-31",
  "period_month": 1,
  "period_year": 2024
}
```

## Validation

The system includes comprehensive validation for:
- Required fields
- Data types (string, number, date)
- Enum values (status, payment method, etc.)
- Date ranges
- Phone numbers and emails
- Input sanitization to prevent XSS

## Error Handling

All API endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message here",
  "details": ["Additional error details"] // Optional
}
```

## Testing

Run tests with:
```bash
npm test
```

## Project Structure

```
rent-management/
├── src/
│   ├── config/          # Appwrite configuration
│   ├── middleware/      # Validation middleware
│   ├── models/          # Data models (if needed)
│   ├── routes/          # Express routes
│   ├── services/        # Business logic services
│   ├── utils/           # Utility functions
│   └── index.js         # Main server file
├── scripts/
│   └── setup-database.js # Database setup script
├── docs/
│   └── database-schema.md # Schema documentation
├── .env.example         # Environment variables template
├── package.json         # Dependencies and scripts
└── README.md           # This file
```

## Deployment

1. Set environment variables in production
2. Run `npm run setup-db` to initialize database
3. Start server with `npm start` or using PM2:
   ```bash
   pm2 start src/index.js --name rent-collection
   ```

## License

MIT"# rent-management" 
