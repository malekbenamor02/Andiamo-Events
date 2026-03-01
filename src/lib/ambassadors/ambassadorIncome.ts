/**
 * Ambassador income calculation (COD / ambassador cash orders).
 *
 * Rules:
 * - First 7 tickets: no payment.
 * - From 8th ticket onward: 3 DT per ticket.
 * - 15 tickets sold: +15 DT bonus (one-time).
 * - 25 tickets sold: +20 DT bonus (one-time).
 * - From 35 tickets: +20 DT for every additional block of 10 tickets (45, 55, 65, ...).
 */
export function calculateAmbassadorIncome(ticketsSold: number): number {
  if (ticketsSold <= 7) return 0;

  // Base: 3 DT per ticket from the 8th onward
  const base = (ticketsSold - 7) * 3;

  // Bonuses
  const bonus15 = ticketsSold >= 15 ? 15 : 0;
  const bonus25 = ticketsSold >= 25 ? 20 : 0;
  const bonus35Blocks = ticketsSold >= 35 ? Math.floor((ticketsSold - 35) / 10) * 20 : 0;

  return base + bonus15 + bonus25 + bonus35Blocks;
}
