-- Seed development data

-- Insert test users
INSERT INTO users (id, email, password_hash, name, role) VALUES
-- Password: 'password123' (hashed with bcrypt)
('550e8400-e29b-41d4-a716-446655440000', 'admin@adserver.dev', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/Ue1FAZE.3xVm0yXmq', 'Admin User', 'admin'),
('550e8400-e29b-41d4-a716-446655440001', 'advertiser@adserver.dev', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/Ue1FAZE.3xVm0yXmq', 'Test Advertiser', 'advertiser'),
('550e8400-e29b-41d4-a716-446655440002', 'viewer@adserver.dev', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/Ue1FAZE.3xVm0yXmq', 'Viewer User', 'viewer');

-- Note: All test users have password 'password123'
-- In production, never seed actual passwords or use these weak passwords