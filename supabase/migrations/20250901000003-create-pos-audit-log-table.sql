-- Point de Vente: pos_audit_log table
-- Every admin and POS action logged: who, what, when, IP, user_agent. No passwords/PII in details.

CREATE TABLE IF NOT EXISTS public.pos_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  performed_by_type TEXT NOT NULL CHECK (performed_by_type IN ('admin', 'pos_user')),
  performed_by_id UUID NOT NULL,
  performed_by_email TEXT,
  pos_outlet_id UUID REFERENCES public.pos_outlets(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('pos_outlet', 'pos_user', 'pos_pass_stock', 'order')),
  target_id UUID NOT NULL,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_audit_log_action ON public.pos_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_pos_audit_log_performer ON public.pos_audit_log(performed_by_type, performed_by_id);
CREATE INDEX IF NOT EXISTS idx_pos_audit_log_target ON public.pos_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_pos_audit_log_created ON public.pos_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_pos_audit_log_outlet ON public.pos_audit_log(pos_outlet_id);

ALTER TABLE public.pos_audit_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.pos_audit_log IS 'POS and admin POS actions. No passwords/PII in details. Backend only.';
