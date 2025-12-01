# Create Storage Policies via Dashboard (REQUIRED)

SQL cannot create storage policies due to permission restrictions. You MUST use the Dashboard UI.

## Step-by-Step Instructions

### 1. Navigate to Storage Policies
1. Open Supabase Dashboard
2. Click **Storage** (left sidebar)
3. Click on **tickets** bucket
4. Click **Policies** tab
5. Click **New Policy** button

---

## Policy 2: Service Role Upload

1. **Policy name**: `Service role can upload ticket QR codes`
2. **Allowed operation**: Select `INSERT`
3. **Target roles**: Type `service_role` (or select from dropdown)
4. **USING expression**: Paste this:
   ```sql
   bucket_id = 'tickets' AND auth.role() = 'service_role'
   ```
5. **WITH CHECK expression**: Paste this (same as USING):
   ```sql
   bucket_id = 'tickets' AND auth.role() = 'service_role'
   ```
6. Click **Review** → **Save policy**

---

## Policy 3: Service Role Update

1. Click **New Policy** again
2. **Policy name**: `Service role can update ticket QR codes`
3. **Allowed operation**: Select `UPDATE`
4. **Target roles**: Type `service_role`
5. **USING expression**: 
   ```sql
   bucket_id = 'tickets' AND auth.role() = 'service_role'
   ```
6. **WITH CHECK expression**: (same)
   ```sql
   bucket_id = 'tickets' AND auth.role() = 'service_role'
   ```
7. Click **Review** → **Save policy**

---

## Policy 4: Service Role Delete

1. Click **New Policy** again
2. **Policy name**: `Service role can delete ticket QR codes`
3. **Allowed operation**: Select `DELETE`
4. **Target roles**: Type `service_role`
5. **USING expression**: 
   ```sql
   bucket_id = 'tickets' AND auth.role() = 'service_role'
   ```
6. Click **Review** → **Save policy**

---

## ✅ ALTERNATIVE: Single Policy (Easier - Recommended)

Instead of creating 3 separate policies, create ONE policy that does everything:

1. Click **New Policy**
2. **Policy name**: `Service role full access to tickets`
3. **Allowed operation**: Select `ALL`
4. **Target roles**: Type `service_role`
5. **USING expression**: 
   ```sql
   bucket_id = 'tickets' AND auth.role() = 'service_role'
   ```
6. **WITH CHECK expression**: (same)
   ```sql
   bucket_id = 'tickets' AND auth.role() = 'service_role'
   ```
7. Click **Review** → **Save policy**

**This single policy replaces policies 2, 3, and 4!**

---

## Verification

After creating policies, you should see them listed in the Policies tab:
- ✅ Public can view ticket QR codes (SELECT) - You already created this
- ✅ Service role full access to tickets (ALL) - OR the 3 separate policies

Your ticket generation system will work once these policies are created!

