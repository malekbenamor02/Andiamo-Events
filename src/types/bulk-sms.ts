/**
 * TypeScript interfaces for Bulk SMS feature
 */

export interface SourceSelection {
  ambassador_applications: boolean;
  orders: boolean;
  aio_events_submissions: boolean;
  approved_ambassadors: boolean;
  phone_subscribers: boolean;
}

export interface AmbassadorApplicationsFilters {
  status?: ('pending' | 'approved' | 'rejected' | 'removed')[];
  city?: string | null;
  ville?: string | null;
}

export interface OrdersFilters {
  city?: string | null;
  ville?: string | null;
  status?: string[];
  payment_method?: string | null;
  source?: string | null;
}

export interface AioEventsFilters {
  city?: string | null;
  ville?: string | null;
  status?: string[];
  event_id?: string | null;
}

export interface ApprovedAmbassadorsFilters {
  city?: string | null;
  ville?: string | null;
}

export interface PhoneSubscribersFilters {
  city?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

export interface SourceFilters {
  ambassador_applications: AmbassadorApplicationsFilters;
  orders: OrdersFilters;
  aio_events_submissions: AioEventsFilters;
  approved_ambassadors: ApprovedAmbassadorsFilters;
  phone_subscribers: PhoneSubscribersFilters;
}

export interface PhoneNumberWithMetadata {
  phone: string;
  source: keyof SourceSelection;
  sourceId: string;
  city?: string | null;
  ville?: string | null;
  metadata?: Record<string, any>;
}

export interface BulkSmsData {
  phoneNumbers: string[];
  message: string;
  sources: SourceSelection;
  filters: SourceFilters;
  metadata?: {
    campaignName?: string;
    adminId?: string;
  };
}

export interface BulkSmsResult {
  phone: string;
  status: 'sent' | 'failed';
  source: keyof SourceSelection;
  sourceId?: string;
  error?: string;
  sentAt?: string;
  apiResponse?: any;
}

export interface BulkSmsResponse {
  total: number;
  sent: number;
  failed: number;
  results: BulkSmsResult[];
  smsLogIds: string[];
}

export interface PhoneNumbersPreviewResponse {
  phoneNumbers: PhoneNumberWithMetadata[];
  counts: {
    total: number;
    unique: number;
    duplicates: number;
    bySource: Record<string, number>;
  };
  duplicates: Array<{
    phone: string;
    sources: string[];
  }>;
}

export interface SourceCountsResponse {
  ambassador_applications?: {
    total: number;
    withPhone: number;
    byStatus?: Record<string, number>;
  };
  orders?: {
    total: number;
    withPhone: number;
    byCity?: Record<string, number>;
  };
  aio_events_submissions?: {
    total: number;
    withPhone: number;
  };
  approved_ambassadors?: {
    total: number;
    withPhone: number;
  };
  phone_subscribers?: {
    total: number;
    withPhone: number;
  };
}
