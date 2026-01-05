# Integration Plan for PassPurchase.tsx

## Strategy
Since PassPurchase.tsx is 1281 lines, I'll integrate the new components strategically:

1. Add new imports at the top
2. Update state management to use new types
3. Replace customer info form section with CustomerInfoForm component
4. Replace payment method selection with PaymentOptionSelector component
5. Add AmbassadorSelector component when ambassador_cash is selected
6. Add OrderSummary component
7. Update order creation to use createOrder service
8. Keep all existing functionality (event display, pass selection, etc.)

## Key Changes

### State Updates
- Change `paymentMethod` from `'online' | 'cod' | ''` to `PaymentMethod | null`
- Add `selectedAmbassadorId` state
- Update `customerInfo` to use `CustomerInfo` type
- Add `usePaymentOptions` hook

### Component Replacements
- Customer info form → `<CustomerInfoForm>`
- Payment method radio buttons → `<PaymentOptionSelector>`
- Ambassador listing screen → `<AmbassadorSelector>` (inline, not separate screen)
- Order summary → `<OrderSummary>`

### Flow Changes
- NEW: Customer info collected FIRST (before payment selection)
- NEW: Payment options fetched from database
- NEW: Ambassador selection inline (not separate screen)
- NEW: Uses unified order creation service

## Preserved
- Event display
- Pass selection UI
- All translations
- Styling/theme
- Navigation logic
- Loading states

