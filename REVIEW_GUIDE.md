# BIT Campus Stationary & Pre-Procurement Management System
## Examiner Review, Viva Voce & Demonstration Guide

---

## 1. Quick Startup & Server Commands

### Option A: Unified Single-Command Startup (Recommended)
Runs both the Express API backend (Port 5000) and the Vite React frontend (Port 5173) concurrently:
```bash
npm run dev
```

### Option B: Separate Terminals (Dual Terminal Setup)

**Terminal 1 — Backend API Server:**
```bash
npm run server
# or: node server.js
```
*Backend runs at:* `http://localhost:5000`  
*Health / API Base:* `http://localhost:5000/api/inventory`

**Terminal 2 — Frontend Client (Vite):**
```bash
npx vite
# or: npm run dev (if server is running standalone)
```
*Frontend Application runs at:* `http://localhost:5173`

---

## 2. Seed Credentials & Presentation Mode

For instant examiner evaluation, the login screen includes a **Demo Quick Login (Presentation Mode)** widget with 1-click authentication:

| Role | Username | Password | Department | Primary Responsibilities |
| :--- | :--- | :--- | :--- | :--- |
| **Faculty / Requester** | `faculty_cs` | `password123` | Computer Science | Raise indent requisitions, track approval status |
| **HOD Approver** | `hod_cs` | `password123` | Computer Science | Review and approve/reject departmental indents |
| **Central Storekeeper** | `storekeeper_main` | `password123` | Central Store | Dispatch approved indents, adjust stock, manage inventory |
| **Procurement Manager**| `procurement_main`| `password123` | Procurement Office | Manage automated RFQs, place purchase orders, receive batches |

---

## 3. End-to-End 4-Role Demonstration Walkthrough Flow

Follow this 5-minute sequence to demonstrate the entire lifecycle to an examiner:

```
[Faculty: Raise Indent] ──> [HOD: Review & Approve] ──> [Storekeeper: Dispatch Stock] ──> [Procurement: Auto RFQ & Restock]
```

### Step 1: Faculty (Indent Requisition)
1. Open `http://localhost:5173`.
2. Click **Faculty** under the *Demo Quick Login* panel (or login as `faculty_cs` / `password123`).
3. Click the **"New Indent"** tab.
4. Select an item (e.g., `Whiteboard Markers (Blue)`), specify a quantity (e.g., `5 Boxes`), and click **"Submit Indent"**.
5. Switch to **"My Indents"** to show the newly created indent in `Pending HOD` status.
6. Click **Sign Out**.

### Step 2: HOD Approver (Departmental Governance)
1. Click **HOD Approver** under *Demo Quick Login* (or login as `hod_cs` / `password123`).
2. Notice the dashboard displays indents submitted **exclusively** by faculty and students in the Computer Science department.
3. Locate the indent created in Step 1.
4. Enter optional remarks (e.g., *"Approved for Odd Semester Lab Sessions"*) and click **"Approve Indent"**.
5. Show that the status shifts to `Approved` with live timestamp attribution.
6. Click **Sign Out**.

### Step 3: Central Storekeeper (Safe Inventory Fulfillment)
1. Click **Storekeeper** under *Demo Quick Login* (or login as `storekeeper_main` / `password123`).
2. Navigate to **"Requisitions / Indents"** and filter by `Approved`.
3. Locate the approved indent.
4. Click **"Dispatch Indent"**:
   - The backend acquires an immediate SQLite write lock (`BEGIN IMMEDIATE TRANSACTION`).
   - Verifies available stock against requested quantity.
   - Atomically decrements the stock in the `items` table.
   - Records an immutable log in `telemetry_logs`.
   - If stock falls to zero, automatically triggers stock-out email notifications.
5. Navigate to **"Stock Management"** to demonstrate that stock numbers updated in real-time.
6. Click **Sign Out**.

### Step 4: Procurement Manager (Pre-Procurement Engine & PO Lifecycle)
1. Click **Procurement** under *Demo Quick Login* (or login as `procurement_main` / `password123`).
2. Navigate to **"Pre-Procurement RFQs"**:
   - Demonstrate the automated RFQ batches created by the engine for items whose net stock is below the minimum threshold.
3. For any open RFQ batch (status `RFQ_Created`), click **"Issue Purchase Order"** (status moves to `Ordered`).
4. Once shipment arrives, click **"Receive Goods & Restock"**:
   - Stock quantities in `items` table are atomically incremented.
   - Batch items update to `Received`.
5. Navigate to **"Email Alert Logs"** to show official notification emails dispatched to higher officials (HOD, Faculty, Storekeeper, Procurement).
6. Navigate to **"Audit & Telemetry"** to show the tamper-evident ledger tracking every user action, quantity change, and timestamp.

---

## 4. Top 10 Examiner Viva Voce Questions & Answers

### Q1: What is the high-level architecture of this application?
**Answer:**
The application utilizes a **Decoupled 3-Tier Client-Server Architecture**:
- **Presentation Layer (Frontend):** React 19 single-page application (SPA) built with Vite and styled with Tailwind CSS. It communicates with the backend asynchronously using RESTful JSON APIs and JWT bearer tokens.
- **Application Layer (Backend):** Node.js runtime with Express.js microservice architecture exposing modular endpoints for Authentication, Inventory, Requisitions, Pre-Procurement Engine, and Telemetry Logging.
- **Data Layer (Database):** Relational SQLite database (`stationary_system.db`) enforcing referential integrity with foreign key constraints (`PRAGMA foreign_keys = ON`), automated timestamps (`created_at`, `updated_at`), and column-level validation constraints.

---

### Q2: Why did you choose SQLite over MySQL or PostgreSQL for this implementation?
**Answer:**
- **Zero-Configuration & Portability:** SQLite is a serverless, self-contained embedded relational engine that stores the entire database in a single binary file (`stationary_system.db`). This ensures 100% portability during academic evaluation without requiring external database server daemons.
- **Full ACID Compliance:** SQLite provides full Atomicity, Consistency, Isolation, and Durability (ACID).
- **Smooth Production Transition:** The database DDL is documented in standard SQL in `database/schema.sql`, allowing trivial migration to PostgreSQL or MySQL in enterprise production simply by swapping the connection driver.

---

### Q3: How is Role-Based Access Control (RBAC) enforced on the server?
**Answer:**
Security is enforced on the server side at the route layer, ensuring users cannot bypass frontend controls:
1. **Cryptographic Token Verification:** Requests pass through the `authenticateToken` middleware, which parses the HTTP `Authorization: Bearer <token>` header and verifies the signature using JSON Web Tokens (JWT) and a server secret key.
2. **Role Authorization Middleware:** Routes are guarded using the `requireRole(['role1', 'role2'])` higher-order middleware. If a requester token role is not in the allowed list, an HTTP 403 Forbidden is returned.
3. **Departmental Isolation Logic:** In `PUT /api/requisitions/:id/status`, the backend compares `req.user.department` with the requisition requester's department. An HOD cannot approve indents outside their own department.

---

### Q4: How does the system prevent race conditions and negative inventory during simultaneous dispatches?
**Answer:**
Through two layers of defense:
1. **Atomic SQLite Transactions:** During indent dispatching (`status === 'Dispatched'`), the server opens an immediate transaction using:
   ```sql
   BEGIN IMMEDIATE TRANSACTION;
   ```
   This acquires a reserved write lock immediately, blocking other write connections from reading stale inventory numbers.
2. **Conditional Check & SQL Constraint:**
   - In SQL schema: `CHECK (current_stock >= 0)`.
   - In update query:
     ```sql
     UPDATE items SET current_stock = current_stock - ?, updated_at = ? 
     WHERE id = ? AND current_stock >= ?;
     ```
   If stock is insufficient, the statement changes 0 rows, triggering an explicit `ROLLBACK` and returning an HTTP 400 error. Stock can never drop below zero.

---

### Q5: How does the Pre-Procurement Calculation Engine determine when and how much to order?
**Answer:**
The engine scans inventory and accounts for **active demand pipeline**:
1. It calculates `pending_demand` by summing quantities from all indents with `status = 'Approved'` that have not yet been dispatched.
2. It computes **Net Available Stock**:
   $$\text{Net Stock} = \text{Current Stock} - \text{Pending Demand}$$
3. An item qualifies for automated RFQ if:
   $$\text{Current Stock} \le \text{Min Threshold} \quad \text{OR} \quad \text{Net Stock} \le \text{Min Threshold} \quad \text{OR} \quad \text{Current Stock} < \text{Pending Demand}$$
4. Reorder Quantity calculation:
   $$\text{Suggested Quantity} = \max((\text{Min Threshold} \times 2) - \text{Net Stock}, \, \text{Min Threshold})$$
5. Duplication Guard: The engine checks if the item is already part of an active RFQ batch (`RFQ_Created` or `Ordered`) to avoid redundant purchase orders.

---

### Q6: How does the stock-out notification system work, and what happens if the SMTP mail server is unreachable?
**Answer:**
- **Trigger:** Whenever inventory updates (via storekeeper dispatch or manual adjustment) cause an item's stock level to reach 0 units, `dispatchStockDepletedAlerts(itemId)` is invoked.
- **Recipients:** It dynamically compiles a distribution list across 4 key roles:
  1. HOD Approver (Directive: hold new student/faculty indents)
  2. Procurement Manager (Directive: expedite Purchase Order)
  3. Central Storekeeper (Directive: prepare receipt staging)
  4. Faculty (Advisory: inform about temporary unavailability)
- **Graceful Fallback:** If external SMTP credentials are not present in `.env`, the pipeline activates simulation fallback mode: it persists high-fidelity HTML emails into the `email_notifications` table and logs them cleanly to the console. The calling API request succeeds instantly without latency or crashing.

---

### Q7: Explain the database normalization and schema relationships.
**Answer:**
The schema is normalized to **Third Normal Form (3NF)**:
- `users`: Stores user entities with unique constraints on username and email.
- `items`: Stores inventory items with units and minimum stock threshold.
- `requisitions`: Header record for an indent containing requester foreign key, approver foreign key, overall status, and timestamps.
- `requisition_items`: Junction / Line-item table linking `requisitions.id` to `items.id` with specific quantity, eliminating repeating groups.
- `pre_procurement_batches` & `pre_procurement_items`: Master-detail relationship tracking bulk replenishment orders.
- `telemetry_logs`: Immutable audit log table recording timestamp, user ID, delta quantity, and action description.
- Foreign keys specify `ON DELETE CASCADE` or `ON DELETE SET NULL` to maintain relational integrity.

---

### Q8: How is data immutability and audit logging preserved?
**Answer:**
Every state-altering event (indent creation, HOD approval, warehouse dispatch, stock replenishment, and RFQ generation) automatically inserts a record into `telemetry_logs`.
- The table contains `timestamp`, `user_id`, `action`, `quantity_changed`, and `affected_department`.
- No `UPDATE` or `DELETE` endpoints are exposed for `telemetry_logs`, making it an append-only audit trail that allows administrators to track who modified stock, when, and by how many units.

---

### Q9: How are passwords secured and how is session authentication handled?
**Answer:**
- **Password Hashing:** Passwords are hashed using cryptographic SHA-256 (`crypto.createHash('sha256')`). In an enterprise deployment, this is easily upgraded to `bcrypt` or `argon2` with salt rounds. Plaintext passwords are never stored in the database.
- **Stateless Authentication:** The system uses standard JSON Web Tokens (JWT). Upon successful login, the server issues a signed token containing the user's ID, username, role, and department with a 24-hour expiration. The client stores this in `localStorage` and includes it in the `Authorization: Bearer` header on subsequent requests.

---

### Q10: What steps would you take to deploy this system to production at scale?
**Answer:**
1. **Database Migration:** Point Prisma/Knex or direct SQL drivers to a managed PostgreSQL cluster (e.g., Supabase or AWS RDS) with automated backups and read-replicas.
2. **Environment Configuration:** Secure secrets (`JWT_SECRET`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `PORT`) via AWS Secrets Manager or Docker environment files.
3. **Transport Security:** Deploy behind an NGINX reverse proxy with TLS/SSL encryption (HTTPS) and HTTP Strict Transport Security (HSTS).
4. **Rate Limiting & CORS:** Implement `express-rate-limit` on login and requisition endpoints to mitigate brute-force and DDoS attacks.
5. **Real-Time WebSockets:** Enhance the telemetry feed with Socket.io / WebSocket for instant live-push notifications to all active dashboards.

---
*Created for Bannari Amman Institute of Technology (BIT) academic evaluation and project review.*
