# stationary-preprocurement-system-bit-stationary-hub

A digital platform designed for educational campuses to streamline stationary requests, automate multi-level approvals, manage vendor pre-procurement, and track departmental inventory efficiently.

## Core Features
- **Role-Based Access Control**: Tailored workflows for Faculty (Requester), HOD (Approver), Storekeeper (Fulfillment), and Procurement.
- **End-to-End Indent Lifecycle**: Digital requisitions, HOD approvals, stock verification, and physical store dispatch vouchers.
- **Automated Pre-Procurement Engine**: Automated reorder calculations and RFQ batch creation when stock hits minimum thresholds.
- **Institutional Email Pipeline**: Automated Bannari Amman Institute of Technology letterhead emails for indents and critical stock alerts.
- **Immutable Audit Telemetry**: Full transaction and inventory movement ledger stored in SQLite.

## Quick Setup
1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

3. **Start Development Server:**
   ```bash
   npm run dev
   ```
   - Web Portal: [http://localhost:5173](http://localhost:5173)
   - Backend API: [http://localhost:5000](http://localhost:5000)
