-- Add reset token columns to ambassadors table
ALTER TABLE ambassadors 
ADD COLUMN reset_token TEXT,
ADD COLUMN reset_token_expiry TIMESTAMP WITH TIME ZONE;

-- Add index for faster token lookups
CREATE INDEX idx_ambassadors_reset_token ON ambassadors(reset_token); 