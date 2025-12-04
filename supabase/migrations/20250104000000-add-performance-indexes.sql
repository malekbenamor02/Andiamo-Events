-- Add performance indexes for frequently queried columns
-- This migration adds indexes to improve query performance

-- Orders table indexes
CREATE INDEX IF NOT EXISTS idx_orders_ambassador_id ON orders(ambassador_id);
CREATE INDEX IF NOT EXISTS idx_orders_event_id ON orders(event_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_city ON orders(city);
CREATE INDEX IF NOT EXISTS idx_orders_ville ON orders(ville);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_ambassador_status ON orders(ambassador_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_event_status ON orders(event_id, status);

-- Tickets table indexes
CREATE INDEX IF NOT EXISTS idx_tickets_order_id ON tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_order_pass_id ON tickets(order_pass_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_secure_token ON tickets(secure_token);

-- Scans table indexes
CREATE INDEX IF NOT EXISTS idx_scans_ticket_id ON scans(ticket_id);
CREATE INDEX IF NOT EXISTS idx_scans_event_id ON scans(event_id);
CREATE INDEX IF NOT EXISTS idx_scans_ambassador_id ON scans(ambassador_id);
CREATE INDEX IF NOT EXISTS idx_scans_scan_result ON scans(scan_result);
CREATE INDEX IF NOT EXISTS idx_scans_scan_time ON scans(scan_time DESC);

-- Order passes table indexes
CREATE INDEX IF NOT EXISTS idx_order_passes_order_id ON order_passes(order_id);
CREATE INDEX IF NOT EXISTS idx_order_passes_pass_type ON order_passes(pass_type);

-- Ambassadors table indexes
CREATE INDEX IF NOT EXISTS idx_ambassadors_phone ON ambassadors(phone);
CREATE INDEX IF NOT EXISTS idx_ambassadors_status ON ambassadors(status);
CREATE INDEX IF NOT EXISTS idx_ambassadors_city ON ambassadors(city);
CREATE INDEX IF NOT EXISTS idx_ambassadors_ville ON ambassadors(ville);
CREATE INDEX IF NOT EXISTS idx_ambassadors_status_city ON ambassadors(status, city);

-- Ambassador applications table indexes
CREATE INDEX IF NOT EXISTS idx_ambassador_applications_status ON ambassador_applications(status);
CREATE INDEX IF NOT EXISTS idx_ambassador_applications_phone ON ambassador_applications(phone_number);
CREATE INDEX IF NOT EXISTS idx_ambassador_applications_created_at ON ambassador_applications(created_at DESC);

-- Email delivery logs indexes
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_order_id ON email_delivery_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_status ON email_delivery_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_created_at ON email_delivery_logs(created_at DESC);

-- SMS logs indexes
CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON sms_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON sms_logs(created_at DESC);

-- Round robin tracker indexes
CREATE INDEX IF NOT EXISTS idx_round_robin_tracker_ville ON round_robin_tracker(ville);
CREATE INDEX IF NOT EXISTS idx_round_robin_tracker_ambassador_id ON round_robin_tracker(ambassador_id);

-- Events table indexes
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date DESC);
CREATE INDEX IF NOT EXISTS idx_events_featured ON events(featured);
CREATE INDEX IF NOT EXISTS idx_events_city ON events(city);

-- Comments on indexes for documentation
COMMENT ON INDEX idx_orders_ambassador_status IS 'Composite index for filtering orders by ambassador and status';
COMMENT ON INDEX idx_orders_event_status IS 'Composite index for filtering orders by event and status';
COMMENT ON INDEX idx_ambassadors_status_city IS 'Composite index for filtering ambassadors by status and city';

