-- Seed development data

-- Delete existing test users first
DELETE FROM users WHERE email IN ('admin@adserver.dev', 'advertiser@adserver.dev', 'viewer@adserver.dev');

-- Insert test users
INSERT INTO users (id, email, password_hash, name, role) VALUES
-- Password: 'password123' (hashed with bcrypt rounds=12)
('550e8400-e29b-41d4-a716-446655440000', 'admin@adserver.dev', '$2b$12$fzTqDXSu5Ohj38zKkVymx.nq4LYhPXNr95y9/4a2g/2PzJIo.2ism', 'Admin User', 'admin'),
('550e8400-e29b-41d4-a716-446655440001', 'advertiser@adserver.dev', '$2b$12$fzTqDXSu5Ohj38zKkVymx.nq4LYhPXNr95y9/4a2g/2PzJIo.2ism', 'Test Advertiser', 'advertiser'),
('550e8400-e29b-41d4-a716-446655440002', 'viewer@adserver.dev', '$2b$12$fzTqDXSu5Ohj38zKkVymx.nq4LYhPXNr95y9/4a2g/2PzJIo.2ism', 'Viewer User', 'viewer');

-- Note: All test users have password 'password123'
-- In production, never seed actual passwords or use these weak passwords