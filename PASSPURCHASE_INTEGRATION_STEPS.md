# PassPurchase Integration Steps - Quick Reference

## Key Changes Needed

### 1. Field Name Mapping
- Old: `customerInfo.fullName` → New: `customerInfo.full_name`
- Old: `paymentMethod: 'online' | 'cod'` → New: `PaymentMethod` enum
- Old: `'cod'` → New: `PaymentMethod.AMBASSADOR_CASH`

### 2. State Updates
```typescript
// OLD
const [customerInfo, setCustomerInfo] = useState({
  fullName: '',
  email: '',
  phone: '',
  city: '',
  ville: ''
});

// NEW  
import { CustomerInfo } from '@/types/orders';
const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
  full_name: '',
  email: '',
  phone: '',
  city: '',
  ville: undefined
});
```

### 3. Payment Method
```typescript
// OLD
const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod' | ''>('online');

// NEW
import { PaymentMethod } from '@/lib/constants/orderStatuses';
const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
```

### 4. Add New State
```typescript
const [selectedAmbassadorId, setSelectedAmbassadorId] = useState<string | null>(null);
const { data: paymentOptions = [] } = usePaymentOptions();
```

### 5. Replace Components in JSX
- Customer info form → `<CustomerInfoForm>`
- Payment radio buttons → `<PaymentOptionSelector>`
- Ambassador listing → `<AmbassadorSelector>` (inline)
- Order summary → `<OrderSummary>`

### 6. Update Order Creation
Use `createOrder` from `@/lib/orders/orderService` instead of inline order creation.

