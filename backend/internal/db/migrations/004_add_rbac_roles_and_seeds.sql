-- Migration: 004_add_rbac_roles_and_seeds.sql
-- Description: Enforce allowed user roles ('user', 'auditor', 'teller', 'admin') and seed default demo accounts.

-- 1. Ensure role check constraint allows all 4 roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role;
ALTER TABLE users ADD CONSTRAINT chk_users_role CHECK (role IN ('user', 'auditor', 'teller', 'admin'));

-- 2. Seed Demo Accounts for Each Role (Password: Password123!)
-- Bcrypt Hash: $2a$10$2oskoScyzBGUi5xO0ZbxTuq.cjT9QC.edlP/aPJKPJFotjgDKDBia

-- 2.1 Administrator Account
INSERT INTO users (id, username, email, phone_number, password_hash, first_name, last_name, role, status)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'admin_demo',
    'admin@bank.core',
    '0890000001',
    '$2a$10$2oskoScyzBGUi5xO0ZbxTuq.cjT9QC.edlP/aPJKPJFotjgDKDBia',
    'Super',
    'Admin',
    'admin',
    'ACTIVE'
) ON CONFLICT (id) DO UPDATE SET role = 'admin', password_hash = EXCLUDED.password_hash;

-- 2.2 Auditor Account
INSERT INTO users (id, username, email, phone_number, password_hash, first_name, last_name, role, status)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    'auditor_demo',
    'auditor@bank.core',
    '0890000002',
    '$2a$10$2oskoScyzBGUi5xO0ZbxTuq.cjT9QC.edlP/aPJKPJFotjgDKDBia',
    'Compliance',
    'Auditor',
    'auditor',
    'ACTIVE'
) ON CONFLICT (id) DO UPDATE SET role = 'auditor', password_hash = EXCLUDED.password_hash;

-- 2.3 Teller Account
INSERT INTO users (id, username, email, phone_number, password_hash, first_name, last_name, role, status)
VALUES (
    '33333333-3333-3333-3333-333333333333',
    'teller_demo',
    'teller@bank.core',
    '0890000003',
    '$2a$10$2oskoScyzBGUi5xO0ZbxTuq.cjT9QC.edlP/aPJKPJFotjgDKDBia',
    'Branch',
    'Teller',
    'teller',
    'ACTIVE'
) ON CONFLICT (id) DO UPDATE SET role = 'teller', password_hash = EXCLUDED.password_hash;

-- 2.4 Standard Customer Account
INSERT INTO users (id, username, email, phone_number, password_hash, first_name, last_name, role, status)
VALUES (
    '44444444-4444-4444-4444-444444444444',
    'customer_demo',
    'customer@bank.core',
    '0890000004',
    '$2a$10$2oskoScyzBGUi5xO0ZbxTuq.cjT9QC.edlP/aPJKPJFotjgDKDBia',
    'Demo',
    'Customer',
    'user',
    'ACTIVE'
) ON CONFLICT (id) DO UPDATE SET role = 'user', password_hash = EXCLUDED.password_hash;

-- Also update existing admin user if present
UPDATE users SET role = 'admin' WHERE email = 'admin@gmail.com';

-- 3. Seed Primary Accounts for Demo Customer
INSERT INTO accounts (id, account_number, user_id, currency, account_type, status, balance, linked_phone)
VALUES (
    200,
    '100-200-3000',
    '44444444-4444-4444-4444-444444444444',
    'THB',
    'SAVINGS',
    'ACTIVE',
    2500000, -- 25,000.00 THB
    '0890000004'
) ON CONFLICT (id) DO NOTHING;
