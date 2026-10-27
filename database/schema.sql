-- SQL DDL Script for PostgreSQL / SQLite
-- Title: BIT Campus Stationary Resources and Pre-Procurement Management System
-- Production Database Schema

-- Drop tables if they exist (for easy teardown/setup)
DROP TABLE IF EXISTS email_notifications;
DROP TABLE IF EXISTS telemetry_logs;
DROP TABLE IF EXISTS pre_procurement_items;
DROP TABLE IF EXISTS pre_procurement_batches;
DROP TABLE IF EXISTS requisition_items;
DROP TABLE IF EXISTS requisitions;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS users;

-- 1. Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('requester', 'approver', 'fulfillment', 'procurement')),
    department VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Stationary Items (Inventory) Table
CREATE TABLE items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    category VARCHAR(100) NOT NULL,
    current_stock INT NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    min_threshold INT NOT NULL DEFAULT 10 CHECK (min_threshold >= 0),
    unit VARCHAR(50) NOT NULL DEFAULT 'Units',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Requisitions Table (Indents)
CREATE TABLE requisitions (
    id SERIAL PRIMARY KEY,
    requester_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    approver_id INT REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending HOD' CHECK (status IN ('Draft', 'Pending HOD', 'Approved', 'Dispatched', 'Rejected')),
    remarks TEXT,
    total_items INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Requisition Items (Detailed Line Items)
CREATE TABLE requisition_items (
    id SERIAL PRIMARY KEY,
    requisition_id INT NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
    item_id INT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    quantity INT NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Pre-Procurement Batches (RFQ / Orders)
CREATE TABLE pre_procurement_batches (
    id SERIAL PRIMARY KEY,
    manager_id INT REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'RFQ_Created' CHECK (status IN ('RFQ_Created', 'Ordered', 'Received')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Pre-Procurement Line Items
CREATE TABLE pre_procurement_items (
    id SERIAL PRIMARY KEY,
    batch_id INT NOT NULL REFERENCES pre_procurement_batches(id) ON DELETE CASCADE,
    item_id INT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    suggested_quantity INT NOT NULL CHECK (suggested_quantity > 0),
    status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Ordered', 'Received')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Audit & Telemetry Logging Table (Immutable Ledger)
CREATE TABLE telemetry_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(150) NOT NULL,
    quantity_changed INT DEFAULT 0,
    affected_department VARCHAR(100),
    item_id INT REFERENCES items(id) ON DELETE SET NULL
);

-- 8. Automated Email Notifications Dispatch Table
CREATE TABLE email_notifications (
    id SERIAL PRIMARY KEY,
    item_id INT REFERENCES items(id) ON DELETE SET NULL,
    item_name VARCHAR(150) NOT NULL,
    recipient_role VARCHAR(100) NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(100) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body_html TEXT NOT NULL,
    trigger_reason VARCHAR(150) NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'SENT'
);

-- --- Database Indexes for Performance Optimization ---
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_stock_threshold ON items(current_stock, min_threshold);
CREATE INDEX idx_requisitions_status ON requisitions(status);
CREATE INDEX idx_requisitions_requester ON requisitions(requester_id);
CREATE INDEX idx_requisition_items_req_id ON requisition_items(requisition_id);
CREATE INDEX idx_pre_procurement_items_batch_id ON pre_procurement_items(batch_id);
CREATE INDEX idx_telemetry_logs_timestamp ON telemetry_logs(timestamp);
CREATE INDEX idx_telemetry_logs_item ON telemetry_logs(item_id);
CREATE INDEX idx_email_notifications_sent_at ON email_notifications(sent_at);
CREATE INDEX idx_email_notifications_item ON email_notifications(item_id);

-- --- Sample Seed Data for Testing ---
INSERT INTO users (username, password_hash, role, department, email) VALUES
('student_rahul', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'requester', 'Computer Science', 'student.cs@bit.ac.in'),
('faculty_cs', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'requester', 'Computer Science', 'faculty.cs@bit.ac.in'),
('hod_cs', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'approver', 'Computer Science', 'hod.cs@bit.ac.in'),
('storekeeper_main', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'fulfillment', 'Central Store', 'store@bit.ac.in'),
('procurement_main', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'procurement', 'Procurement Office', 'procurement@bit.ac.in');

INSERT INTO items (name, category, current_stock, min_threshold, unit) VALUES
('Whiteboard Markers (Blue)', 'Writing Materials', 12, 15, 'Boxes'),
('A4 Printer Paper (75GSM)', 'Paper Resources', 85, 50, 'Reams'),
('Sticky Notes (Yellow, 3x3)', 'Office Supplies', 4, 10, 'Packs'),
('Ballpoint Pens (Black, Pack of 10)', 'Writing Materials', 45, 20, 'Packs'),
('Heavy-Duty Stapler', 'Office Supplies', 3, 5, 'Pieces'),
('Dry Erase Eraser', 'Writing Materials', 8, 8, 'Pieces');
