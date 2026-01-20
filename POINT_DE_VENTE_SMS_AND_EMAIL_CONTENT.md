# Point de Vente (POS) – SMS and Email Content

Text content only. Placeholders: `{order_number}`, `{passes_text}`, `{total_price}`, `{event_name}`, `{customer_name}`.

---

## 1. SMS – On POS order create (to client)

**When:** Right after the POS user submits an order.  
**Purpose:** Confirm receipt; tell client it is pending admin approval; no ambassador.

### French

```
Commande #{order_number} reçue – Point de vente
Pass: {passes_text} | Total: {total_price} DT
En attente de validation. Billets par email après approbation.
We Create Memories
```

### English

```
Order #{order_number} received – Point de vente
Pass: {passes_text} | Total: {total_price} DT
Pending approval. Tickets by email once validated.
We Create Memories
```

**Example (FR):**  
`Commande #518954 reçue – Point de vente`  
`Pass: VIP x2, Standard x1 | Total: 150 DT`  
`En attente de validation. Billets par email après approbation.`  
`We Create Memories`

---

## 2. SMS – On admin approve (to client)

**When:** After admin approves a POS order; tickets have been generated and completion email sent.  
**Purpose:** Short confirmation that payment is confirmed and tickets are in the email.  
**Note:** Reuse the existing `buildClientAdminApprovalSMS` template (same as COD).

### French (existing)

```
Paiement confirmé #{order_number}
Total: {total_price} DT
Billets envoyés par email (Check SPAM).
We Create Memories
```

### English (if used)

```
Payment confirmed #{order_number}
Total: {total_price} DT
Tickets sent by email (Check SPAM).
We Create Memories
```

---

## 3. Email – On POS order create (to client) – “Order received”

**When:** Right after the POS user submits an order.  
**Purpose:** Confirm receipt; explain that the order is pending admin approval and that a final email with tickets will be sent after approval. No ambassador, no tickets.

### Subject

- **FR:** `Commande reçue – Andiamo Events`
- **EN:** `Order received – Andiamo Events`

### Body (plain text / to be placed in HTML)

**French:**

```
Bonjour {customer_name},

Votre commande #{order_number} a bien été enregistrée via notre Point de vente.

Détails :
• Événement : {event_name}
• Pass : {passes_text}
• Total : {total_price} DT

Votre commande est en attente de validation par notre équipe. Une fois approuvée, vous recevrez un email de confirmation avec vos billets (QR codes). Pensez à vérifier vos spams.

Pour toute question : contactez-nous via notre site.

We Create Memories
L’équipe Andiamo Events
```

**English:**

```
Hello {customer_name},

Your order #{order_number} has been received via our Point de vente.

Details:
• Event: {event_name}
• Pass: {passes_text}
• Total: {total_price} DT

Your order is pending approval by our team. Once approved, you will receive a confirmation email with your tickets (QR codes). Please check your spam folder.

For any questions: contact us via our website.

We Create Memories
The Andiamo Events Team
```

---

## 4. Email – On admin approve (to client) – “Completion” (with tickets)

**When:** After admin approves a POS order; tickets/QR are generated and attached or linked.  
**Purpose:** Confirm payment and provide tickets; same structure as COD completion, but **no ambassador** — use “Andiamo Events” instead of “Delivered by: {ambassador_name}”.

### Subject

- **FR:** `Commande confirmée – Vos billets – Andiamo Events`
- **EN:** `Order confirmed – Your tickets – Andiamo Events`

(or reuse existing: `Order Confirmation - Your Pass Purchase is Complete!`)

### Body (main paragraphs, for HTML template)

**French:**

```
Bonjour {customer_name},

Votre achat de pass a été validé. Votre commande est confirmée.

Détails de la commande :
• N° de commande : #{order_number}
• Événement : {event_name}
• Lieu : {venue_name}
• Date et heure : {event_time}

Pass commandés :
[Table: Pass | Quantité | Prix]

Montant total payé : {total_amount} TND

[Billets / QR codes – selon le template existant]

Validé par : Andiamo Events

En cas de question : contactez-nous via notre site.

We Create Memories
L’équipe Andiamo Events
```

**English:**

```
Hello {customer_name},

Your pass purchase has been validated. Your order is confirmed.

Order details:
• Order #: #{order_number}
• Event: {event_name}
• Venue: {venue_name}
• Date & time: {event_time}

Passes purchased:
[Table: Pass | Quantity | Price]

Total amount paid: {total_amount} TND

[Your digital ticket / QR codes – as in existing template]

Validated by: Andiamo Events

If you have any questions: contact us via our website.

We Create Memories
The Andiamo Events Team
```

**Difference vs COD:**  
- COD: “Delivered by: {ambassador_name}”  
- POS: “Validated by: Andiamo Events” (or “Validé par : Andiamo Events”).  
- No ambassador block; keep the same layout, passes table, QR/tickets block, support link, and footer.

---

## 5. Resend “Order received” (pending POS orders)

**When:** Admin chooses “Resend order received” for a **pending** POS order (no tickets yet).  
**Content:** Same as **§ 3. Email – On POS order create**.

---

## 6. Resend “Completion” (approved POS orders)

**When:** Admin chooses “Resend email” for an **approved** POS order (tickets exist).  
**Content:** Same as **§ 4. Email – On admin approve**; reuse existing completion email logic with ambassador block replaced by “Andiamo Events” for `source = 'point_de_vente'`.

---

## 7. Placeholder reference

| Placeholder     | Example / source                                  |
|-----------------|---------------------------------------------------|
| `{order_number}`| `518954` (from `orders.order_number`)             |
| `{passes_text}` | `VIP x2, Standard x1` (from order_passes)         |
| `{total_price}` | `150` (from `orders.total_price`, no decimals)    |
| `{event_name}`  | `events.name`                                     |
| `{customer_name}` | `orders.user_name`                              |
| `{venue_name}`  | `events.venue`                                    |
| `{event_time}`  | Formatted `events.date`                           |
| `{total_amount}`| `orders.total_price` with 2 decimals for email    |

---

*Content only. Implementation (templates, layout, i18n) follows the main POS plan.*
