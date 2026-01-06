# Embedded Payment vs Redirect - Explanation

## Why Payment Was Outside Your Platform

Flouci's standard payment flow uses a **redirect mechanism** - this is their primary method for security and compliance reasons. When you generate a payment, Flouci returns a checkout URL that you redirect users to.

**Original Flow:**
```
Your Site → Generate Payment → Redirect to Flouci → User Pays → Redirect Back
```

## Solution: Embedded Payment (Iframe)

I've now implemented an **embedded payment solution** that keeps users on your site while still using Flouci's secure hosted payment page.

**New Flow:**
```
Your Site → Generate Payment → Embed Flouci in iframe → User Pays → Redirect Back
```

## How It Works

### 1. Payment Generation (Same as Before)
- Backend generates Flouci payment
- Returns payment link

### 2. Embedded Display (New)
- Instead of redirecting (`window.location.href`), the payment link is embedded in an iframe
- User sees your site's header/navigation
- Payment form appears inside your page
- User stays on your domain

### 3. Payment Completion (Same as Before)
- After payment, Flouci redirects to your success/fail URLs
- Your site verifies payment and updates order status

## Benefits of Embedded Payment

✅ **User Experience:**
- Users stay on your site (no external redirect)
- Your branding/navigation remains visible
- Feels more integrated

✅ **Security:**
- Still uses Flouci's secure hosted payment page
- No PCI compliance burden on your side
- Payment form is served directly from Flouci

✅ **Trust:**
- Users see your site URL in the browser
- Less confusion about leaving your site

## Technical Implementation

The payment page now shows:

```tsx
<iframe
  src={paymentLink}  // Flouci checkout URL
  style={{ minHeight: '600px', height: '80vh' }}
  title="Flouci Payment"
  allow="payment"
  sandbox="allow-forms allow-scripts allow-same-origin allow-top-navigation allow-popups"
/>
```

**Key Features:**
- Full-height iframe (80vh) for comfortable payment experience
- Sandbox attributes for security
- Responsive design
- Your site's styling around the iframe

## Iframe Limitations

⚠️ **Note:** Some payment gateways don't allow iframe embedding for security reasons. If Flouci blocks iframe embedding, you'll see an error and we can fall back to redirect.

**If iframe doesn't work:**
- The code will automatically fall back to redirect
- Or you can manually switch by changing one line in the code

## Switching Between Embedded and Redirect

### Current: Embedded (Iframe)
```tsx
// Store payment link for embedded payment
setPaymentLink(paymentData.link);
setStatus('redirecting');
// iframe displays automatically
```

### Alternative: Redirect (External)
```tsx
// Redirect to Flouci payment page
window.location.href = paymentData.link;
```

## Testing

1. **Try making a payment** - you should see the Flouci checkout form inside your site
2. **Check browser console** - if iframe is blocked, you'll see an error
3. **Complete payment** - should redirect back to your success page

## Troubleshooting

### Iframe Blocked by Flouci
**Symptom:** Blank iframe or error message

**Solution:** 
- Flouci may not allow iframe embedding
- Switch to redirect method (change one line of code)
- Or contact Flouci support to enable iframe embedding

### Payment Form Not Loading
**Symptom:** Iframe shows loading but never loads

**Solution:**
- Check browser console for CORS/iframe errors
- Verify payment link is valid
- Try redirect method as fallback

### Redirect Still Happening
**Symptom:** User is redirected to Flouci site

**Solution:**
- Check that `paymentLink` state is set correctly
- Verify iframe is rendering (check DOM)
- Make sure status is 'redirecting' and paymentLink exists

## Summary

✅ **Embedded Payment is Now Active**
- Payment form appears inside your site
- Users stay on your domain
- Still uses Flouci's secure payment processing
- Better user experience

The payment is now **inside your platform** while maintaining security and compliance through Flouci's hosted payment page!

