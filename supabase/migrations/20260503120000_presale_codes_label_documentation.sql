-- Documents how `label` is used (admin display; set at code creation). No schema change.
COMMENT ON COLUMN public.presale_codes.label IS 'Plaintext presale entry string shown in admin; stored when the code is created. Not derivable from code_hash if null.';
