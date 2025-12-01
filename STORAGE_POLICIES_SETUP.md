# Storage Policies Setup Guide

Due to permission restrictions, storage policies must be created via the Supabase Dashboard UI. Follow these steps:

## Step-by-Step Instructions

### 1. Navigate to Storage
- Open your Supabase project dashboard
- Click **Storage** in the left sidebar
- Click on the **tickets** bucket

### 2. Create Policy 1: Public Read Access

1. Click the **Policies** tab
2. Click **New Policy**
3. Select **For full customization** (or use template)
4. Fill in:
   - **Policy name**: `Public can view ticket QR codes`
   - **Allowed operation**: `SELECT`
   - **Target roles**: Leave empty (or select `anon` and `authenticated`)
   - **USING expression**:
     ```sql
     bucket_id = 'tickets'
     ```
5. Click **Review** → **Save policy**

### 3. Create Policy 2: Service Role Upload

1. Click **New Policy**
2. Select **For full customization**
3. Fill in:
   - **Policy name**: `Service role can upload ticket QR codes`
   - **Allowed operation**: `INSERT`
   - **Target roles**: `service_role`
   - **USING expression**:
     ```sql
     bucket_id = 'tickets' AND auth.role() = 'service_role'
     ```
   - **WITH CHECK expression** (same):
     ```sql
     bucket_id = 'tickets' AND auth.role() = 'service_role'
     ```
4. Click **Review** → **Save policy**

### 4. Create Policy 3: Service Role Update

1. Click **New Policy**
2. Select **For full customization**
3. Fill in:
   - **Policy name**: `Service role can update ticket QR codes`
   - **Allowed operation**: `UPDATE`
   - **Target roles**: `service_role`
   - **USING expression**:
     ```sql
     bucket_id = 'tickets' AND auth.role() = 'service_role'
     ```
   - **WITH CHECK expression** (same):
     ```sql
     bucket_id = 'tickets' AND auth.role() = 'service_role'
     ```
4. Click **Review** → **Save policy**

### 5. Create Policy 4: Service Role Delete

1. Click **New Policy**
2. Select **For full customization**
3. Fill in:
   - **Policy name**: `Service role can delete ticket QR codes`
   - **Allowed operation**: `DELETE`
   - **Target roles**: `service_role`
   - **USING expression**:
     ```sql
     bucket_id = 'tickets' AND auth.role() = 'service_role'
     ```
4. Click **Review** → **Save policy**

## Quick Alternative: Single Policy for Service Role

If you want to simplify, you can create one policy that allows all operations for service role:

1. Click **New Policy**
2. Select **For full customization**
3. Fill in:
   - **Policy name**: `Service role full access to tickets`
   - **Allowed operation**: `ALL`
   - **Target roles**: `service_role`
   - **USING expression**:
     ```sql
     bucket_id = 'tickets' AND auth.role() = 'service_role'
     ```
   - **WITH CHECK expression** (same):
     ```sql
     bucket_id = 'tickets' AND auth.role() = 'service_role'
     ```
4. Click **Review** → **Save policy**

## Verification

After creating the policies, verify they appear in the Policies tab. You should see:
- Public can view ticket QR codes (SELECT)
- Service role can upload ticket QR codes (INSERT)
- Service role can update ticket QR codes (UPDATE)
- Service role can delete ticket QR codes (DELETE)

Or the single "Service role full access to tickets" (ALL) policy.

## Note

The bucket is already set to public, so the SELECT policy is optional but recommended for explicit control. The service role policies are essential for the backend to upload QR codes.

