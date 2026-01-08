# 📋 Complete COD Order Flow - Full Documentation

## Table of Contents
1. [Overview](#overview)
2. [Order Creation Flow](#order-creation-flow)
3. [Status Transitions](#status-transitions)
4. [Routes & Pages](#routes--pages)
5. [API Endpoints](#api-endpoints)
6. [Database Structure](#database-structure)
7. [Frontend Components](#frontend-components)
8. [Backend Logic](#backend-logic)
9. [SMS Notifications](#sms-notifications)
10. [Admin Actions](#admin-actions)
11. [Ambassador Actions](#ambassador-actions)
12. [Security & Validation](#security--validation)

---

## Overview

**COD (Cash on Delivery) Orders** are orders where customers pay cash when they receive their passes from an ambassador.

### Key Characteristics:
- ✅ Payment method: `ambassador_cash` or `cod`
- ✅ Source: `platform_cod` (created through server-side API)
- ✅ Requires: Ambassador selection (for COD orders)
- ✅ Location: Only available in **Sousse** city
- ✅ Status Flow: `PENDING_CASH` → `PENDING_ADMIN_APPROVAL` → `PAID` / `REJECTED`

---

## Order Creation Flow

### Flow Diagram:
```
1. Customer visits PassPurchase page (/pass-purchase)
   ↓
2. Selects event and passes
   ↓
3. Selects payment method: "Ambassador Cash" (ambassador_cash)
   ↓
4. Selects ambassador (required for COD)
   ↓
5. Fills customer info (name, phone, email, city, ville)
   ↓
6. Submits order
   ↓
7. Frontend: createOrder() calls POST /api/create-order
   ↓
8. Server validates:
   - Blocks ambassadors
   - Validates pass IDs (database)
   - Fetches prices from database
   - Validates city/ville combination
   - Validates ambassador exists and is approved
   - Calculates total server-side
   ↓
9. Creates order with status: PENDING_CASH
   ↓
10. Sends SMS to customer (non-blocking)
11. Sends SMS to ambassador (non-blocking)
   ↓
12. Order visible in Ambassador Dashboard (New Orders tab)
```

---

## Status Transitions

### COD Order Status Flow:

```
PENDING_CASH
  ↓ (Ambassador confirms cash received)
PENDING_ADMIN_APPROVAL
  ↓ (Admin approves)
PAID
  ↓ (Tickets generated automatically)
COMPLETED (optional)
```

### Status Definitions:

| Status | Description | Who Sets | Next Status |
|--------|-------------|----------|-------------|
| `PENDING_CASH` | Order created, waiting for ambassador to collect cash | Server (on creation) | `PENDING_ADMIN_APPROVAL` |
| `PENDING_ADMIN_APPROVAL` | Cash received, waiting for admin approval | Ambassador (confirm cash) | `PAID` or `REJECTED` |
| `PAID` | Admin approved, order is paid | Admin (approve order) | N/A (final) |
| `REJECTED` | Admin rejected order | Admin (reject order) | N/A (final) |
| `CANCELLED_BY_ADMIN` | Admin cancelled order | Admin | N/A (final) |

---

## Routes & Pages

### 1. **PassPurchase Page** (`/pass-purchase`)
**File:** `src/pages/PassPurchase.tsx`

**Purpose:** Main order creation page where customers select passes and payment method

**Key Features:**
- ✅ Event selection
- ✅ Pass selection (quantity, price)
- ✅ Payment method selection (Online, External App, **Ambassador Cash**)
- ✅ Ambassador selector (shown only if `ambassador_cash` selected)
- ✅ Customer info form (name, phone, email, city, ville)
- ✅ Terms acceptance

**Route Definition:**
```typescript
// src/App.tsx
<Route path="/pass-purchase" element={
  <BlockAmbassadorRoute language={language}>
    <PassPurchase language={language} />
  </BlockAmbassadorRoute>
} />
```

**Important:** Protected by `BlockAmbassadorRoute` - ambassadors cannot access this page

**Key Code:**
```typescript
// src/pages/PassPurchase.tsx:330-411
const handleSubmit = async (e: React.FormEvent) => {
  // ... validation ...
  
  const order = await createOrder({
    customerInfo,
    passes: selectedPassesArray,
    paymentMethod, // Can be PaymentMethod.AMBASSADOR_CASH
    ambassadorId: paymentMethod === PaymentMethod.AMBASSADOR_CASH 
      ? selectedAmbassadorId 
      : undefined,
    eventId: eventId || undefined
  });
  
  // For ambassador_cash, show success message
  if (paymentMethod === PaymentMethod.AMBASSADOR_CASH) {
    toast({ title: t[language].success, ... });
    setSubmitted(true);
  }
};
```

### 2. **CODOrder Page** (`/cod-order`)
**File:** `src/pages/CODOrder.tsx`

**Purpose:** Legacy/alternative COD order creation page (direct database insert)

**⚠️ NOTE:** This page still uses direct Supabase access - **NOT SECURE** and should be updated to use `/api/create-order` endpoint

**Key Code:**
```typescript
// src/pages/CODOrder.tsx:149-166
const { data: order, error: orderError } = await supabase
  .from('orders')
  .insert({
    source: 'platform_cod',
    user_name: formData.customer_name,
    user_phone: formData.phone,
    user_email: formData.email || null,
    city: formData.city,
    ville: formData.ville || null,
    pass_type: formData.pass_type,
    quantity: formData.quantity,
    total_price: totalPrice,
    payment_method: 'cod',
    status: 'PENDING_ADMIN_APPROVAL' // ⚠️ Different from PassPurchase!
  })
  .select()
  .single();
```

**Route Definition:**
```typescript
// src/App.tsx
<Route path="/cod-order" element={
  <BlockAmbassadorRoute language={language}>
    <CODOrder language={language} />
  </BlockAmbassadorRoute>
} />
```

**⚠️ SECURITY ISSUE:** This page bypasses server-side validation. Should be updated to use `/api/create-order`.

### 3. **Ambassador Dashboard** (`/ambassador/dashboard`)
**File:** `src/pages/ambassador/Dashboard.tsx`

**Purpose:** Ambassador views and manages COD orders

**Key Features:**
- ✅ **New Orders Tab**: Shows `PENDING_CASH` orders (waiting for cash confirmation)
- ✅ **History Tab**: Shows all other orders (PAID, COMPLETED, etc.)
- ✅ **Confirm Cash Button**: Changes status from `PENDING_CASH` → `PENDING_ADMIN_APPROVAL`
- ✅ **Cancel Order**: Ambassador can cancel orders
- ✅ **Performance Stats**: Shows commission, total sales, etc.

**Key Code:**
```typescript
// src/pages/ambassador/Dashboard.tsx:526-554
const handleConfirmCash = async (orderId: string) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({
        status: 'PENDING_ADMIN_APPROVAL',
        accepted_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .eq('ambassador_id', ambassador?.id)
      .select()
      .single();
      
    // Log to order_logs
    await supabase.from('order_logs').insert({
      order_id: orderId,
      action: 'cash_confirmed',
      performed_by: ambassador?.id,
      performed_by_type: 'ambassador',
      details: { 
        from_status: 'PENDING_CASH', 
        to_status: 'PENDING_ADMIN_APPROVAL' 
      }
    });
  }
};
```

### 4. **Admin Dashboard** (`/admin/dashboard`)
**File:** `src/pages/admin/Dashboard.tsx`

**Purpose:** Admin views and manages COD orders

**Key Features:**
- ✅ View all COD orders
- ✅ **Approve Order**: Changes status from `PENDING_ADMIN_APPROVAL` → `PAID`
- ✅ **Reject Order**: Changes status from `PENDING_ADMIN_APPROVAL` → `REJECTED`
- ✅ **Generate Tickets**: Automatically generates tickets when order is approved
- ✅ **Complete Order**: Marks order as completed

**Key Code:**
```typescript
// src/pages/admin/Dashboard.tsx:1843-2016
const handleApproveCodAmbassadorOrder = async (orderId: string) => {
  // 1. Update order status to PAID
  await supabase
    .from('orders')
    .update({ 
      status: 'PAID',
      payment_status: 'PAID',
      approved_at: new Date().toISOString()
    })
    .eq('id', orderId);
    
  // 2. Generate tickets (if order has email)
  if (order.user_email) {
    await fetch('/api/generate-tickets-for-order', {
      method: 'POST',
      body: JSON.stringify({ orderId })
    });
  }
  
  // 3. Log to order_logs
  await supabase.from('order_logs').insert({
    order_id: orderId,
    action: 'approved',
    performed_by_type: 'admin',
    details: { 
      old_status: 'PENDING_ADMIN_APPROVAL',
      new_status: 'PAID'
    }
  });
};
```

---

## API Endpoints

### 1. **POST /api/create-order**
**File:** `server.cjs:2729-3095`

**Purpose:** Secure server-side order creation (replaces direct Supabase access)

**Request Body:**
```javascript
{
  eventId: "uuid",
  passIds: [
    { passId: "uuid", quantity: 2 }  // Only IDs and quantities
  ],
  customerInfo: {
    full_name: "Customer Name",
    phone: "27123456",
    email: "customer@example.com",
    city: "Sousse",
    ville: "Sahloul"
  },
  paymentMethod: "ambassador_cash" | "cod" | "online" | "external_app",
  ambassadorId: "uuid" | null,  // Required for COD
  ambassadorSession: null  // Checked to block ambassadors
}
```

**Validation Steps:**
1. ✅ Block ambassadors (if `ambassadorSession` exists → 403)
2. ✅ Validate `eventId` exists
3. ✅ Fetch ALL passes from database
4. ✅ For each `passId`:
   - Validate UUID format
   - Reject test/fake IDs ("test", "fake", "dummy")
   - Find pass in database
   - Get price FROM DATABASE (never trust client)
   - Get name FROM DATABASE (never trust client)
5. ✅ Validate ambassador exists and is approved (if COD)
6. ✅ Validate city exists in database
7. ✅ Validate ville belongs to city (if ville provided)
8. ✅ Validate city is "Sousse" (for COD orders)
9. ✅ Calculate total price server-side
10. ✅ Create order with `status: 'PENDING_CASH'`

**Response:**
```javascript
{
  success: true,
  order: { /* order object */ },
  message: "Order created successfully",
  serverCalculatedTotal: 100  // Server-calculated total
}
```

**Error Responses:**
- `400`: Validation errors (invalid pass ID, city/ville mismatch, etc.)
- `403`: Ambassador trying to create order
- `404`: Event or pass not found
- `500`: Server error

**Key Code:**
```javascript
// server.cjs:3011-3017
case 'ambassador_cash':
case 'cod':
  initialStatus = 'PENDING_CASH';  // COD orders start as PENDING_CASH
  break;
```

### 2. **POST /api/send-order-confirmation-sms**
**File:** `server.cjs:1859-1984`

**Purpose:** Send SMS to customer confirming order

**Request Body:**
```javascript
{
  orderId: "uuid"
}
```

**Process:**
1. Fetch order with ambassador details
2. Format SMS message:
   ```
   Commande confirmée :
   
   ID:ORDER123 confirmée
   Pass: 2× VIP (50 DT) | Total: 100 DT
   Ambassadeur: John Doe – 27123456
   We Create Memories
   
   🎫 Vos QR Codes:
   https://...
   ```
3. Send SMS via WinSMS API
4. Log to `sms_logs` table

**Key Code:**
```javascript
// server.cjs:1934-1938
let message = `Commande confirmée :\n\n`;
message += `ID:${orderNumber} confirmée\n`;
message += `Pass: ${passesText} | Total: ${order.total_price} DT\n`;
message += `Ambassadeur: ${ambassadorName} – ${ambassadorPhone}\n`;
message += `We Create Memories`;
```

### 3. **POST /api/send-ambassador-order-sms**
**File:** `server.cjs:1989-2097`

**Purpose:** Send SMS to ambassador notifying them of new order

**Request Body:**
```javascript
{
  orderId: "uuid"
}
```

**Process:**
1. Fetch order with customer details
2. Format SMS message:
   ```
   Nouvelle commande :
   
   ID:ORDER123
   Client: Customer Name – 27123456
   Pass: 2× VIP (50 DT) | Total: 100 DT
   Ville: Sahloul
   ```
3. Send SMS to ambassador
4. Log to `sms_logs` table

---

## Database Structure

### Orders Table
**Schema:** `supabase/migrations/20250201000018-comprehensive-orders-schema-refactor.sql`

**Key Columns:**
```sql
CREATE TABLE public.orders (
  id UUID PRIMARY KEY,
  source TEXT NOT NULL,  -- 'platform_cod' for COD orders
  user_name TEXT NOT NULL,
  user_phone TEXT NOT NULL,
  user_email TEXT,
  city TEXT NOT NULL,
  ville TEXT,
  city_id UUID REFERENCES cities(id),
  ville_id UUID REFERENCES villes(id),
  event_id UUID REFERENCES events(id),
  ambassador_id UUID REFERENCES ambassadors(id),  -- Required for COD
  quantity INTEGER NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL,  -- 'cod' or 'ambassador_cash' for COD
  status TEXT NOT NULL,  -- 'PENDING_CASH', 'PENDING_ADMIN_APPROVAL', 'PAID', etc.
  payment_status TEXT,  -- 'PAID' for approved COD orders
  notes JSONB,  -- Contains pass details
  assigned_at TIMESTAMP,
  accepted_at TIMESTAMP,
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Order Passes Table
**Schema:** Stores individual passes in order

```sql
CREATE TABLE public.order_passes (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  pass_type TEXT NOT NULL,  -- Pass name (e.g., "VIP")
  quantity INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,  -- Price per pass (from database)
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Order Logs Table
**Schema:** Tracks all order status changes

```sql
CREATE TABLE public.order_logs (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  action TEXT NOT NULL,  -- 'cash_confirmed', 'approved', 'rejected', etc.
  performed_by UUID,  -- Ambassador ID or NULL for admin
  performed_by_type TEXT,  -- 'ambassador' or 'admin'
  details JSONB,  -- Contains old_status, new_status, etc.
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Status Validation Function
**File:** `supabase/migrations/20250201000031-enforce-cod-rules.sql`

**Purpose:** Database-level validation of status transitions

```sql
CREATE OR REPLACE FUNCTION public.validate_order_status()
RETURNS TRIGGER AS $$
BEGIN
  -- COD orders (platform_cod source)
  IF NEW.source = 'platform_cod' AND NEW.payment_method = 'cod' THEN
    IF NEW.status NOT IN ('PENDING_CASH', 'PENDING_ADMIN_APPROVAL', 'PAID', 'REJECTED', 'COMPLETED', 'CANCELLED_BY_ADMIN') THEN
      RAISE EXCEPTION 'Invalid status % for COD order', NEW.status;
    END IF;
    
    -- COD orders must start as PENDING_CASH (on INSERT)
    IF TG_OP = 'INSERT' AND NEW.payment_method = 'cod' AND NEW.status != 'PENDING_CASH' THEN
      RAISE EXCEPTION 'COD orders must start with PENDING_CASH status. Attempted: %', NEW.status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## Frontend Components

### 1. **createOrder Function**
**File:** `src/lib/orders/orderService.ts:23-115`

**Purpose:** Frontend order creation service (calls server-side API)

**Key Code:**
```typescript
export async function createOrder(data: CreateOrderData): Promise<Order> {
  // SECURITY: Block ambassadors
  const ambassadorSession = localStorage.getItem('ambassadorSession');
  if (ambassadorSession) {
    throw new Error('SECURITY: Ambassadors cannot create orders...');
  }

  // Prepare request (only send IDs and quantities)
  const requestData = {
    eventId: eventId || null,
    passIds: passes.map(p => ({
      passId: p.passId,  // Only ID
      quantity: p.quantity  // Only quantity
      // ⚠️ NO price, NO name - server fetches from database
    })),
    customerInfo: { ... },
    paymentMethod: paymentMethod,
    ambassadorId: (paymentMethod === PaymentMethod.AMBASSADOR_CASH && ambassadorId) 
      ? ambassadorId 
      : null,
    ambassadorSession: ambassadorSession || null
  };

  // Call server-side API
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestData)
  });

  const result = await response.json();
  
  // Send SMS notifications (non-blocking)
  if (paymentMethod === PaymentMethod.AMBASSADOR_CASH && ambassadorId && order.id) {
    // Send SMS to client
    fetch(`${apiBase}/api/send-order-confirmation-sms`, {
      method: 'POST',
      body: JSON.stringify({ orderId: order.id })
    }).catch(err => console.error('Failed to send SMS:', err));

    // Send SMS to ambassador
    fetch(`${apiBase}/api/send-ambassador-order-sms`, {
      method: 'POST',
      body: JSON.stringify({ orderId: order.id })
    }).catch(err => console.error('Failed to send SMS:', err));
  }

  return order;
}
```

### 2. **BlockAmbassadorRoute Component**
**File:** `src/components/auth/BlockAmbassadorRoute.tsx`

**Purpose:** Prevents ambassadors from accessing order creation pages

**Key Code:**
```typescript
export const BlockAmbassadorRoute = ({ children, language }) => {
  const [isAmbassador, setIsAmbassador] = useState(false);
  
  useEffect(() => {
    const session = localStorage.getItem('ambassadorSession');
    if (session) {
      setIsAmbassador(true);
      toast({
        title: 'Access Denied',
        description: 'Ambassadors cannot create orders...',
        variant: "destructive",
      });
      navigate('/ambassador/dashboard', { replace: true });
    }
  }, []);
  
  if (isAmbassador) {
    return <LoadingScreen text="Redirecting..." />;
  }
  
  return <>{children}</>;
};
```

---

## Backend Logic

### Order Creation Logic (`server.cjs:2729-3095`)

**Complete Flow:**

1. **Security Check: Block Ambassadors**
   ```javascript
   if (ambassadorSession || ambassadorId) {
     // Check if ambassador is trying to create
     if (ambassadorSession) {
       return res.status(403).json({
         error: 'Access Denied',
         message: 'Ambassadors cannot create orders...'
       });
     }
   }
   ```

2. **Validate Pass IDs**
   ```javascript
   // Fetch ALL passes from database
   const { data: eventPasses } = await supabase
     .from('event_passes')
     .select('id, name, price, event_id')
     .eq('event_id', eventId);
   
   // Validate each pass
   for (const clientPass of passIds) {
     // Reject test/fake IDs
     if (passIdLower.includes('test') || passIdLower.includes('fake')) {
       return res.status(400).json({ error: 'Invalid pass ID...' });
     }
     
     // Find pass in database
     const validPass = eventPasses.find(p => p.id === clientPass.passId);
     if (!validPass) {
       return res.status(400).json({ error: 'Pass does not exist...' });
     }
     
     // Get price FROM DATABASE (never trust client)
     const dbPrice = Number(validPass.price);
     const dbName = validPass.name;
     
     // Calculate server-side
     serverCalculatedTotal += dbPrice * clientPass.quantity;
   }
   ```

3. **Validate Ambassador (for COD)**
   ```javascript
   if (paymentMethod === 'ambassador_cash' || paymentMethod === 'cod') {
     if (!ambassadorId) {
       return res.status(400).json({ error: 'Ambassador ID required...' });
     }
     
     const { data: ambassador } = await supabase
       .from('ambassadors')
       .select('id, full_name, status')
       .eq('id', ambassadorId)
       .eq('status', 'approved')
       .single();
       
     if (!ambassador) {
       return res.status(400).json({ error: 'Invalid ambassador...' });
     }
   }
   ```

4. **Validate City/Ville**
   ```javascript
   // Validate city exists
   const { data: city } = await supabase
     .from('cities')
     .select('id, name')
     .eq('name', customerInfo.city.trim())
     .single();
     
   if (!city) {
     return res.status(400).json({ error: 'Invalid city...' });
   }
   
   // Validate ville belongs to city
   if (customerInfo.ville) {
     const { data: ville } = await supabase
       .from('villes')
       .select('id, name, city_id')
       .eq('name', customerInfo.ville.trim())
       .eq('city_id', city.id)
       .single();
       
     if (!ville) {
       // Check if ville belongs to different city
       const { data: villeInOtherCity } = await supabase
         .from('villes')
         .select('cities(name)')
         .eq('name', customerInfo.ville.trim())
         .maybeSingle();
         
       if (villeInOtherCity) {
         return res.status(400).json({
           error: `"${customerInfo.ville}" belongs to "${villeInOtherCity.cities.name}", not "${customerInfo.city}"`
         });
       }
     }
   }
   
   // Validate COD orders only in Sousse
   if ((paymentMethod === 'ambassador_cash' || paymentMethod === 'cod') 
       && customerInfo.city !== 'Sousse') {
     return res.status(400).json({ error: 'COD orders only available in Sousse' });
   }
   ```

5. **Create Order**
   ```javascript
   const orderData = {
     source: (paymentMethod === 'ambassador_cash' || paymentMethod === 'cod') 
       ? 'platform_cod' 
       : 'platform_online',
     user_name: customerInfo.full_name.trim(),
     user_phone: customerInfo.phone.trim(),
     user_email: customerInfo.email?.trim() || null,
     city: customerInfo.city.trim(),
     ville: customerInfo.ville?.trim() || null,
     event_id: eventId,
     ambassador_id: validatedAmbassadorId,
     quantity: serverCalculatedQuantity,  // Server-calculated
     total_price: serverCalculatedTotal,  // Server-calculated
     payment_method: paymentMethod,
     status: initialStatus,  // 'PENDING_CASH' for COD
     assigned_at: validatedAmbassadorId ? new Date().toISOString() : null,
     notes: JSON.stringify({
       all_passes: validatedPasses.map(p => ({
         passId: p.passId,
         passName: p.passName,
         quantity: p.quantity,
         price: p.price  // From database
       })),
       total_order_price: serverCalculatedTotal,
       pass_count: validatedPasses.length
     })
   };
   
   const { data: order } = await supabase
     .from('orders')
     .insert(orderData)
     .select()
     .single();
   ```

6. **Create Order Passes**
   ```javascript
   const orderPassesData = validatedPasses.map(pass => ({
     order_id: order.id,
     pass_type: pass.passName,  // From database
     quantity: pass.quantity,
     price: pass.price  // From database
   }));
   
   await supabase
     .from('order_passes')
     .insert(orderPassesData);
   ```

---

## SMS Notifications

### 1. **Customer Confirmation SMS**
**Triggered:** After order creation (non-blocking)

**Content:**
```
Commande confirmée :

ID:ORDER123 confirmée
Pass: 2× VIP (50 DT) | Total: 100 DT
Ambassadeur: John Doe – 27123456
We Create Memories

🎫 Vos QR Codes:
https://andiamoevents.com/api/qr-codes/TOKEN

⚠️ Ce lien ne peut être utilisé qu'une seule fois.
```

### 2. **Ambassador Notification SMS**
**Triggered:** After order creation (non-blocking)

**Content:**
```
Nouvelle commande :

ID:ORDER123
Client: Customer Name – 27123456
Pass: 2× VIP (50 DT) | Total: 100 DT
Ville: Sahloul
```

**Code Location:**
- `src/lib/orders/orderService.ts:86-107` - Frontend triggers (non-blocking)
- `server.cjs:1859-1984` - Customer SMS endpoint
- `server.cjs:1989-2097` - Ambassador SMS endpoint

---

## Admin Actions

### 1. **Approve COD Order**
**Location:** `src/pages/admin/Dashboard.tsx:1843-2016`

**Flow:**
1. Admin clicks "Approve" button on order with status `PENDING_ADMIN_APPROVAL`
2. Frontend updates order status to `PAID`
3. If order has email, generate tickets via `/api/generate-tickets-for-order`
4. Log action to `order_logs`

**Code:**
```typescript
const handleApproveCodAmbassadorOrder = async (orderId: string) => {
  // 1. Update status
  await supabase
    .from('orders')
    .update({ 
      status: 'PAID',
      payment_status: 'PAID',
      approved_at: new Date().toISOString()
    })
    .eq('id', orderId);
    
  // 2. Generate tickets (if email exists)
  if (order.user_email) {
    await fetch('/api/generate-tickets-for-order', {
      method: 'POST',
      body: JSON.stringify({ orderId })
    });
  }
  
  // 3. Log
  await supabase.from('order_logs').insert({
    order_id: orderId,
    action: 'approved',
    performed_by_type: 'admin',
    details: { 
      old_status: 'PENDING_ADMIN_APPROVAL',
      new_status: 'PAID'
    }
  });
};
```

### 2. **Reject COD Order**
**Location:** `src/pages/admin/Dashboard.tsx:2205-2359`

**Flow:**
1. Admin clicks "Reject" button
2. Frontend updates order status to `REJECTED`
3. Log action to `order_logs`

**Code:**
```typescript
const handleRejectCodAmbassadorOrder = async (orderId: string) => {
  await supabase
    .from('orders')
    .update({ 
      status: 'REJECTED',
      rejected_at: new Date().toISOString()
    })
    .eq('id', orderId);
    
  await supabase.from('order_logs').insert({
    order_id: orderId,
    action: 'rejected',
    performed_by_type: 'admin',
    details: { 
      old_status: 'PENDING_ADMIN_APPROVAL',
      new_status: 'REJECTED'
    }
  });
};
```

---

## Ambassador Actions

### 1. **Confirm Cash Received**
**Location:** `src/pages/ambassador/Dashboard.tsx:526-554`

**Flow:**
1. Ambassador sees order in "New Orders" tab (status: `PENDING_CASH`)
2. Ambassador clicks "Confirm Cash" button
3. Frontend updates order status to `PENDING_ADMIN_APPROVAL`
4. Log action to `order_logs`

**Code:**
```typescript
const handleConfirmCash = async (orderId: string) => {
  const { data, error } = await supabase
    .from('orders')
    .update({
      status: 'PENDING_ADMIN_APPROVAL',
      accepted_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .eq('ambassador_id', ambassador?.id)  // Only own orders
    .select()
    .single();
    
  if (!error && data) {
    // Log to order_logs
    await supabase.from('order_logs').insert({
      order_id: orderId,
      action: 'cash_confirmed',
      performed_by: ambassador?.id,
      performed_by_type: 'ambassador',
      details: { 
        from_status: 'PENDING_CASH', 
        to_status: 'PENDING_ADMIN_APPROVAL' 
      }
    });
  }
};
```

### 2. **Cancel Order**
**Location:** `src/pages/ambassador/Dashboard.tsx`

**Flow:**
1. Ambassador clicks "Cancel" button
2. Ambassador enters cancellation reason
3. Frontend updates order status to `CANCELLED_BY_AMBASSADOR`
4. Log action to `order_logs`

---

## Security & Validation

### Server-Side Validation (All in `/api/create-order`)

1. ✅ **Block Ambassadors** - Cannot create orders
2. ✅ **Validate Pass IDs** - Must exist in database
3. ✅ **Reject Test/Fake IDs** - Blocks "test", "fake", "dummy"
4. ✅ **Fetch Prices from Database** - Never trusts client prices
5. ✅ **Fetch Names from Database** - Never trusts client names
6. ✅ **Calculate Totals Server-Side** - Never trusts client totals
7. ✅ **Validate Ambassador** - Must exist and be approved
8. ✅ **Validate City/Ville** - Must be valid combination
9. ✅ **Validate COD Location** - Only available in Sousse
10. ✅ **Validate Phone Format** - 8 digits, starts with 2,4,5,6,7,8,9
11. ✅ **Validate Email Format** - Standard email regex

### Database-Level Validation

1. ✅ **Status Transitions** - `validate_order_status()` function
2. ✅ **Foreign Keys** - Ensures data integrity
3. ✅ **Check Constraints** - Validates status values
4. ✅ **RLS Policies** - Row Level Security

### Frontend Validation (UX Only, Not Trusted)

1. ✅ Form validation (required fields, formats)
2. ✅ Ambassador selection required for COD
3. ✅ Terms acceptance required
4. ✅ Route protection (BlockAmbassadorRoute)

---

## Key Files Summary

| File | Purpose | Location |
|------|---------|----------|
| **Frontend** |
| `src/pages/PassPurchase.tsx` | Main order creation page | `/pass-purchase` |
| `src/pages/CODOrder.tsx` | Legacy COD page (⚠️ needs update) | `/cod-order` |
| `src/pages/ambassador/Dashboard.tsx` | Ambassador order management | `/ambassador/dashboard` |
| `src/pages/admin/Dashboard.tsx` | Admin order approval | `/admin/dashboard` |
| `src/lib/orders/orderService.ts` | Order service (calls API) | Service layer |
| `src/components/auth/BlockAmbassadorRoute.tsx` | Route protection | Component |
| **Backend** |
| `server.cjs` | Main server file | API endpoints |
| `server.cjs:2729-3095` | `/api/create-order` endpoint | Order creation |
| `server.cjs:1859-1984` | `/api/send-order-confirmation-sms` | Customer SMS |
| `server.cjs:1989-2097` | `/api/send-ambassador-order-sms` | Ambassador SMS |
| **Database** |
| `supabase/migrations/*` | Database migrations | SQL files |
| `supabase/migrations/20250201000031-enforce-cod-rules.sql` | Status validation | Trigger function |

---

## Status Flow Diagram

```
┌─────────────────────┐
│  Order Created      │
│  Status: PENDING_   │
│        _CASH        │
└──────────┬──────────┘
           │
           │ Ambassador confirms cash
           ▼
┌─────────────────────┐
│  Status: PENDING_   │
│  ADMIN_APPROVAL     │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
┌─────────┐ ┌──────────┐
│ Admin   │ │ Admin    │
│ Approve │ │ Reject   │
└────┬────┘ └────┬─────┘
     │           │
     ▼           ▼
┌─────────┐ ┌──────────┐
│ Status: │ │ Status:  │
│  PAID   │ │ REJECTED │
└────┬────┘ └──────────┘
     │
     │ (Tickets generated)
     ▼
┌─────────┐
│ Status: │
│COMPLETED│
└─────────┘
```

---

## Complete Code Flow

### 1. Order Creation (PassPurchase.tsx → orderService.ts → /api/create-order)

```typescript
// Frontend: src/pages/PassPurchase.tsx
handleSubmit() {
  const order = await createOrder({
    customerInfo,
    passes: selectedPassesArray,
    paymentMethod: PaymentMethod.AMBASSADOR_CASH,
    ambassadorId: selectedAmbassadorId,
    eventId
  });
}

// Service: src/lib/orders/orderService.ts
createOrder(data) {
  // Block ambassadors
  if (ambassadorSession) throw Error();
  
  // Call API
  fetch('/api/create-order', {
    method: 'POST',
    body: JSON.stringify({
      eventId,
      passIds: passes.map(p => ({ passId, quantity })),
      customerInfo,
      paymentMethod: 'ambassador_cash',
      ambassadorId,
      ambassadorSession: null
    })
  });
  
  // Send SMS (non-blocking)
  fetch('/api/send-order-confirmation-sms', { orderId });
  fetch('/api/send-ambassador-order-sms', { orderId });
}

// Backend: server.cjs
POST /api/create-order {
  // Validate everything
  // Create order with status: PENDING_CASH
  // Return order
}
```

### 2. Ambassador Confirms Cash (Dashboard.tsx)

```typescript
// src/pages/ambassador/Dashboard.tsx
handleConfirmCash(orderId) {
  supabase
    .from('orders')
    .update({ 
      status: 'PENDING_ADMIN_APPROVAL',
      accepted_at: NOW()
    })
    .eq('id', orderId);
    
  supabase
    .from('order_logs')
    .insert({
      action: 'cash_confirmed',
      performed_by: ambassador.id,
      details: { from: 'PENDING_CASH', to: 'PENDING_ADMIN_APPROVAL' }
    });
}
```

### 3. Admin Approves (Dashboard.tsx)

```typescript
// src/pages/admin/Dashboard.tsx
handleApproveCodAmbassadorOrder(orderId) {
  supabase
    .from('orders')
    .update({ 
      status: 'PAID',
      payment_status: 'PAID',
      approved_at: NOW()
    })
    .eq('id', orderId);
    
  if (order.user_email) {
    fetch('/api/generate-tickets-for-order', { orderId });
  }
  
  supabase
    .from('order_logs')
    .insert({
      action: 'approved',
      performed_by_type: 'admin',
      details: { from: 'PENDING_ADMIN_APPROVAL', to: 'PAID' }
    });
}
```

---

## Issues & Recommendations

### ⚠️ Issues Found:

1. **CODOrder.tsx Still Uses Direct Supabase Access**
   - **File:** `src/pages/CODOrder.tsx:150-166`
   - **Issue:** Bypasses server-side validation
   - **Fix:** Update to use `/api/create-order` endpoint

2. **Status Inconsistency**
   - **CODOrder.tsx** creates orders with `status: 'PENDING_ADMIN_APPROVAL'`
   - **PassPurchase.tsx** (via API) creates orders with `status: 'PENDING_CASH'`
   - **Fix:** Standardize to `PENDING_CASH` for all COD orders

### ✅ Recommendations:

1. Update `CODOrder.tsx` to use `/api/create-order` endpoint
2. Add more comprehensive error logging
3. Add retry mechanism for SMS sending
4. Add order status change notifications
5. Add admin dashboard for monitoring COD orders

---

**This is the complete COD order flow with all code, logic, APIs, and routes. Review and let me know if you need clarification on any part!**
