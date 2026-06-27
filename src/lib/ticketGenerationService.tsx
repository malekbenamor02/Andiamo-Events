/**
 * Ticket Generation Service
 *
 * SERVER-ONLY: Ticket writes (tickets, qr_tickets, email_delivery_logs) must run on the backend.
 * Client-side Supabase access to those tables has been removed.
 */

export interface TicketGenerationResult {
  success: boolean;
  tickets: unknown[];
  emailSent: boolean;
  error?: string;
}

const SERVER_ONLY =
  'Ticket generation is server-only. Use /api/generate-tickets-for-order from backend handlers.';

/** @deprecated Client-side ticket generation removed — use server API */
export const generateTicketsForOrder = async (_orderId: string): Promise<TicketGenerationResult> => {
  throw new Error(SERVER_ONLY);
};

/** @deprecated Client-side order monitoring removed — use server workflows */
export const useTicketGeneration = () => {
  const monitorOrderStatus = (_orderId: string, _callback?: (result: TicketGenerationResult) => void) => {
    throw new Error(SERVER_ONLY);
  };

  return { monitorOrderStatus, generateTicketsForOrder };
};
