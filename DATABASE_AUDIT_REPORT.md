# 🗄️ COMPLETE DATABASE AUDIT REPORT
## Andiamo Events - Supabase PostgreSQL Database

**Generated:** 2025-01-XX  
**Database:** PostgreSQL (Supabase)  
**Analysis Method:** Migration file analysis + Codebase cross-reference

---

## 📋 TABLE OF CONTENTS

1. [Schema Introspection](#1-schema-introspection)
2. [Entity Relationship Diagram](#2-entity-relationship-diagram)
3. [Cross-Codebase Analysis](#3-cross-codebase-analysis)
4. [Performance Analysis](#4-performance-analysis)
5. [Issues & Recommendations](#5-issues--recommendations)

---

## 1. SCHEMA INTROSPECTION

### 1.1 All Tables and Columns

#### **Core Entity Tables**

**`admins`** (Admin Users)
- `id` UUID PRIMARY KEY
- `name` TEXT NOT NULL
- `email` TEXT UNIQUE NOT NULL
- `password` TEXT NOT NULL
- `role` TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin'))
- `is_active` BOOLEAN DEFAULT true
- `last_login` TIMESTAMP WITH TIME ZONE
- `created_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `updated_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- **Indexes:** `idx_admins_email`
- **RLS:** Enabled

**`ambassadors`** (Ambassador Profiles)
- `id` UUID PRIMARY KEY
- `full_name` TEXT NOT NULL
- `phone` TEXT UNIQUE NOT NULL
- `email` TEXT (nullable)
- `city` TEXT NOT NULL
- `ville` TEXT (nullable, added later)
- `password` TEXT NOT NULL
- `status` TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended'))
- `commission_rate` DECIMAL(5,2) DEFAULT 10.00
- `approved_by` UUID (nullable)
- `approved_at` TIMESTAMP WITH TIME ZONE (nullable)
- `created_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `updated_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- **Indexes:** `idx_ambassadors_phone`, `idx_ambassadors_status`, `idx_ambassadors_city`, `idx_ambassadors_ville`, `idx_ambassadors_status_city`
- **RLS:** Enabled

**`ambassador_applications`** (Application Submissions)
- `id` UUID PRIMARY KEY
- `full_name` TEXT NOT NULL
- `age` INTEGER NOT NULL
- `city` TEXT NOT NULL
- `ville` TEXT (nullable, added later)
- `phone_number` TEXT NOT NULL
- `email` TEXT (nullable, added later)
- `social_link` TEXT (nullable)
- `motivation` TEXT (nullable)
- `status` TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'))
- `created_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- **Indexes:** `idx_ambassador_applications_status`, `idx_ambassador_applications_phone`, `idx_ambassador_applications_created_at`
- **RLS:** Enabled

**`events`** (Event Information)
- `id` UUID PRIMARY KEY
- `name` TEXT NOT NULL
- `description` TEXT (nullable)
- `date` TIMESTAMP WITH TIME ZONE NOT NULL
- `venue` TEXT NOT NULL
- `city` TEXT NOT NULL
- `poster_url` TEXT (nullable)
- `ticket_link` TEXT (nullable)
- `whatsapp_link` TEXT (nullable)
- `featured` BOOLEAN DEFAULT false
- `standard_price` DECIMAL(10,2) DEFAULT 0.00 (added later)
- `vip_price` DECIMAL(10,2) DEFAULT 0.00 (added later)
- `created_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `updated_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- **Indexes:** `idx_events_date`, `idx_events_featured`, `idx_events_city`
- **RLS:** Enabled

**`orders`** (Order Management)
- `id` UUID PRIMARY KEY
- `source` TEXT NOT NULL CHECK (source IN ('platform_cod', 'platform_online', 'ambassador_manual'))
- `customer_name` TEXT NOT NULL (deprecated, should use `user_name`)
- `user_name` TEXT (nullable, added later - INCONSISTENCY)
- `phone` TEXT NOT NULL (deprecated, should use `user_phone`)
- `user_phone` TEXT (nullable, added later - INCONSISTENCY)
- `email` TEXT (deprecated, should use `user_email`)
- `user_email` TEXT (nullable, added later - INCONSISTENCY)
- `city` TEXT NOT NULL
- `city_id` UUID REFERENCES cities(id) (nullable, added later)
- `ville` TEXT (nullable)
- `ville_id` UUID REFERENCES villes(id) (nullable, added later)
- `event_id` UUID REFERENCES events(id) (nullable, added later)
- `ambassador_id` UUID REFERENCES ambassadors(id) ON DELETE SET NULL
- `pass_type` TEXT (nullable, deprecated - use `order_passes` table)
- `quantity` INTEGER DEFAULT 1 CHECK (quantity > 0)
- `total_price` DECIMAL(10,2) NOT NULL CHECK (total_price >= 0)
- `payment_method` TEXT NOT NULL CHECK (payment_method IN ('online', 'cod'))
- `payment_type` TEXT (deprecated, removed in migration)
- `payment_status` TEXT CHECK (payment_status IN ('PENDING_PAYMENT', 'PAID', 'FAILED', 'REFUNDED')) (nullable)
- `payment_gateway_reference` TEXT (nullable)
- `payment_response_data` JSONB (nullable)
- `transaction_id` TEXT (nullable)
- `status` TEXT NOT NULL DEFAULT 'PENDING_AMBASSADOR' CHECK (status IN (...)) (complex, source-dependent)
- `cancellation_reason` TEXT (nullable)
- `notes` TEXT (nullable, JSON string)
- `assigned_at` TIMESTAMP WITH TIME ZONE (nullable)
- `accepted_at` TIMESTAMP WITH TIME ZONE (nullable)
- `completed_at` TIMESTAMP WITH TIME ZONE (nullable)
- `cancelled_at` TIMESTAMP WITH TIME ZONE (nullable)
- `created_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `updated_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- **Indexes:** Multiple (see performance section)
- **RLS:** Enabled
- **Triggers:** `order_action_logger`, `order_creation_logger`, `validate_order_status_trigger`

**`order_passes`** (Pass Details Per Order)
- `id` UUID PRIMARY KEY
- `order_id` UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE
- `pass_type` TEXT NOT NULL
- `quantity` INTEGER DEFAULT 1 CHECK (quantity > 0)
- `price` NUMERIC(10, 2) NOT NULL CHECK (price >= 0)
- `created_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `updated_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- **Indexes:** `idx_order_passes_order_id`, `idx_order_passes_pass_type`
- **RLS:** Enabled

**`tickets`** (Generated Tickets with QR Codes)
- `id` UUID PRIMARY KEY
- `order_id` UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE
- `order_pass_id` UUID NOT NULL REFERENCES order_passes(id) ON DELETE CASCADE
- `secure_token` TEXT NOT NULL UNIQUE
- `qr_code_url` TEXT (nullable)
- `status` TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'GENERATED', 'DELIVERED', 'FAILED'))
- `email_delivery_status` TEXT CHECK (email_delivery_status IN ('pending', 'sent', 'failed', 'pending_retry'))
- `created_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `updated_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `generated_at` TIMESTAMP WITH TIME ZONE (nullable)
- `delivered_at` TIMESTAMP WITH TIME ZONE (nullable)
- **Indexes:** `idx_tickets_order_id`, `idx_tickets_order_pass_id`, `idx_tickets_secure_token`, `idx_tickets_status`, `idx_tickets_email_delivery_status`
- **RLS:** Enabled

**`scans`** (Ticket Scan Records)
- `id` UUID PRIMARY KEY
- `ticket_id` UUID REFERENCES **pass_purchases(id)** ON DELETE CASCADE ⚠️ **CRITICAL: References non-existent table**
- `event_id` UUID REFERENCES events(id) ON DELETE CASCADE
- `ambassador_id` UUID REFERENCES ambassadors(id) ON DELETE SET NULL
- `scan_time` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `scan_location` TEXT (nullable)
- `device_info` TEXT (nullable)
- `scan_result` TEXT CHECK (scan_result IN ('valid', 'invalid', 'already_scanned', 'expired'))
- `notes` TEXT (nullable)
- `created_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `updated_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- **Indexes:** `idx_scans_ticket_id`, `idx_scans_event_id`, `idx_scans_ambassador_id`, `idx_scans_scan_time`, `idx_scans_scan_result`
- **RLS:** Enabled

**`clients`** (Customer Information - Legacy?)
- `id` UUID PRIMARY KEY
- `ambassador_id` UUID REFERENCES ambassadors(id) ON DELETE CASCADE
- `event_id` UUID REFERENCES events(id) ON DELETE CASCADE
- `full_name` TEXT NOT NULL
- `phone` TEXT NOT NULL
- `email` TEXT (nullable)
- `age` INTEGER (nullable)
- `standard_tickets` INTEGER DEFAULT 0
- `vip_tickets` INTEGER DEFAULT 0
- `total_amount` DECIMAL(10,2) NOT NULL
- `created_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `updated_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- **Indexes:** `idx_clients_ambassador_id`, `idx_clients_event_id`
- **RLS:** Enabled
- **Note:** May be deprecated in favor of `orders` table

#### **Reference Data Tables**

**`cities`** (City Reference Data)
- `id` UUID PRIMARY KEY
- `name` TEXT NOT NULL UNIQUE
- `created_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `updated_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- **RLS:** Enabled

**`villes`** (Neighborhood Reference Data)
- `id` UUID PRIMARY KEY
- `name` TEXT NOT NULL
- `city_id` UUID REFERENCES cities(id) ON DELETE CASCADE
- `created_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `updated_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- **UNIQUE:** (name, city_id)
- **RLS:** Enabled

#### **Junction Tables**

**`ambassador_events`** (Ambassador-Event Assignments)
- `ambassador_id` UUID REFERENCES ambassadors(id) ON DELETE CASCADE
- `event_id` UUID REFERENCES events(id) ON DELETE CASCADE
- `assigned_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- **PRIMARY KEY:** (ambassador_id, event_id)
- **Indexes:** `idx_ambassador_events_ambassador_id`, `idx_ambassador_events_event_id`
- **RLS:** Enabled

**`ambassador_performance`** (Ambassador Performance Metrics)
- `id` UUID PRIMARY KEY
- `ambassador_id` UUID REFERENCES ambassadors(id) ON DELETE CASCADE
- `event_id` UUID REFERENCES events(id) ON DELETE CASCADE
- `sales_count` INTEGER DEFAULT 0
- `revenue_generated` DECIMAL(10,2) DEFAULT 0.00
- `commission_earned` DECIMAL(10,2) DEFAULT 0.00
- `rank` INTEGER (nullable)
- `created_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `updated_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- **Indexes:** `idx_ambassador_performance_ambassador_id`, `idx_ambassador_performance_event_id`
- **RLS:** Enabled

**`round_robin_tracker`** (Order Assignment Tracking)
- `id` UUID PRIMARY KEY
- `ville` TEXT NOT NULL
- `last_assigned_ambassador_id` UUID REFERENCES ambassadors(id) ON DELETE SET NULL
- `last_assigned_at` TIMESTAMP WITH TIME ZONE (nullable)
- `rotation_mode` TEXT DEFAULT 'automatic' CHECK (rotation_mode IN ('automatic', 'manual'))
- `created_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `updated_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- **UNIQUE:** (ville)
- **Indexes:** `idx_round_robin_ville`, `idx_round_robin_ambassador`
- **RLS:** Enabled

#### **Logging & Tracking Tables**

**`order_logs`** (Order Action History)
- `id` UUID PRIMARY KEY
- `order_id` UUID REFERENCES orders(id) ON DELETE CASCADE
- `action` TEXT NOT NULL CHECK (action IN ('created', 'assigned', 'accepted', 'cancelled', 'auto_reassigned', 'completed', 'manual_order_created', 'admin_reassigned', 'admin_cancelled', 'admin_refunded', 'admin_flagged_fraud', 'email_sent', 'email_failed', 'sms_sent', 'sms_failed', 'status_changed'))
- `performed_by` UUID (nullable)
- `performed_by_type` TEXT CHECK (performed_by_type IN ('ambassador', 'admin', 'system'))
- `details` JSONB (nullable)
- `created_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- **Indexes:** `idx_order_logs_order_id`, `idx_order_logs_action`, `idx_order_logs_created_at`, `idx_order_logs_performed_by`
- **RLS:** Enabled

**`email_delivery_logs`** (Email Tracking)
- `id` UUID PRIMARY KEY
- `order_id` UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE
- `email_type` TEXT NOT NULL DEFAULT 'order_completion'
- `recipient_email` TEXT NOT NULL
- `recipient_name` TEXT (nullable)
- `subject` TEXT NOT NULL
- `status` TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'pending_retry'))
- `error_message` TEXT (nullable)
- `sent_at` TIMESTAMP WITH TIME ZONE (nullable)
- `retry_count` INTEGER DEFAULT 0
- `created_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `updated_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- **Indexes:** `idx_email_delivery_logs_order_id`, `idx_email_delivery_logs_status`, `idx_email_delivery_logs_email_type`, `idx_email_delivery_logs_created_at`
- **RLS:** Enabled

**`email_tracking`** (Email Open Tracking)
- `id` UUID PRIMARY KEY
- `ambassador_id` UUID REFERENCES ambassadors(id) ON DELETE CASCADE
- `email_type` TEXT NOT NULL CHECK (email_type IN ('approval', 'rejection', 'reset'))
- `opened_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `user_agent` TEXT (nullable)
- `ip_address` TEXT (nullable)
- `created_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- **Indexes:** `idx_email_tracking_ambassador_id`, `idx_email_tracking_email_type`, `idx_email_tracking_opened_at`
- **RLS:** Enabled

**`sms_logs`** (SMS Delivery Logs)
- `id` UUID PRIMARY KEY
- `phone_number` TEXT NOT NULL
- `message` TEXT NOT NULL
- `status` TEXT CHECK (status IN ('pending', 'sent', 'failed')) DEFAULT 'pending'
- `api_response` TEXT (nullable)
- `error_message` TEXT (nullable)
- `sent_at` TIMESTAMP WITH TIME ZONE (nullable)
- `created_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
- **Indexes:** `idx_sms_logs_phone_number`, `idx_sms_logs_status`, `idx_sms_logs_created_at`
- **RLS:** Enabled

**`site_logs`** (Website Activity Logs)
- `id` UUID PRIMARY KEY
- `log_type` TEXT NOT NULL CHECK (log_type IN ('info', 'warning', 'error', 'success', 'action'))
- `category` TEXT NOT NULL
- `message` TEXT NOT NULL
- `details` JSONB (nullable)
- `user_id` UUID (nullable)
- `user_type` TEXT CHECK (user_type IN ('admin', 'ambassador', 'guest'))
- `ip_address` TEXT (nullable)
- `user_agent` TEXT (nullable)
- `page_url` TEXT (nullable)
- `request_method` TEXT (nullable)
- `request_path` TEXT (nullable)
- `response_status` INTEGER (nullable)
- `error_stack` TEXT (nullable)
- `created_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- **Indexes:** `idx_site_logs_log_type`, `idx_site_logs_category`, `idx_site_logs_created_at`, `idx_site_logs_user_id`, `idx_site_logs_user_type`
- **RLS:** Enabled

#### **Content Management Tables**

**`gallery`** (Event Gallery)
- `id` UUID PRIMARY KEY
- `title` TEXT NOT NULL
- `image_url` TEXT NOT NULL
- `video_url` TEXT (nullable)
- `event_id` UUID REFERENCES events(id) ON DELETE SET NULL
- `city` TEXT (nullable)
- `type` TEXT CHECK (type IN ('photo', 'video')) DEFAULT 'photo'
- `created_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- **RLS:** Enabled

**`sponsors`** (Sponsor Information)
- `id` UUID PRIMARY KEY
- `name` TEXT NOT NULL
- `logo_url` TEXT (nullable)
- `description` TEXT (nullable)
- `category` TEXT CHECK (category IN ('venue', 'brand', 'tech', 'other')) DEFAULT 'other'
- `website_url` TEXT (nullable)
- `is_global` BOOLEAN (nullable, added later)
- `created_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- **RLS:** Enabled

**`site_content`** (Dynamic Content Management)
- `id` UUID PRIMARY KEY
- `key` TEXT NOT NULL UNIQUE
- `content` JSONB NOT NULL
- `updated_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- **RLS:** Enabled

**`contact_messages`** (Contact Form Submissions)
- `id` UUID PRIMARY KEY
- `name` TEXT NOT NULL
- `email` TEXT NOT NULL
- `subject` TEXT NOT NULL
- `message` TEXT NOT NULL
- `status` TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'responded'))
- `created_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
- **RLS:** Enabled

#### **Subscriber Tables**

**`newsletter_subscribers`** (Email Subscribers)
- `id` UUID PRIMARY KEY
- `email` TEXT NOT NULL UNIQUE
- `language` TEXT CHECK (language IN ('en', 'fr')) DEFAULT 'en'
- `subscribed_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
- **RLS:** Enabled

**`phone_subscribers`** (SMS Subscribers)
- `id` UUID PRIMARY KEY
- `phone_number` TEXT NOT NULL UNIQUE
- `language` TEXT CHECK (language IN ('en', 'fr')) DEFAULT 'en'
- `subscribed_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
- `created_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
- **Indexes:** `idx_phone_subscribers_phone_number`, `idx_phone_subscribers_subscribed_at`
- **RLS:** Enabled

#### **Legacy/Unused Tables**

**`admin_users`** (Legacy Admin Table?)
- `id` UUID PRIMARY KEY
- `email` TEXT NOT NULL UNIQUE
- `name` TEXT NOT NULL
- `role` TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin'))
- `created_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
- **Note:** May be duplicate of `admins` table
- **RLS:** Enabled

**`pass_purchases`** ⚠️ **CRITICAL: Referenced but NOT CREATED**
- Referenced in `scans` table foreign key
- Referenced in `server.cjs` ticket validation endpoint
- **NO MIGRATION CREATES THIS TABLE**
- Should likely be replaced by `tickets` table

### 1.2 Primary Keys, Foreign Keys, Unique Constraints

#### **Primary Keys**
All tables use UUID PRIMARY KEYs (good practice)

#### **Foreign Keys**
- ✅ Most foreign keys properly defined with ON DELETE CASCADE/SET NULL
- ⚠️ **CRITICAL:** `scans.ticket_id` references `pass_purchases(id)` which doesn't exist
- ⚠️ Some foreign keys may lack indexes (see performance section)

#### **Unique Constraints**
- `admins.email` UNIQUE
- `ambassadors.phone` UNIQUE
- `newsletter_subscribers.email` UNIQUE
- `phone_subscribers.phone_number` UNIQUE
- `site_content.key` UNIQUE
- `tickets.secure_token` UNIQUE
- `round_robin_tracker.ville` UNIQUE
- `villes(name, city_id)` UNIQUE
- `ambassador_events(ambassador_id, event_id)` PRIMARY KEY (implicit unique)

### 1.3 Indexes

#### **Existing Indexes** (from migration `20250104000000-add-performance-indexes.sql`)
- ✅ Most foreign keys have indexes
- ✅ Frequently queried columns have indexes
- ✅ Composite indexes for common query patterns

#### **Missing Indexes** (see Performance Analysis section)

### 1.4 Triggers and Functions

#### **Triggers**
1. `update_updated_at_column()` - Updates `updated_at` on various tables
2. `order_action_logger` - Logs order status changes
3. `order_creation_logger` - Logs order creation
4. `validate_order_status_trigger` - Validates order status based on source
5. `generate_qr_code_trigger` - Auto-generates QR codes (on `pass_purchases` - table doesn't exist)

#### **Functions**
1. `update_updated_at_column()` - Trigger function for timestamps
2. `assign_order_to_ambassador(p_order_id, p_ville)` - Round-robin assignment
3. `auto_reassign_ignored_orders(p_ignore_minutes)` - Auto-reassignment logic
4. `get_next_ambassador_for_ville(p_ville)` - Preview next ambassador
5. `log_order_action()` - Logs order actions
6. `log_order_creation()` - Logs order creation
7. `validate_order_status()` - Validates order status
8. `cleanup_old_logs(days_to_keep)` - Log cleanup
9. `get_log_statistics(...)` - Log analytics
10. `detect_suspicious_activity(...)` - Security monitoring
11. `get_user_journey(...)` - User analytics

### 1.5 RLS Policies

#### **Policy Patterns**
- Public read access for non-sensitive data (events, gallery, sponsors)
- Ambassador can view/update own data
- Admin full access via `EXISTS (SELECT 1 FROM admins WHERE ...)`
- Service role bypass for server operations

#### **Potential Issues**
- ⚠️ Some policies use `auth.uid()` which may not work with JWT-based auth (admins/ambassadors use custom JWT, not Supabase Auth)
- ⚠️ Some policies allow `true` (public access) which may be too permissive
- ⚠️ Policies reference `pass_purchases` table that doesn't exist

---

## 2. ENTITY RELATIONSHIP DIAGRAM

### 2.1 Text ER Diagram

```
┌─────────────────┐
│     admins      │
│─────────────────│
│ id (PK)         │
│ email (UQ)      │
│ password        │
│ role            │
└─────────────────┘
         │
         │ (approved_by)
         │
         ▼
┌─────────────────┐
│   ambassadors   │
│─────────────────│
│ id (PK)         │◄─────┐
│ phone (UQ)      │      │
│ status          │      │
│ ville           │      │
└─────────────────┘      │
         │                │
         │                │
    ┌────┴────┬────────────┼────────────┐
    │        │            │            │
    │        │            │            │
    ▼        ▼            ▼            ▼
┌────────┐ ┌──────────┐ ┌──────┐ ┌──────────────┐
│ orders │ │ clients  │ │scans │ │ambassador_   │
│        │ │          │ │      │ │events        │
│        │ │          │ │      │ │              │
│        │ │          │ │      │ │              │
└────────┘ └──────────┘ └──────┘ └──────────────┘
    │
    │ (order_id)
    │
    ├──────────────┬──────────────┐
    │              │              │
    ▼              ▼              ▼
┌─────────────┐ ┌──────────┐ ┌──────────────┐
│order_passes │ │ tickets  │ │order_logs    │
│             │ │          │ │              │
│             │ │          │ │              │
└─────────────┘ └──────────┘ └──────────────┘
    │
    │ (order_pass_id)
    │
    ▼
┌──────────┐
│ tickets  │
│          │
│          │
└──────────┘
    │
    │ (ticket_id) ⚠️ REFERENCES pass_purchases (DOESN'T EXIST)
    │
    ▼
┌──────────┐
│  scans   │
│          │
└──────────┘

┌──────────┐
│  events  │◄──────┐
│          │       │
└──────────┘       │
    │              │
    │ (event_id)   │ (event_id)
    │              │
    ├──────────────┼──────────────┐
    │              │              │
    ▼              ▼              ▼
┌──────────┐ ┌──────────┐ ┌──────────────┐
│ orders   │ │ clients  │ │ambassador_   │
│          │ │          │ │performance   │
└──────────┘ └──────────┘ └──────────────┘

┌──────────┐
│ cities   │
│          │
└──────────┘
    │
    │ (city_id)
    │
    ▼
┌──────────┐
│ villes   │
│          │
└──────────┘
    │
    │ (ville_id)
    │
    ▼
┌──────────┐
│ orders   │
│          │
└──────────┘

┌─────────────────┐
│round_robin_     │
│tracker          │
│─────────────────│
│ville (UQ)       │
│last_assigned_   │
│ambassador_id    │
└─────────────────┘
```

### 2.2 Relationship Types

**One-to-Many (1:N)**
- `admins` → `ambassadors` (approved_by)
- `ambassadors` → `orders` (ambassador_id)
- `ambassadors` → `clients` (ambassador_id)
- `ambassadors` → `scans` (ambassador_id)
- `events` → `orders` (event_id)
- `events` → `clients` (event_id)
- `events` → `gallery` (event_id)
- `events` → `ambassador_performance` (event_id)
- `orders` → `order_passes` (order_id)
- `orders` → `tickets` (order_id)
- `orders` → `order_logs` (order_id)
- `orders` → `email_delivery_logs` (order_id)
- `order_passes` → `tickets` (order_pass_id)
- `cities` → `villes` (city_id)
- `cities` → `orders` (city_id)
- `villes` → `orders` (ville_id)

**Many-to-Many (N:M)**
- `ambassadors` ↔ `events` (via `ambassador_events`)

**One-to-One (1:1)**
- None explicitly defined

### 2.3 Orphan/Unreferenced Tables

- ⚠️ **`clients`** - May be deprecated in favor of `orders` table
- ⚠️ **`admin_users`** - May be duplicate of `admins` table
- ⚠️ **`pass_purchases`** - Referenced but doesn't exist

### 2.4 Normalization Issues

**Violations:**

1. **1NF Violation:** `orders.notes` stores JSON string (should be normalized or use JSONB properly)
2. **2NF Violation:** `orders` table has redundant city/ville text fields alongside `city_id`/`ville_id` foreign keys
3. **3NF Violation:** `orders.pass_type` duplicates data that should be in `order_passes` table

---

## 3. CROSS-CODEBASE ANALYSIS

### 3.1 Backend Endpoints vs Database Fields

#### **Mismatches Found:**

1. **`server.cjs` line 1035:** Queries `pass_purchases` table
   - **Issue:** Table doesn't exist in migrations
   - **Expected:** Should query `tickets` table instead
   - **Impact:** Ticket validation endpoint will fail

2. **`orders` table column inconsistencies:**
   - Code references `user_name`, `user_phone`, `user_email`
   - Migrations show `customer_name`, `phone`, `email` were removed
   - But `user_name`, `user_phone`, `user_email` may not exist or are nullable
   - **Impact:** Order creation/retrieval may fail

3. **`scans.ticket_id` foreign key:**
   - References `pass_purchases(id)`
   - Should reference `tickets(id)`
   - **Impact:** Foreign key constraint will fail, scans cannot be created

### 3.2 Unused or Missing Fields

#### **Potentially Unused:**
- `clients` table (may be replaced by `orders`)
- `admin_users` table (may be duplicate of `admins`)
- `orders.pass_type` (deprecated, use `order_passes`)

#### **Missing Fields Expected by Code:**
- `orders.user_name` (nullable, may cause issues)
- `orders.user_phone` (nullable, may cause issues)
- `orders.user_email` (nullable, may cause issues)
- `pass_purchases` table (entire table missing)

### 3.3 Potential Bugs from Schema Inconsistencies

1. **Ticket Validation Fails**
   - Code queries `pass_purchases` table
   - Table doesn't exist
   - **Fix:** Update code to use `tickets` table

2. **Order Creation Fails**
   - Code expects `user_name`, `user_phone`, `user_email`
   - Columns may not exist or are nullable
   - **Fix:** Ensure columns exist and are NOT NULL

3. **Scan Creation Fails**
   - Foreign key references non-existent `pass_purchases`
   - **Fix:** Update foreign key to reference `tickets(id)`

4. **RLS Policies Fail**
   - Policies use `auth.uid()` but app uses custom JWT
   - **Fix:** Update policies to use JWT claims or service role

### 3.4 Duplicated/Redundant Tables/Columns

1. **`admins` vs `admin_users`** - Two admin tables, likely duplicate
2. **`orders.customer_name` vs `orders.user_name`** - Column name change, both may exist
3. **`orders.payment_type` vs `orders.payment_method`** - Duplicate columns (payment_type removed)
4. **`orders.pass_type` vs `order_passes.pass_type`** - Redundant (pass_type deprecated)

---

## 4. PERFORMANCE ANALYSIS

### 4.1 Missing Indexes

#### **Critical Missing Indexes:**

1. **`orders` table:**
   - ✅ `idx_orders_ambassador_id` (exists)
   - ✅ `idx_orders_event_id` (exists)
   - ✅ `idx_orders_status` (exists)
   - ⚠️ Missing composite: `(ambassador_id, status, created_at)` for ambassador dashboard queries
   - ⚠️ Missing composite: `(event_id, status, created_at)` for event order lists
   - ⚠️ Missing: `idx_orders_user_phone` (if column exists, for phone lookups)
   - ⚠️ Missing: `idx_orders_user_email` (if column exists, for email lookups)

2. **`tickets` table:**
   - ✅ Most indexes exist
   - ⚠️ Missing composite: `(order_id, status)` for order ticket queries

3. **`scans` table:**
   - ⚠️ Missing composite: `(ticket_id, scan_result)` for duplicate scan checks
   - ⚠️ Missing composite: `(event_id, scan_time)` for event scan reports

4. **`email_delivery_logs` table:**
   - ✅ Most indexes exist
   - ⚠️ Missing composite: `(order_id, status)` for order email status

5. **Foreign Key Indexes:**
   - ✅ Most foreign keys have indexes
   - ⚠️ Check: `orders.city_id`, `orders.ville_id` (may need indexes)

### 4.2 Large Tables Needing Optimization

1. **`order_logs`** - Will grow large over time
   - ✅ Has indexes
   - ⚠️ Consider partitioning by `created_at`
   - ⚠️ Add cleanup function (exists: `cleanup_old_logs`)

2. **`site_logs`** - Will grow very large
   - ✅ Has indexes
   - ⚠️ Consider partitioning
   - ⚠️ Add cleanup function (exists: `cleanup_old_logs`)

3. **`scans`** - Will grow with event attendance
   - ✅ Has indexes
   - ⚠️ Consider archiving old scans

### 4.3 Slow Triggers/Functions

1. **`log_order_action()`** - Runs on every order update
   - May slow down high-volume order updates
   - Consider async logging or batching

2. **`validate_order_status()`** - Runs on every order insert/update
   - Should be fast (simple CHECK)
   - ✅ No performance concerns

3. **`assign_order_to_ambassador()`** - Complex round-robin logic
   - May be slow with many ambassadors
   - Consider caching ambassador lists

---

## 5. ISSUES & RECOMMENDATIONS

### 🔴 CRITICAL ISSUES

#### **C1: Missing `pass_purchases` Table**
- **Location:** Referenced in `scans` table FK and `server.cjs` line 1035
- **Impact:** Ticket validation endpoint fails, scans cannot be created
- **Why it matters:** Core functionality broken
- **Fix:**
  ```sql
  -- Option 1: Create pass_purchases table (if needed for legacy)
  -- Option 2: Update scans.ticket_id to reference tickets(id)
  -- Option 3: Update server.cjs to use tickets table
  ```
- **Migration Required:** Yes
- **Backend Update Required:** Yes (update `server.cjs` ticket validation)
- **Priority:** IMMEDIATE

#### **C2: Foreign Key Constraint Failure**
- **Location:** `scans.ticket_id` REFERENCES `pass_purchases(id)`
- **Impact:** Cannot create scans, foreign key constraint fails
- **Why it matters:** Ticket scanning functionality broken
- **Fix:**
  ```sql
  ALTER TABLE scans DROP CONSTRAINT IF EXISTS scans_ticket_id_fkey;
  ALTER TABLE scans ADD CONSTRAINT scans_ticket_id_fkey 
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE;
  ```
- **Migration Required:** Yes
- **Backend Update Required:** No (if using tickets table)
- **Priority:** IMMEDIATE

#### **C3: Orders Table Column Inconsistencies**
- **Location:** `orders` table - `user_name`, `user_phone`, `user_email` vs `customer_name`, `phone`, `email`
- **Impact:** Order creation/retrieval may fail, data inconsistency
- **Why it matters:** Core order functionality affected
- **Fix:**
  ```sql
  -- Ensure user_name, user_phone, user_email exist and are NOT NULL
  ALTER TABLE orders 
    ADD COLUMN IF NOT EXISTS user_name TEXT,
    ADD COLUMN IF NOT EXISTS user_phone TEXT,
    ADD COLUMN IF NOT EXISTS user_email TEXT;
  
  -- Migrate data from old columns if they exist
  UPDATE orders SET user_name = customer_name WHERE user_name IS NULL;
  UPDATE orders SET user_phone = phone WHERE user_phone IS NULL;
  UPDATE orders SET user_email = email WHERE user_email IS NULL;
  
  -- Make NOT NULL after migration
  ALTER TABLE orders ALTER COLUMN user_name SET NOT NULL;
  ALTER TABLE orders ALTER COLUMN user_phone SET NOT NULL;
  ```
- **Migration Required:** Yes
- **Backend Update Required:** Yes (ensure code uses correct column names)
- **Priority:** HIGH

#### **C4: RLS Policies Using `auth.uid()`**
- **Location:** Multiple RLS policies
- **Impact:** Policies may not work with custom JWT authentication
- **Why it matters:** Security risk, data access issues
- **Fix:** Update policies to use JWT claims or service role
- **Migration Required:** Yes
- **Backend Update Required:** Yes (ensure JWT includes required claims)
- **Priority:** HIGH

### 🟡 HIGH PRIORITY ISSUES

#### **H1: Missing Composite Indexes**
- **Impact:** Slow queries on ambassador dashboard, event order lists
- **Fix:** Add composite indexes (see Performance Analysis)
- **Migration Required:** Yes
- **Backend Update Required:** No
- **Priority:** HIGH

#### **H2: Deprecated Columns Still in Use**
- **Location:** `orders.pass_type` (deprecated, should use `order_passes`)
- **Impact:** Data inconsistency, confusion
- **Fix:** Remove column after migrating all code to `order_passes`
- **Migration Required:** Yes (after code migration)
- **Backend Update Required:** Yes (update all queries)
- **Priority:** MEDIUM-HIGH

#### **H3: Duplicate Admin Tables**
- **Location:** `admins` vs `admin_users`
- **Impact:** Confusion, potential data inconsistency
- **Fix:** Consolidate to single table
- **Migration Required:** Yes
- **Backend Update Required:** Yes
- **Priority:** MEDIUM

#### **H4: Missing NOT NULL Constraints**
- **Location:** Various nullable fields that should be required
- **Impact:** Data quality issues
- **Fix:** Add NOT NULL constraints after data cleanup
- **Migration Required:** Yes
- **Backend Update Required:** No
- **Priority:** MEDIUM

#### **H5: Normalization Violations**
- **Location:** `orders.notes` (JSON string), redundant city/ville columns
- **Impact:** Data inconsistency, harder to query
- **Fix:** Normalize or use JSONB properly, remove redundant columns
- **Migration Required:** Yes
- **Backend Update Required:** Yes
- **Priority:** MEDIUM

### 🟢 MEDIUM PRIORITY ISSUES

#### **M1: Missing Soft Delete Columns**
- **Impact:** Data loss risk, no audit trail
- **Fix:** Add `deleted_at` TIMESTAMP columns
- **Migration Required:** Yes
- **Backend Update Required:** Yes (update queries)
- **Priority:** MEDIUM

#### **M2: Missing Audit Fields**
- **Impact:** No tracking of who created/updated records
- **Fix:** Add `created_by`, `updated_by` UUID columns
- **Migration Required:** Yes
- **Backend Update Required:** Yes
- **Priority:** MEDIUM

#### **M3: Large Tables Need Partitioning**
- **Location:** `order_logs`, `site_logs`
- **Impact:** Performance degradation over time
- **Fix:** Implement table partitioning by date
- **Migration Required:** Yes (complex)
- **Backend Update Required:** No
- **Priority:** LOW-MEDIUM

#### **M4: Missing Database-Level Validation**
- **Impact:** Invalid data can be inserted
- **Fix:** Add CHECK constraints for email format, phone format
- **Migration Required:** Yes
- **Backend Update Required:** No
- **Priority:** LOW-MEDIUM

### 🔵 LOW PRIORITY ISSUES

#### **L1: Inconsistent Naming Conventions**
- **Impact:** Code readability, maintenance
- **Fix:** Standardize to snake_case for SQL
- **Migration Required:** Yes (renaming)
- **Backend Update Required:** Yes
- **Priority:** LOW

#### **L2: Missing Table Comments**
- **Impact:** Documentation
- **Fix:** Add COMMENT ON TABLE/COLUMN statements
- **Migration Required:** Yes
- **Backend Update Required:** No
- **Priority:** LOW

#### **L3: Unused Tables**
- **Location:** `clients` (may be deprecated)
- **Impact:** Confusion, maintenance overhead
- **Fix:** Remove if truly unused
- **Migration Required:** Yes
- **Backend Update Required:** Yes
- **Priority:** LOW

---

## 📊 SUMMARY STATISTICS

- **Total Tables:** 25+
- **Total Indexes:** 50+
- **Total Functions:** 11
- **Total Triggers:** 5+
- **Critical Issues:** 4
- **High Priority Issues:** 5
- **Medium Priority Issues:** 4
- **Low Priority Issues:** 3

---

## ✅ RECOMMENDED ACTION PLAN

### Phase 1: Critical Fixes (IMMEDIATE)
1. Fix `pass_purchases` table issue (create table OR update references)
2. Fix `scans.ticket_id` foreign key
3. Fix `orders` column inconsistencies
4. Fix RLS policies for JWT auth

### Phase 2: High Priority (THIS WEEK)
1. Add missing composite indexes
2. Remove deprecated columns
3. Consolidate admin tables
4. Add missing NOT NULL constraints

### Phase 3: Medium Priority (THIS MONTH)
1. Add soft delete columns
2. Add audit fields
3. Implement table partitioning
4. Add database-level validation

### Phase 4: Low Priority (NEXT SPRINT)
1. Standardize naming conventions
2. Add table comments
3. Remove unused tables

---

## ⚠️ IMPORTANT NOTES

1. **DO NOT apply migrations without testing** - Some fixes may require data migration
2. **Backup database before changes** - Critical fixes may affect existing data
3. **Test RLS policies** - JWT-based auth may require policy updates
4. **Update TypeScript types** - After schema changes, regenerate types
5. **Coordinate backend updates** - Some fixes require simultaneous code changes

---

**END OF REPORT**

