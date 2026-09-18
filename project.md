# TransitOps — Smart Transport Operations Platform
### Final Project Specification (v2 — Local Dev, PostgreSQL + pgAdmin)

> This is the authoritative build spec. Feed sections to your AI coding assistant in order (Schema → Service Layer → API → Frontend). Every business rule listed here MUST be enforced in the service layer, not just the UI.

---

## 1. One-liner

A centralized web platform that replaces spreadsheets/logbooks for logistics companies — managing vehicles, drivers, trip dispatch, maintenance, fuel/expenses, and analytics, with role-based access and automatic status enforcement.

---

## 2. Tech Stack (Local Development)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React + Vite + TypeScript + Tailwind CSS | Component-driven, fast HMR for iterative dev |
| UI Components | shadcn/ui | Tables, forms, dialogs, badges out of the box |
| Charts | Recharts | Dashboard KPIs + report visualizations |
| Backend | Node.js + Express + TypeScript | Layered architecture (Controller → Service → Repository) |
| ORM | Prisma | Type-safe schema, migrations, works directly against local Postgres |
| Database | **PostgreSQL (local instance)**, managed/inspected via **pgAdmin** | Run Postgres locally (native install or Docker); use pgAdmin as the GUI to view tables, run queries, inspect data during dev |
| Auth | JWT (access token) + bcrypt password hashing | Stored in httpOnly cookie or Authorization header |
| Validation | Zod (shared schema validation on backend, optionally reused on frontend) | Centralizes input validation before it hits services |
| Dev tooling | Prisma Studio (optional, alongside pgAdmin) for quick data peeks | pgAdmin remains primary DB GUI per your preference |

### Local setup outline
1. Install PostgreSQL locally (or run via Docker: `postgres:16`).
2. Open pgAdmin → create a new database, e.g. `transitops_db`.
3. Set `DATABASE_URL="postgresql://<user>:<password>@localhost:5432/transitops_db"` in backend `.env`.
4. `npx prisma migrate dev --name init` — this creates all tables; verify them by refreshing the database tree in pgAdmin.
5. Seed data via a `prisma/seed.ts` script (`npx prisma db seed`).

---

## 3. Architecture

```
Request → Controller (thin, HTTP-only) → Service (all business rules) → Repository/Model → PostgreSQL
```

- **Controllers**: parse request, call Zod validation, call the relevant service, return HTTP response. No business logic here.
- **Services**: `VehicleService`, `DriverService`, `TripService`, `MaintenanceService`, `FuelService`, `ExpenseService`, `DashboardService`, `ReportService`. All business rules and state transitions live here.
- **Repositories**: thin wrappers around Prisma calls (can be skipped in favor of calling `prisma.*` directly inside services for a hackathon-scale app, but keep the *pattern* separated conceptually so it's swappable later).
- **No duplicate logic**: e.g., "is this vehicle eligible for dispatch" must be a single function reused by both the Trip creation and Trip dispatch flows.

---

## 4. User Roles & Permissions (RBAC)

| Role | Vehicles | Drivers | Trips | Maintenance | Fuel/Expenses | Reports |
|---|---|---|---|---|---|---|
| **Fleet Manager** | Full CRUD | View | Full | Full | View | View |
| **Driver** | View (available only) | View own profile | Create/Dispatch/Complete/Cancel | View | Log fuel | — |
| **Safety Officer** | View | Full CRUD (license, safety score, status) | View | View | — | View (safety-related) |
| **Financial Analyst** | View | View | View | View | Full CRUD | Full + CSV export |

- `role` stored as enum on `User`.
- Backend middleware: `requireRole(['FLEET_MANAGER'])` per route.
- Frontend hides/disables actions per role — **enforced server-side regardless**.

---

## 5. Database Schema (Prisma / PostgreSQL) — Final

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ---------- ENUMS ----------

enum Role {
  FLEET_MANAGER
  DRIVER
  SAFETY_OFFICER
  FINANCIAL_ANALYST
}

enum VehicleStatus {
  AVAILABLE
  ON_TRIP
  IN_SHOP
  RETIRED
}

enum DriverStatus {
  AVAILABLE
  ON_TRIP
  OFF_DUTY
  SUSPENDED
}

enum TripStatus {
  DRAFT
  DISPATCHED
  COMPLETED
  CANCELLED
}

enum ExpenseType {
  TOLL
  MAINTENANCE
  OTHER
}

// ---------- MODELS ----------

model User {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  passwordHash String
  role         Role
  driverId     String?  @unique      // optional link: DRIVER-role accounts to a Driver profile
  driver       Driver?  @relation(fields: [driverId], references: [id])
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Vehicle {
  id               String           @id @default(uuid())
  registrationNo   String           @unique
  name             String
  type             String
  region           String                       // NEW — required by dashboard filters
  maxLoadCapacity  Float                         // kg
  odometer         Float            @default(0)
  acquisitionCost  Float
  status           VehicleStatus    @default(AVAILABLE)
  isActive         Boolean          @default(true)   // NEW — soft delete instead of hard delete
  trips            Trip[]
  maintenanceLogs  MaintenanceLog[]
  fuelLogs         FuelLog[]
  expenses         Expense[]
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  @@index([status])
  @@index([region])
}

model Driver {
  id                String       @id @default(uuid())
  name              String
  licenseNumber     String       @unique
  licenseCategory   String
  licenseExpiryDate DateTime
  contactNumber     String
  email             String?                      // NEW — optional
  address           String?                      // NEW — optional
  safetyScore       Float        @default(100)
  status            DriverStatus @default(AVAILABLE)
  isActive          Boolean      @default(true)   // NEW — soft delete
  trips             Trip[]
  userAccount       User?
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  @@index([status])
  @@index([licenseExpiryDate])
}

model Trip {
  id              String     @id @default(uuid())
  tripNumber      String     @unique              // NEW — e.g. "TRP-00001", business-friendly ID
  source          String
  destination     String
  vehicleId       String
  vehicle         Vehicle    @relation(fields: [vehicleId], references: [id])
  driverId        String
  driver          Driver     @relation(fields: [driverId], references: [id])
  cargoWeight     Float
  plannedDistance Float
  actualDistance  Float?
  fuelConsumed    Float?
  revenue         Float      @default(0)          // NEW — required for ROI calc
  status          TripStatus @default(DRAFT)
  dispatchedAt    DateTime?
  completedAt     DateTime?
  cancelledAt     DateTime?
  fuelLogs        FuelLog[]
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  @@index([status])
  @@index([vehicleId])
  @@index([driverId])
}

model MaintenanceLog {
  id          String    @id @default(uuid())
  vehicleId   String
  vehicle     Vehicle   @relation(fields: [vehicleId], references: [id])
  description String    // e.g. "Oil Change"
  cost        Float
  isActive    Boolean   @default(true) // true = In Shop (open), false = closed
  openedAt    DateTime  @default(now())
  closedAt    DateTime?

  @@index([vehicleId])
  @@index([isActive])
}

model FuelLog {
  id        String   @id @default(uuid())
  vehicleId String
  vehicle   Vehicle  @relation(fields: [vehicleId], references: [id])
  tripId    String?                     // NEW — optional link to a specific trip
  trip      Trip?    @relation(fields: [tripId], references: [id])
  liters    Float
  cost      Float
  date      DateTime @default(now())

  @@index([vehicleId])
  @@index([tripId])
}

model Expense {
  id        String      @id @default(uuid())
  vehicleId String
  vehicle   Vehicle     @relation(fields: [vehicleId], references: [id])
  type      ExpenseType                 // CHANGED — was free-text string, now enum
  amount    Float
  date      DateTime    @default(now())
  notes     String?

  @@index([vehicleId])
  @@index([type])
}
```

### Schema notes
- All monetary/quantity fields (`cost`, `amount`, `liters`, `cargoWeight`, `revenue`, `acquisitionCost`) are validated `>= 0` (or `> 0` where noted) at the service layer via Zod — Postgres `CHECK` constraints can optionally reinforce this via a raw SQL migration if desired.
- `isActive` soft-delete pattern applies to `Vehicle`, `Driver`, and `User` — nothing is hard-deleted; retiring/suspending is a status change, and `isActive=false` hides a record from normal list views without destroying history (trips/logs stay intact).
- `tripNumber` should be generated server-side (e.g. zero-padded incrementing counter or `TRP-` + short UUID segment) at trip creation.

---

## 6. Mandatory Business Rules (Final, Merged List)

Enforce every rule below inside the relevant Service — never in controllers, never only on frontend.

**Vehicle rules**
1. `registrationNo` must be unique.
2. `RETIRED` or `IN_SHOP` vehicles never appear in the dispatch selection pool.
3. A vehicle cannot enter maintenance while `ON_TRIP` (must be `AVAILABLE` first).
4. `RETIRED` vehicles can never transition back to `AVAILABLE` (retirement is terminal).
5. Deactivating a vehicle uses `isActive=false`, never a hard delete.

**Driver rules**
6. Drivers with `licenseExpiryDate < today` cannot be assigned to a trip.
7. `SUSPENDED` drivers cannot be assigned to a trip.
8. `OFF_DUTY` drivers cannot be dispatched.
9. A driver already `ON_TRIP` cannot be assigned to another trip.

**Trip rules**
10. `cargoWeight` must be `> 0` and `≤ Vehicle.maxLoadCapacity`.
11. `source` and `destination` cannot be identical.
12. Dispatching (`DRAFT → DISPATCHED`) sets `Vehicle.status = ON_TRIP` and `Driver.status = ON_TRIP`.
13. Only `DISPATCHED` trips can be completed (`DISPATCHED → COMPLETED`).
14. Completing a trip sets `Vehicle.status = AVAILABLE` and `Driver.status = AVAILABLE`.
15. `CANCELLED` trips can never transition to `COMPLETED`.
16. Cancelling a `DISPATCHED` trip restores vehicle and driver to `AVAILABLE`.
17. A `DRAFT` trip can be cancelled directly (no status restoration needed since nothing was reserved).

**Maintenance rules**
18. Creating an active maintenance record (`isActive=true`) sets `Vehicle.status = IN_SHOP`.
19. Closing a maintenance log (`isActive: true → false`) restores `Vehicle.status = AVAILABLE`, **unless** the vehicle is `RETIRED`.
20. A vehicle cannot have two simultaneously open (`isActive=true`) maintenance logs.

**Fuel / Expense rules**
21. `FuelLog.liters`, `FuelLog.cost`, `Expense.amount`, `MaintenanceLog.cost` must all be `≥ 0` (reject negative values).
22. `Trip.revenue` must be `≥ 0`.

All of these should be implemented as small, named, reusable validation functions (e.g. `assertVehicleEligibleForDispatch()`, `assertDriverEligibleForDispatch()`) called from multiple services where needed — no copy-pasted checks.

---

## 7. Service Layer Responsibilities

| Service | Responsibilities |
|---|---|
| `AuthService` | login, password verification, JWT issuance |
| `VehicleService` | CRUD, retire, list-available-for-dispatch (filters `IN_SHOP`/`RETIRED`/`isActive=false`), region/type/status filtering |
| `DriverService` | CRUD, suspend, list-available-for-dispatch (filters expired license/suspended/off-duty/on-trip) |
| `TripService` | create (validate cargo weight, source≠destination, vehicle+driver eligibility), dispatch, complete, cancel — all status transitions wrapped in a DB transaction |
| `MaintenanceService` | open (blocks if vehicle ON_TRIP or already has open log), close (restores vehicle unless retired) |
| `FuelService` | log fuel, optionally link to trip |
| `ExpenseService` | log expense by `ExpenseType` |
| `DashboardService` | aggregate KPIs, recent trips, vehicles in maintenance, expiring licenses, today's expenses |
| `ReportService` | fuel efficiency, fleet utilization, operational cost, ROI, CSV export |

**Transactions**: `dispatch`, `complete`, `cancel` (Trip) and `open`/`close` (Maintenance) must each run inside `prisma.$transaction([...])` so the status update and the record write succeed or fail together.

---

## 8. API Routes (Final)

```
# Auth
POST   /api/auth/login
POST   /api/auth/register            (optional / seed-only)

# Vehicles
GET    /api/vehicles                 ?status=&type=&region=&search=
GET    /api/vehicles/:id
GET    /api/vehicles/available       (dispatch-eligible only)
POST   /api/vehicles
PATCH  /api/vehicles/:id
PATCH  /api/vehicles/:id/retire      (preferred over delete)

# Drivers
GET    /api/drivers                  ?status=&search=
GET    /api/drivers/:id
GET    /api/drivers/available        (dispatch-eligible only)
POST   /api/drivers
PATCH  /api/drivers/:id
PATCH  /api/drivers/:id/suspend

# Trips
GET    /api/trips                    ?status=&vehicleId=&driverId=
GET    /api/trips/:id
GET    /api/trips/active             (DISPATCHED trips)
POST   /api/trips                    (creates as DRAFT; validates cargo weight, src≠dest)
PATCH  /api/trips/:id/dispatch
PATCH  /api/trips/:id/complete
PATCH  /api/trips/:id/cancel

# Maintenance
GET    /api/maintenance              ?isActive=
GET    /api/maintenance/:vehicleId
POST   /api/maintenance              (opens → vehicle IN_SHOP)
PATCH  /api/maintenance/:id/close

# Fuel Logs
GET    /api/fuel-logs/:vehicleId
POST   /api/fuel-logs

# Expenses
GET    /api/expenses/:vehicleId
POST   /api/expenses

# Dashboard (single consolidated endpoint)
GET    /api/dashboard
  → { kpis, recentTrips, vehiclesInMaintenance, expiringLicenses, todaysExpenses }

# Reports (single consolidated endpoint)
GET    /api/reports                  ?from=&to=&vehicleId=
  → { fuelEfficiency, fleetUtilization, operationalCost, roi }
GET    /api/reports/export.csv
```

---

## 9. Dashboard — Data Contract

`GET /api/dashboard` returns:
```json
{
  "kpis": {
    "activeVehicles": 0,
    "availableVehicles": 0,
    "vehiclesInMaintenance": 0,
    "activeTrips": 0,
    "pendingTrips": 0,
    "driversOnDuty": 0,
    "fleetUtilizationPct": 0
  },
  "recentTrips": [ "last N trips" ],
  "vehiclesInMaintenance": [ "open maintenance logs w/ vehicle info" ],
  "expiringLicenses": [ "drivers with licenseExpiryDate within next 30 days" ],
  "todaysExpenses": { "total": 0, "breakdown": { "TOLL": 0, "MAINTENANCE": 0, "OTHER": 0 } }
}
```
Supports query filters: `?type=&status=&region=`.

---

## 10. Reports — Calculations

- **Fuel Efficiency** = `actualDistance / fuelConsumed` (per trip, aggregated per vehicle over a date range).
- **Fleet Utilization %** = `(vehicles with status ON_TRIP) / (vehicles with isActive=true and status != RETIRED) * 100`.
- **Operational Cost** (per vehicle) = `SUM(FuelLog.cost) + SUM(MaintenanceLog.cost) + SUM(Expense.amount)`.
- **Vehicle ROI** = `(SUM(Trip.revenue) − (SUM(MaintenanceLog.cost) + SUM(FuelLog.cost))) / Vehicle.acquisitionCost`.
- CSV export: flatten the report rows (per-vehicle) into CSV; PDF export remains optional/stretch.

---

## 11. Core Screens / Pages

1. **Login** — email + password, redirect by role.
2. **Dashboard** — KPI cards, recent trips, vehicles in maintenance, expiring licenses, today's expenses widget; filters by type/status/region.
3. **Vehicle Registry** — searchable/sortable table, add/edit/retire, status + region badges.
4. **Driver Management** — table, license expiry highlighted, suspend action, safety score.
5. **Trip Management** — create form (vehicle/driver dropdowns hit `/available` endpoints), lifecycle actions (Dispatch/Complete/Cancel), trip number shown.
6. **Maintenance** — per-vehicle log list, open/close actions, blocked with a clear message if vehicle is `ON_TRIP`.
7. **Fuel & Expenses** — log forms, per-vehicle running operational cost.
8. **Reports & Analytics** — charts for the four metrics above, date range + vehicle filter, CSV export button.

---

## 12. Example Workflow (E2E Demo / Test Script)

1. Register vehicle `Van-05`, region="North", maxLoadCapacity=500kg, status=Available.
2. Register driver `Alex` with a future license expiry date.
3. Create trip `TRP-00001`: source="Warehouse A", destination="Warehouse B" (different from source), vehicle=Van-05, driver=Alex, cargoWeight=450kg, revenue=5000.
4. System validates 450 ≤ 500 and source≠destination → trip created as `DRAFT`.
5. Dispatch trip → Van-05 and Alex both flip to `ON_TRIP`.
6. Attempt to open a maintenance log on Van-05 while `ON_TRIP` → rejected (rule #3).
7. Complete trip (enter actualDistance + fuelConsumed) → both flip back to `AVAILABLE`.
8. Now open maintenance record "Oil Change" (cost=800) on Van-05 → status becomes `IN_SHOP`, disappears from `/vehicles/available`.
9. Attempt to dispatch another trip using Van-05 → rejected (not in available pool).
10. Close maintenance → Van-05 returns to `AVAILABLE`.
11. Log a fuel entry (liters=20, cost=2000) linked to the trip.
12. Check `/api/reports` — fuel efficiency, operational cost, and ROI for Van-05 reflect trip #1 + the fuel log + the maintenance cost.
13. Check `/api/dashboard` — KPIs, recent trips, and today's expenses reflect all of the above.

---

## 13. Build Order (8-hour hackathon plan)

| Time | Task |
|---|---|
| Hr 0–0.5 | Local Postgres running, pgAdmin connected, Prisma schema (Section 5) migrated, seed script with sample users/vehicles/drivers |
| Hr 0.5–1.5 | Auth (login, JWT, RBAC middleware) + protected routing on frontend |
| Hr 1.5–3 | Vehicle Registry + Driver Management CRUD, `/available` endpoints, soft-delete/retire/suspend |
| Hr 3–4.5 | Trip Management: create/dispatch/complete/cancel with all business rules (Section 6) — core grading logic, prioritize correctness and transactions |
| Hr 4.5–5.5 | Maintenance workflow (open/close → vehicle status sync, ON_TRIP block) |
| Hr 5.5–6.5 | Fuel & Expense logging (with `ExpenseType` enum, optional trip link) + operational cost |
| Hr 6.5–7.5 | Dashboard consolidated endpoint + Reports consolidated endpoint + charts + CSV export |
| Hr 7.5–8 | Polish UI, run the Example Workflow (Section 12) end-to-end, fix bugs, prep demo |

---

## 14. Stretch Goals

- PDF export for reports
- Email reminders for expiring driver licenses (scheduled job)
- Vehicle document management (upload insurance/registration docs)
- Dark mode toggle
- Multi-region role scoping (Safety Officer limited to a region, etc.)

---

## 15. AI Coding Assistant Instructions

When generating code for this project:
- **Do not generate placeholder APIs or stub responses** — every endpoint must be fully implemented against the real Prisma schema.
- **Avoid TODOs** — if something is genuinely out of scope, omit it rather than leaving a marker.
- **Generate reusable React components** — tables, status badges, forms should be shared components parameterized by entity type, not duplicated per page.
- **Centralize validation in services** — Zod schemas for input shape, service-layer functions for business rules (Section 6). Controllers stay thin.
- **Avoid duplicate business logic** — eligibility checks (`assertVehicleEligibleForDispatch`, `assertDriverEligibleForDispatch`, etc.) must be single functions imported wherever needed, not re-implemented per route.
- **Wrap multi-table status changes in Prisma transactions** (trip dispatch/complete/cancel, maintenance open/close).
- **Use enums, not free-text strings**, for all status/type fields (already reflected in the schema above).
- **Soft-delete only** — never hard-delete Vehicle, Driver, or User records; use `isActive` / status transitions.
- Seed the local Postgres database (verifiable via pgAdmin) with realistic sample data before running the demo so Dashboard/Reports are populated.
