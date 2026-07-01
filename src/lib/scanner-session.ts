export type ScannerSessionRole = 'scanner' | 'supervisor';

export type ScannerSessionUser = {
  id: string;
  name?: string;
  email?: string;
  role: ScannerSessionRole;
};

/** Accepts flat session API shape or optional `{ scanner }` wrapper. */
export function normalizeScannerSession(data: unknown): ScannerSessionUser | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const scanner = record.scanner ?? record;
  if (!scanner || typeof scanner !== 'object') return null;
  const s = scanner as Record<string, unknown>;
  const id = s.id;
  const role = s.role;
  if (typeof id !== 'string' || !id.trim()) return null;
  if (role !== 'scanner' && role !== 'supervisor') return null;
  return {
    id,
    role,
    name: typeof s.name === 'string' ? s.name : undefined,
    email: typeof s.email === 'string' ? s.email : undefined,
  };
}

export function isValidScannerSession(data: unknown): boolean {
  return normalizeScannerSession(data) !== null;
}

export function isAuthenticatedScannerSession(resOk: boolean, data: unknown): boolean {
  return resOk && isValidScannerSession(data);
}
