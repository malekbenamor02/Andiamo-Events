-- ============================================
-- Fix RLS Performance and Security Issues
-- ============================================
-- This migration fixes:
-- 1. Auth RLS Initialization Plan issues (wrap auth functions in SELECT)
-- 2. Multiple permissive policies (consolidate into single policies)
-- ============================================

-- ============================================
-- GALLERY TABLE
-- ============================================
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.gallery;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.gallery;
DROP POLICY IF EXISTS "Allow authenticated delete" ON public.gallery;
DROP POLICY IF EXISTS "Allow public read access" ON public.gallery;
DROP POLICY IF EXISTS "Public can view gallery" ON public.gallery;

CREATE POLICY "gallery_public_select" ON public.gallery
  FOR SELECT USING (true);

CREATE POLICY "gallery_authenticated_modify" ON public.gallery
  FOR ALL
  USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- ============================================
-- CONTACT_MESSAGES TABLE
-- ============================================
DROP POLICY IF EXISTS "Admins can view contact messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.contact_messages;
DROP POLICY IF EXISTS "Anyone can submit contact messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Anyone can view contact messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Allow insert for anonymous users" ON public.contact_messages;

CREATE POLICY "contact_messages_insert" ON public.contact_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "contact_messages_select" ON public.contact_messages
  FOR SELECT USING (true);

-- ============================================
-- AMBASSADOR_APPLICATIONS TABLE
-- ============================================
DROP POLICY IF EXISTS "Admins can view applications" ON public.ambassador_applications;
DROP POLICY IF EXISTS "Allow all operations on ambassador_applications" ON public.ambassador_applications;
DROP POLICY IF EXISTS "Anyone can submit ambassador applications" ON public.ambassador_applications;
DROP POLICY IF EXISTS "Public can check existing applications by phone" ON public.ambassador_applications;

CREATE POLICY "ambassador_applications_select" ON public.ambassador_applications
  FOR SELECT USING (true);

CREATE POLICY "ambassador_applications_insert" ON public.ambassador_applications
  FOR INSERT WITH CHECK (true);

-- ============================================
-- EMAIL_TRACKING TABLE
-- ============================================
DROP POLICY IF EXISTS "Admins can view all email tracking" ON public.email_tracking;
DROP POLICY IF EXISTS "Ambassadors can view their own email tracking" ON public.email_tracking;

CREATE POLICY "email_tracking_select" ON public.email_tracking
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admins 
      WHERE id = (SELECT auth.uid())
    ) OR
    ambassador_id = (SELECT auth.uid())::uuid
  );

-- ============================================
-- PHONE_SUBSCRIBERS TABLE
-- ============================================
DROP POLICY IF EXISTS "Admins can delete phone subscribers" ON public.phone_subscribers;
DROP POLICY IF EXISTS "Admins can view all phone subscribers" ON public.phone_subscribers;
DROP POLICY IF EXISTS "Allow phone subscriber inserts" ON public.phone_subscribers;
DROP POLICY IF EXISTS "Allow viewing phone subscribers" ON public.phone_subscribers;
DROP POLICY IF EXISTS "Public can insert phone subscribers" ON public.phone_subscribers;

CREATE POLICY "phone_subscribers_select" ON public.phone_subscribers
  FOR SELECT USING (true);

CREATE POLICY "phone_subscribers_insert" ON public.phone_subscribers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "phone_subscribers_delete" ON public.phone_subscribers
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.admins 
      WHERE id = (SELECT auth.uid())
    )
  );

-- ============================================
-- EVENTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Enable all operations for events" ON public.events;
DROP POLICY IF EXISTS "Public can view events" ON public.events;

CREATE POLICY "events_select" ON public.events
  FOR SELECT USING (true);

-- ============================================
-- SITE_LOGS TABLE
-- ============================================
DROP POLICY IF EXISTS "Allow public log inserts" ON public.site_logs;
DROP POLICY IF EXISTS "Allow service role to insert logs" ON public.site_logs;
DROP POLICY IF EXISTS "Allow authenticated users to view site logs" ON public.site_logs;
DROP POLICY IF EXISTS "Admins can view all site logs" ON public.site_logs;

CREATE POLICY "site_logs_select" ON public.site_logs
  FOR SELECT USING (true);

CREATE POLICY "site_logs_insert" ON public.site_logs
  FOR INSERT WITH CHECK (true);

-- ============================================
-- SCANS TABLE
-- ============================================
DROP POLICY IF EXISTS "Ambassadors can view their own scans" ON public.scans;
DROP POLICY IF EXISTS "Ambassadors can insert scans" ON public.scans;
DROP POLICY IF EXISTS "Admins can view all scans" ON public.scans;
DROP POLICY IF EXISTS "Admins can manage all scans" ON public.scans;

CREATE POLICY "scans_select" ON public.scans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admins 
      WHERE id = (SELECT auth.uid())
    ) OR
    ambassador_id = (SELECT auth.uid())::uuid
  );

CREATE POLICY "scans_insert" ON public.scans
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admins 
      WHERE id = (SELECT auth.uid())
    ) OR
    ambassador_id = (SELECT auth.uid())::uuid
  );

CREATE POLICY "scans_admin_all" ON public.scans
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admins 
      WHERE id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admins 
      WHERE id = (SELECT auth.uid())
    )
  );

-- ============================================
-- AMBASSADORS TABLE
-- ============================================
DROP POLICY IF EXISTS "Ambassadors can view own data" ON public.ambassadors;
DROP POLICY IF EXISTS "Ambassadors can update own data" ON public.ambassadors;
DROP POLICY IF EXISTS "Anyone can insert ambassador applications" ON public.ambassadors;
DROP POLICY IF EXISTS "Admin can view all ambassadors" ON public.ambassadors;
DROP POLICY IF EXISTS "Public can check existing ambassadors by phone" ON public.ambassadors;

CREATE POLICY "ambassadors_select" ON public.ambassadors
  FOR SELECT USING (true);

CREATE POLICY "ambassadors_insert" ON public.ambassadors
  FOR INSERT WITH CHECK (true);

CREATE POLICY "ambassadors_update" ON public.ambassadors
  FOR UPDATE USING (true)
  WITH CHECK (true);

-- ============================================
-- CLIENTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Ambassadors can view own clients" ON public.clients;
DROP POLICY IF EXISTS "Ambassadors can insert own clients" ON public.clients;
DROP POLICY IF EXISTS "Admin can view all clients" ON public.clients;

CREATE POLICY "clients_select" ON public.clients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admins 
      WHERE id = (SELECT auth.uid())
    ) OR
    ambassador_id = (SELECT auth.uid())::uuid
  );

CREATE POLICY "clients_insert" ON public.clients
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admins 
      WHERE id = (SELECT auth.uid())
    ) OR
    ambassador_id = (SELECT auth.uid())::uuid
  );

-- ============================================
-- PASS_PURCHASES TABLE (if exists)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pass_purchases') THEN
    DROP POLICY IF EXISTS "Admins can view all pass purchases" ON public.pass_purchases;
    DROP POLICY IF EXISTS "Admins can manage pass purchases" ON public.pass_purchases;
    DROP POLICY IF EXISTS "Public can insert pass purchases" ON public.pass_purchases;
    DROP POLICY IF EXISTS "Customers can view their own purchases" ON public.pass_purchases;

    CREATE POLICY "pass_purchases_select" ON public.pass_purchases
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.admins 
          WHERE id = (SELECT auth.uid())
        ) OR
        customer_email = (SELECT auth.jwt()) ->> 'email'
      );

    CREATE POLICY "pass_purchases_insert" ON public.pass_purchases
      FOR INSERT WITH CHECK (true);

    CREATE POLICY "pass_purchases_modify" ON public.pass_purchases
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.admins 
          WHERE id = (SELECT auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.admins 
          WHERE id = (SELECT auth.uid())
        )
      );
  END IF;
END $$;

-- ============================================
-- CONDITIONAL TABLES (only if they exist)
-- ============================================

-- QR_CODES, QR_SCANS, AMBASSADOR_AREAS, PURCHASE_REQUESTS, 
-- AMBASSADOR_SALES, AMBASSADOR_CREDENTIALS, AREAS
-- These are handled conditionally below

DO $$
BEGIN
  -- QR_CODES
  IF EXISTS (
    SELECT 1 FROM information_schema.tables t
    JOIN information_schema.columns c ON c.table_name = t.table_name AND c.table_schema = t.table_schema
    WHERE t.table_schema = 'public' AND t.table_name = 'qr_codes' AND c.column_name = 'ambassador_id'
  ) THEN
    DROP POLICY IF EXISTS "Admins can manage all QR codes" ON public.qr_codes;
    DROP POLICY IF EXISTS "Ambassadors can view assigned QR codes" ON public.qr_codes;
    DROP POLICY IF EXISTS "Public can insert QR codes" ON public.qr_codes;
    
    CREATE POLICY "qr_codes_select" ON public.qr_codes FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.admins WHERE id = (SELECT auth.uid())) OR
      ambassador_id = (SELECT auth.uid())::uuid
    );
    CREATE POLICY "qr_codes_insert" ON public.qr_codes FOR INSERT WITH CHECK (true);
  END IF;

  -- QR_SCANS
  IF EXISTS (
    SELECT 1 FROM information_schema.tables t
    JOIN information_schema.columns c ON c.table_name = t.table_name AND c.table_schema = t.table_schema
    WHERE t.table_schema = 'public' AND t.table_name = 'qr_scans' AND c.column_name = 'ambassador_id'
  ) THEN
    DROP POLICY IF EXISTS "Admins can manage all QR scans" ON public.qr_scans;
    DROP POLICY IF EXISTS "Ambassadors can insert QR scans" ON public.qr_scans;
    DROP POLICY IF EXISTS "Ambassadors can view QR scans" ON public.qr_scans;
    
    CREATE POLICY "qr_scans_select" ON public.qr_scans FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.admins WHERE id = (SELECT auth.uid())) OR
      ambassador_id = (SELECT auth.uid())::uuid
    );
    CREATE POLICY "qr_scans_insert" ON public.qr_scans FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.admins WHERE id = (SELECT auth.uid())) OR
      ambassador_id = (SELECT auth.uid())::uuid
    );
  END IF;

  -- AMBASSADOR_AREAS
  IF EXISTS (
    SELECT 1 FROM information_schema.tables t
    JOIN information_schema.columns c ON c.table_name = t.table_name AND c.table_schema = t.table_schema
    WHERE t.table_schema = 'public' AND t.table_name = 'ambassador_areas' AND c.column_name = 'ambassador_id'
  ) THEN
    DROP POLICY IF EXISTS "Admins can manage all ambassador areas" ON public.ambassador_areas;
    DROP POLICY IF EXISTS "Ambassadors can view own areas" ON public.ambassador_areas;
    
    CREATE POLICY "ambassador_areas_select" ON public.ambassador_areas FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.admins WHERE id = (SELECT auth.uid())) OR
      ambassador_id = (SELECT auth.uid())::uuid
    );
  END IF;

  -- PURCHASE_REQUESTS
  IF EXISTS (
    SELECT 1 FROM information_schema.tables t
    JOIN information_schema.columns c ON c.table_name = t.table_name AND c.table_schema = t.table_schema
    WHERE t.table_schema = 'public' AND t.table_name = 'purchase_requests' AND c.column_name = 'ambassador_id'
  ) THEN
    DROP POLICY IF EXISTS "Admins can manage all purchase requests" ON public.purchase_requests;
    DROP POLICY IF EXISTS "Ambassadors can view assigned requests" ON public.purchase_requests;
    DROP POLICY IF EXISTS "Ambassadors can update assigned requests" ON public.purchase_requests;
    DROP POLICY IF EXISTS "Public can insert purchase requests" ON public.purchase_requests;
    
    CREATE POLICY "purchase_requests_select" ON public.purchase_requests FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.admins WHERE id = (SELECT auth.uid())) OR
      ambassador_id = (SELECT auth.uid())::uuid
    );
    CREATE POLICY "purchase_requests_insert" ON public.purchase_requests FOR INSERT WITH CHECK (true);
    CREATE POLICY "purchase_requests_update" ON public.purchase_requests FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.admins WHERE id = (SELECT auth.uid())) OR
      ambassador_id = (SELECT auth.uid())::uuid
    );
  END IF;

  -- AMBASSADOR_SALES
  IF EXISTS (
    SELECT 1 FROM information_schema.tables t
    JOIN information_schema.columns c ON c.table_name = t.table_name AND c.table_schema = t.table_schema
    WHERE t.table_schema = 'public' AND t.table_name = 'ambassador_sales' AND c.column_name = 'ambassador_id'
  ) THEN
    DROP POLICY IF EXISTS "ambassador_sales_admin_all" ON public.ambassador_sales;
    DROP POLICY IF EXISTS "ambassador_sales_ambassador_view" ON public.ambassador_sales;
    DROP POLICY IF EXISTS "ambassador_sales_ambassador_insert" ON public.ambassador_sales;
    DROP POLICY IF EXISTS "ambassador_sales_ambassador_update" ON public.ambassador_sales;
    DROP POLICY IF EXISTS "ambassador_sales_ambassador_delete" ON public.ambassador_sales;
    
    CREATE POLICY "ambassador_sales_select" ON public.ambassador_sales FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.admins WHERE id = (SELECT auth.uid())) OR
      ambassador_id = (SELECT auth.uid())::uuid
    );
    CREATE POLICY "ambassador_sales_insert" ON public.ambassador_sales FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.admins WHERE id = (SELECT auth.uid())) OR
      ambassador_id = (SELECT auth.uid())::uuid
    );
    CREATE POLICY "ambassador_sales_update" ON public.ambassador_sales FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.admins WHERE id = (SELECT auth.uid())) OR
      ambassador_id = (SELECT auth.uid())::uuid
    );
    CREATE POLICY "ambassador_sales_delete" ON public.ambassador_sales FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.admins WHERE id = (SELECT auth.uid())) OR
      ambassador_id = (SELECT auth.uid())::uuid
    );
  END IF;

  -- AMBASSADOR_CREDENTIALS
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ambassador_credentials') THEN
    DROP POLICY IF EXISTS "Admins can view all credentials" ON public.ambassador_credentials;
    DROP POLICY IF EXISTS "Admins can insert credentials" ON public.ambassador_credentials;
    DROP POLICY IF EXISTS "Admins can update credentials" ON public.ambassador_credentials;
    DROP POLICY IF EXISTS "Admins can delete credentials" ON public.ambassador_credentials;
    
    CREATE POLICY "ambassador_credentials_select" ON public.ambassador_credentials FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.admins WHERE id = (SELECT auth.uid()))
    );
    CREATE POLICY "ambassador_credentials_modify" ON public.ambassador_credentials FOR ALL USING (
      EXISTS (SELECT 1 FROM public.admins WHERE id = (SELECT auth.uid()))
    ) WITH CHECK (
      EXISTS (SELECT 1 FROM public.admins WHERE id = (SELECT auth.uid()))
    );
  END IF;

  -- AREAS
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'areas') THEN
    DROP POLICY IF EXISTS "areas_admin_all" ON public.areas;
    DROP POLICY IF EXISTS "areas_public_read" ON public.areas;
    
    CREATE POLICY "areas_select" ON public.areas FOR SELECT USING (true);
  END IF;
END $$;
