/**
 * TypeScript types for Logs & Analytics system
 */

export type LogType = 'info' | 'warning' | 'error' | 'success' | 'action';

export type LogCategory = 
  | 'user_action' 
  | 'api_call' 
  | 'database' 
  | 'page_view' 
  | 'form_submission'
  | 'authentication'
  | 'navigation'
  | 'error'
  | 'system'
  | 'sms'
  | 'email'
  | 'payment'
  | 'security';

export type UserType = 'admin' | 'ambassador' | 'guest';

export type LogSource = 'site_logs' | 'security_audit_logs' | 'sms_logs' | 'email_delivery_logs';

export interface LogEntry {
  id: string;
  source: LogSource;
  log_type: LogType;
  category: LogCategory | string;
  message: string;
  details: Record<string, any> | null;
  user_id: string | null;
  user_type: UserType | null;
  ip_address: string | null;
  user_agent: string | null;
  page_url: string | null;
  request_method: string | null;
  request_path: string | null;
  response_status: number | null;
  error_stack: string | null;
  created_at: string;
}

export interface LogsResponse {
  success: boolean;
  logs: LogEntry[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  filters: {
    type: string | null;
    category: string | null;
    userRole: string | null;
    userId: string | null;
    startDate: string | null;
    endDate: string | null;
    search: string | null;
  };
}

export interface LogsFilters {
  type?: LogType[];
  category?: string;
  userRole?: UserType;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'time' | 'type';
  order?: 'asc' | 'desc';
}
