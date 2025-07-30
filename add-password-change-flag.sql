-- Add a column to track if a password change is required for ambassadors.
ALTER TABLE ambassadors
ADD COLUMN requires_password_change BOOLEAN DEFAULT TRUE;
 
-- Set the flag to false for any existing ambassadors so they are not affected.
UPDATE ambassadors
SET requires_password_change = FALSE; 