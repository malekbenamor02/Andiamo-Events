/**
 * Flouci Payment Service
 * Handles integration with Flouci Payment API
 */

const FLOUCI_API_BASE = 'https://developers.flouci.com/api/v2';

export interface FlouciPaymentRequest {
  amount: number; // Amount in millimes (1 TND = 1000 millimes)
  success_link: string;
  fail_link: string;
  webhook: string;
  developer_tracking_id: string;
  session_timeout_secs?: number;
  accept_card?: boolean;
  image_url?: string;
}

export interface FlouciPaymentResponse {
  success: boolean;
  result?: {
    link: string;
    payment_id: string;
  };
  message?: string;
}

export interface FlouciVerifyResponse {
  success: boolean;
  result?: {
    status: 'SUCCESS' | 'PENDING' | 'EXPIRED' | 'FAILURE';
    amount?: number;
    transaction_id?: string;
    [key: string]: any;
  };
  message?: string;
}

/**
 * Generate a payment request with Flouci
 */
export async function generateFlouciPayment(
  request: FlouciPaymentRequest,
  publicKey: string,
  secretKey: string
): Promise<FlouciPaymentResponse> {
  const response = await fetch(`${FLOUCI_API_BASE}/generate_payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${publicKey}:${secretKey}`
    },
    body: JSON.stringify(request)
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || `Flouci API error: ${response.status}`);
  }

  return data;
}

/**
 * Verify a payment status with Flouci
 */
export async function verifyFlouciPayment(
  paymentId: string,
  publicKey: string,
  secretKey: string
): Promise<FlouciVerifyResponse> {
  const response = await fetch(`${FLOUCI_API_BASE}/verify_payment/${paymentId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${publicKey}:${secretKey}`
    }
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || `Flouci API error: ${response.status}`);
  }

  return data;
}

/**
 * Convert TND to millimes (Flouci uses millimes)
 */
export function tndToMillimes(amount: number): number {
  return Math.round(amount * 1000);
}

/**
 * Convert millimes to TND
 */
export function millimesToTnd(millimes: number): number {
  return millimes / 1000;
}

