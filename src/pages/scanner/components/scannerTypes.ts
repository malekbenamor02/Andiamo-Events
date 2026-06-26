export type ScanHistoryRow = {
  id: string;
  scan_time: string;
  scan_result: string;
  scanner_name?: string | null;
  notes?: string | null;
};

export type InspectPanel = {
  qr_ticket_id: string;
  pass_type: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  event_name: string | null;
  payment_method: string | null;
  payment_method_label: string | null;
  pass_price: number | null;
  pass_price_formatted: string | null;
  order_number: string | null;
};

export type OrderPassRow = {
  qr_ticket_id: string;
  pass_type: string | null;
  ticket_status: string | null;
  token_preview: string | null;
  is_current: boolean;
};

export type ScanResult = {
  success: boolean;
  result: string;
  message: string;
  lookup?: boolean;
  invitation?: Record<string, unknown> | null;
  scan_history?: ScanHistoryRow[];
  ticket_status?: string | null;
  inspect_panel?: InspectPanel | null;
  order_passes?: OrderPassRow[] | null;
  ticket?: {
    pass_type?: string;
    buyer_name?: string;
    ambassador_name?: string;
    event_name?: string;
    is_invitation?: boolean;
    source?: string | null;
    scanned_at?: string;
    invitation_number?: string | null;
    recipient_name?: string | null;
    recipient_phone?: string | null;
    recipient_email?: string | null;
    [key: string]: unknown;
  };
  previous_scan?: { scanned_at?: string; scanner_name?: string };
  correct_event?: { event_name?: string; event_date?: string; event_id?: string };
  event_date?: string;
  enabled?: boolean;
};

export type ScanRow = {
  id: string;
  scan_time: string;
  scan_result: string;
  buyer_name: string | null;
  pass_type: string | null;
};

export type ScanStats = {
  total: number;
  byStatus: Record<string, number>;
  byPass: Record<string, number>;
};

export type SelectedEvent = {
  id: string;
  name: string;
  date: string;
  venue: string;
};
