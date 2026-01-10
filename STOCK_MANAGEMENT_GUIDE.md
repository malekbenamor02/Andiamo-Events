# STOCK MANAGEMENT GUIDE
## How to Manage Pass Stock in Andiamo Events

**Date:** 2025-01-XX  
**Status:** ✅ Backend Complete - Ready to Use

---

## 🎯 OVERVIEW

The stock management system allows admins to:
- ✅ Set stock limits for passes (or make them unlimited)
- ✅ View current stock levels (sold/remaining)
- ✅ Activate/deactivate passes (soft-delete)
- ✅ Track all changes via audit logs

**All stock management is done via secure admin API endpoints.**

---

## 📋 AVAILABLE OPERATIONS

### 1. View All Passes (with Stock Info)

**Endpoint:** `GET /api/admin/passes/:eventId`  
**Auth:** Admin authentication required

**Returns:**
- All passes (active + inactive) for the event
- Stock information: `sold_quantity`, `remaining_quantity`, `max_quantity`, `is_active`
- Pass details: name, price, description, release_version

**Example Request:**
```bash
GET /api/admin/passes/abc123-event-id
Authorization: Cookie with admin session
```

**Example Response:**
```json
{
  "success": true,
  "passes": [
    {
      "id": "pass-uuid-1",
      "name": "Standard",
      "price": 50.00,
      "description": "Standard entry pass",
      "is_primary": true,
      "is_active": true,
      "release_version": 1,
      "max_quantity": 100,
      "sold_quantity": 45,
      "remaining_quantity": 55,
      "is_unlimited": false
    },
    {
      "id": "pass-uuid-2",
      "name": "VIP",
      "price": 100.00,
      "is_active": true,
      "max_quantity": null,
      "sold_quantity": 12,
      "remaining_quantity": null,
      "is_unlimited": true
    }
  ]
}
```

---

### 2. Update Pass Stock (Set Max Quantity)

**Endpoint:** `POST /api/admin/passes/:id/stock`  
**Auth:** Admin authentication required

**Purpose:**
- Set or update the maximum stock for a pass
- Set to `null` for unlimited stock
- Increase stock anytime
- Decrease stock (only if new max >= sold_quantity)

**Request Body:**
```json
{
  "max_quantity": 150  // Integer for limited stock, or null for unlimited
}
```

**Example: Set Limited Stock**
```bash
POST /api/admin/passes/pass-uuid-1/stock
Content-Type: application/json
Authorization: Cookie with admin session

{
  "max_quantity": 200
}
```

**Example: Set Unlimited Stock**
```bash
POST /api/admin/passes/pass-uuid-1/stock
Content-Type: application/json
Authorization: Cookie with admin session

{
  "max_quantity": null
}
```

**Validation Rules:**
- ✅ Can always increase `max_quantity`
- ✅ Can always set to `null` (unlimited)
- ❌ Cannot decrease `max_quantity` below `sold_quantity`
- ✅ If pass has 45 sold, you can set max to 45 or higher, but not 40

**Example Response (Success):**
```json
{
  "success": true,
  "pass": {
    "id": "pass-uuid-1",
    "name": "Standard",
    "max_quantity": 200,
    "sold_quantity": 45,
    "remaining_quantity": 155,
    "is_unlimited": false
  }
}
```

**Example Response (Error - Invalid Reduction):**
```json
{
  "error": "Invalid stock reduction",
  "details": "Cannot set max_quantity (40) below sold_quantity (45)"
}
```

---

### 3. Activate/Deactivate Pass

**Endpoint:** `POST /api/admin/passes/:id/activate`  
**Auth:** Admin authentication required

**Purpose:**
- Soft-delete pass (set `is_active = false`)
- Reactivate pass (set `is_active = true`)
- Inactive passes are hidden from customers but remain valid for historical orders

**Request Body:**
```json
{
  "is_active": false  // true to activate, false to deactivate
}
```

**Example: Deactivate Pass**
```bash
POST /api/admin/passes/pass-uuid-1/activate
Content-Type: application/json
Authorization: Cookie with admin session

{
  "is_active": false
}
```

**Example: Reactivate Pass**
```bash
POST /api/admin/passes/pass-uuid-1/activate
Content-Type: application/json
Authorization: Cookie with admin session

{
  "is_active": true
}
```

**Behavior:**
- ✅ Inactive passes: Hidden from customer purchase page
- ✅ Inactive passes: Still visible in admin dashboard
- ✅ Inactive passes: Historical orders remain valid
- ✅ Cannot create orders for inactive passes

**Example Response:**
```json
{
  "success": true,
  "pass": {
    "id": "pass-uuid-1",
    "name": "Standard",
    "is_active": false,
    "max_quantity": 200,
    "sold_quantity": 45
  }
}
```

---

## 🔒 SECURITY & AUDIT

### Audit Logging

**All stock management actions are logged to `security_audit_logs` with:**
- Admin ID and email
- Complete before/after snapshots
- Timestamp
- IP address and user agent
- Action type: `admin_stock_update` or `admin_pass_activation`

**Example Audit Log Entry:**
```json
{
  "event_type": "admin_stock_update",
  "user_id": "admin-uuid",
  "endpoint": "/api/admin/passes/:id/stock",
  "details": {
    "pass_id": "pass-uuid-1",
    "event_id": "event-uuid",
    "action": "UPDATE_STOCK",
    "before": {
      "max_quantity": 100,
      "sold_quantity": 45,
      "is_active": true,
      "name": "Standard",
      "price": 50.00
    },
    "after": {
      "max_quantity": 200,
      "sold_quantity": 45,
      "is_active": true,
      "name": "Standard",
      "price": 50.00
    },
    "admin_email": "admin@example.com"
  },
  "severity": "medium"
}
```

---

## 📖 STEP-BY-STEP WORKFLOWS

### Workflow 1: Set Stock Limit for New Event

1. **View all passes for the event:**
   ```bash
   GET /api/admin/passes/{eventId}
   ```

2. **Set stock for each pass:**
   ```bash
   POST /api/admin/passes/{passId}/stock
   {
     "max_quantity": 100
   }
   ```

3. **Or set unlimited:**
   ```bash
   POST /api/admin/passes/{passId}/stock
   {
     "max_quantity": null
   }
   ```

### Workflow 2: Increase Stock Mid-Event

1. **Check current stock:**
   ```bash
   GET /api/admin/passes/{eventId}
   ```
   - Look at `sold_quantity` and `remaining_quantity`

2. **Increase stock:**
   ```bash
   POST /api/admin/passes/{passId}/stock
   {
     "max_quantity": 200  // Increase from current max
   }
   ```

### Workflow 3: Stop Selling a Pass (Keep Historical Orders)

1. **Deactivate pass:**
   ```bash
   POST /api/admin/passes/{passId}/activate
   {
     "is_active": false
   }
   ```

2. **Pass is immediately hidden from customers**
3. **Historical orders remain valid**
4. **Can reactivate later if needed**

### Workflow 4: Reduce Stock (Only if Safe)

1. **Check sold quantity:**
   ```bash
   GET /api/admin/passes/{eventId}
   ```

2. **Set new max (must be >= sold_quantity):**
   ```bash
   POST /api/admin/passes/{passId}/stock
   {
     "max_quantity": 50  // Must be >= current sold_quantity
   }
   ```

---

## 🔧 USING THE API FROM FRONTEND

### Example: React/TypeScript Integration

```typescript
// Get event passes with stock
async function getEventPasses(eventId: string) {
  const response = await fetch(`/api/admin/passes/${eventId}`, {
    credentials: 'include'  // Include admin session cookie
  });
  const data = await response.json();
  return data.passes;
}

// Update pass stock
async function updatePassStock(passId: string, maxQuantity: number | null) {
  const response = await fetch(`/api/admin/passes/${passId}/stock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ max_quantity: maxQuantity })
  });
  return await response.json();
}

// Activate/deactivate pass
async function togglePassActive(passId: string, isActive: boolean) {
  const response = await fetch(`/api/admin/passes/${passId}/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ is_active: isActive })
  });
  return await response.json();
}
```

---

## 📊 VIEWING STOCK LEVELS

### For Customers (Public)
- Customers see stock via `GET /api/passes/:eventId`
- Only active passes are shown
- Stock information: `remaining_quantity`, `is_unlimited`, `is_sold_out`
- Frontend displays "Sold Out" badges and disables sold-out passes

### For Admins
- Admins see full stock via `GET /api/admin/passes/:eventId`
- Shows active AND inactive passes
- Includes `sold_quantity`, `remaining_quantity`, `max_quantity`
- Complete stock visibility for management

---

## ⚠️ IMPORTANT RULES

### What Admins CAN Do:
- ✅ Set `max_quantity` to any value >= `sold_quantity`
- ✅ Set `max_quantity` to `null` (unlimited) anytime
- ✅ Increase `max_quantity` anytime
- ✅ Activate/deactivate passes (soft-delete)
- ✅ View all stock information

### What Admins CANNOT Do:
- ❌ Set `max_quantity` below `sold_quantity` (prevented by validation)
- ❌ Directly edit `sold_quantity` (managed automatically by system)
- ❌ Hard-delete passes (must use soft-delete via `is_active`)

### Automatic Stock Management:
- ✅ `sold_quantity` increases automatically when orders are created
- ✅ `sold_quantity` decreases automatically when orders are cancelled/refunded
- ✅ Stock is reserved atomically during order creation
- ✅ Stock is released atomically on cancellation/refund

---

## 🎯 QUICK REFERENCE

| Operation | Endpoint | Method | Body |
|-----------|----------|--------|------|
| View passes | `/api/admin/passes/:eventId` | GET | - |
| Set stock limit | `/api/admin/passes/:id/stock` | POST | `{"max_quantity": 100}` |
| Set unlimited | `/api/admin/passes/:id/stock` | POST | `{"max_quantity": null}` |
| Deactivate | `/api/admin/passes/:id/activate` | POST | `{"is_active": false}` |
| Reactivate | `/api/admin/passes/:id/activate` | POST | `{"is_active": true}` |

---

## 🚀 NEXT STEPS

**Backend is complete and ready to use.**

**Optional Enhancement:**
- Add stock management UI to admin Dashboard.tsx
- Display passes in a table with stock info
- Add edit buttons for `max_quantity`
- Add toggle switches for `is_active`
- Show real-time stock levels

**Current Status:**
- ✅ All API endpoints working
- ✅ Secure admin authentication
- ✅ Complete audit logging
- ✅ Stock management fully functional

**You can start managing stock immediately via API calls or add the UI later.**

---

**END OF STOCK MANAGEMENT GUIDE**
