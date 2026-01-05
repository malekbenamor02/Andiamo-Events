# UI Integration Guide
## How to Integrate New Order Components into PassPurchase.tsx

The new unified order system components have been created. Here's how to integrate them into PassPurchase.tsx.

---

## ✅ Components Created

1. **CustomerInfoForm** - `src/components/orders/CustomerInfoForm.tsx`
2. **PaymentOptionSelector** - `src/components/orders/PaymentOptionSelector.tsx`
3. **AmbassadorSelector** - `src/components/orders/AmbassadorSelector.tsx`
4. **OrderSummary** - `src/components/orders/OrderSummary.tsx`

---

## 📋 Integration Steps

### Step 1: Import New Components

Add these imports at the top of `PassPurchase.tsx`:

```typescript
import { CustomerInfoForm } from '@/components/orders/CustomerInfoForm';
import { PaymentOptionSelector } from '@/components/orders/PaymentOptionSelector';
import { AmbassadorSelector } from '@/components/orders/AmbassadorSelector';
import { OrderSummary } from '@/components/orders/OrderSummary';
import { usePaymentOptions } from '@/hooks/usePaymentOptions';
import { PaymentMethod } from '@/lib/constants/orderStatuses';
import { CustomerInfo } from '@/types/orders';
```

### Step 2: Update State Management

Replace the current state with:

```typescript
// Customer info state (using new type)
const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
  fullName: '',
  phone: '',
  email: '',
  city: '',
  ville: undefined
});

// Payment method (using enum)
const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);

// Ambassador selection (for ambassador_cash)
const [selectedAmbassadorId, setSelectedAmbassadorId] = useState<string | null>(null);
const [termsAccepted, setTermsAccepted] = useState(false);

// Fetch payment options
const { data: paymentOptions = [], isLoading: loadingPaymentOptions } = usePaymentOptions();
```

### Step 3: Update Validation

Update validation to check:

```typescript
const validateForm = () => {
  const errors: Record<string, string> = {};

  // Customer info validation
  if (!customerInfo.fullName.trim()) errors.fullName = 'Full name is required';
  if (!customerInfo.phone.trim()) errors.phone = 'Phone is required';
  if (!customerInfo.email.trim()) errors.email = 'Email is required';
  if (!customerInfo.city) errors.city = 'City is required';
  if (customerInfo.city === 'Sousse' && !customerInfo.ville) {
    errors.ville = 'Ville is required for Sousse';
  }

  // Payment method validation
  if (!paymentMethod) errors.paymentMethod = 'Please select a payment method';

  // Ambassador validation (if ambassador_cash)
  if (paymentMethod === PaymentMethod.AMBASSADOR_CASH) {
    if (!selectedAmbassadorId) {
      errors.ambassador = 'Please select an ambassador';
    }
    if (!termsAccepted) {
      errors.terms = 'You must accept the terms';
    }
  }

  // Passes validation
  const hasPasses = selectedPasses.some(p => p.quantity > 0);
  if (!hasPasses) errors.passes = 'Please select at least one pass';

  setValidationErrors(errors);
  return Object.keys(errors).length === 0;
};
```

### Step 4: Update Order Creation

Use the new order service:

```typescript
import { createOrder } from '@/lib/orders/orderService';
import { SelectedPass } from '@/types/orders';

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!validateForm()) {
    toast({
      title: t[language].error,
      description: 'Please fix the errors in the form',
      variant: 'destructive'
    });
    return;
  }

  setProcessing(true);

  try {
    const selectedPassesArray: SelectedPass[] = getSelectedPassesArray(); // Your existing function

    const order = await createOrder({
      customerInfo,
      passes: selectedPassesArray,
      paymentMethod: paymentMethod!, // Validated above
      ambassadorId: paymentMethod === PaymentMethod.AMBASSADOR_CASH ? selectedAmbassadorId! : undefined,
      eventId: eventId || undefined
    });

    // Handle redirect based on payment method
    if (paymentMethod === PaymentMethod.ONLINE) {
      navigate(`/payment-processing?orderId=${order.id}`);
    } else if (paymentMethod === PaymentMethod.EXTERNAL_APP) {
      // Redirect to external app
      const option = paymentOptions.find(o => o.option_type === 'external_app');
      if (option?.external_link) {
        window.location.href = option.external_link;
      }
    } else if (paymentMethod === PaymentMethod.AMBASSADOR_CASH) {
      // Show success message
      toast({
        title: t[language].success,
        description: 'Your order has been submitted. An ambassador will contact you soon.',
        variant: 'default'
      });
      navigate('/events');
    }
  } catch (error: any) {
    toast({
      title: t[language].error,
      description: error.message || 'Failed to create order',
      variant: 'destructive'
    });
  } finally {
    setProcessing(false);
  }
};
```

### Step 5: Update JSX - Replace Forms with New Components

Replace the customer info form section:

```typescript
{/* Customer Information */}
<Card>
  <CardHeader>
    <CardTitle>Customer Information</CardTitle>
  </CardHeader>
  <CardContent>
    <CustomerInfoForm
      customerInfo={customerInfo}
      onChange={setCustomerInfo}
      errors={validationErrors}
      language={language}
    />
  </CardContent>
</Card>
```

Replace payment method selection:

```typescript
{/* Payment Options */}
{loadingPaymentOptions ? (
  <div>Loading payment options...</div>
) : (
  <Card>
    <CardHeader>
      <CardTitle>Payment Method</CardTitle>
    </CardHeader>
    <CardContent>
      <PaymentOptionSelector
        options={paymentOptions}
        selectedMethod={paymentMethod}
        onSelect={setPaymentMethod}
        language={language}
      />
    </CardContent>
  </Card>
)}
```

Add ambassador selector (conditionally):

```typescript
{/* Ambassador Selection (for cash payment) */}
{paymentMethod === PaymentMethod.AMBASSADOR_CASH && customerInfo.city && (
  <Card>
    <CardHeader>
      <CardTitle>Select Ambassador</CardTitle>
    </CardHeader>
    <CardContent>
      <AmbassadorSelector
        city={customerInfo.city}
        ville={customerInfo.ville}
        selectedAmbassadorId={selectedAmbassadorId}
        onSelect={setSelectedAmbassadorId}
        termsAccepted={termsAccepted}
        onTermsChange={setTermsAccepted}
        language={language}
      />
    </CardContent>
  </Card>
)}
```

Replace order summary:

```typescript
{/* Order Summary */}
<OrderSummary
  selectedPasses={getSelectedPassesArray()}
  totalPrice={calculateTotal()}
  language={language}
/>
```

---

## 🔄 Flow Overview

1. **User selects passes** → Existing logic
2. **User fills customer info** → `CustomerInfoForm` component
3. **User selects payment method** → `PaymentOptionSelector` component
4. **If ambassador_cash** → `AmbassadorSelector` component appears
5. **User reviews order** → `OrderSummary` component
6. **User submits** → `createOrder` service function
7. **Redirect based on payment method**:
   - Online → Payment processing page
   - External App → External app URL
   - Ambassador Cash → Success message

---

## ⚠️ Important Notes

1. **Payment Options**: The system now fetches enabled payment options from the database
2. **Ambassador Status**: Only `ACTIVE` ambassadors are shown
3. **Order Status**: Uses new unified status system (PENDING_ONLINE, PENDING_CASH, etc.)
4. **Payment Method**: Uses enum values (online, external_app, ambassador_cash)

---

## 🚀 Next Steps

After integrating these components:

1. Test the flow for each payment method
2. Verify order creation works correctly
3. Test ambassador selection for cash payments
4. Verify validation works properly
5. Test with different cities/villes

---

## 📝 Key Differences from Old System

1. **Payment options are fetched from DB** (not hardcoded)
2. **Ambassador selection is manual** (no round-robin)
3. **Customer info is collected first** (before payment selection)
4. **Unified status system** (consistent across all payment methods)
5. **Components are reusable** (can be used in other parts of app)

