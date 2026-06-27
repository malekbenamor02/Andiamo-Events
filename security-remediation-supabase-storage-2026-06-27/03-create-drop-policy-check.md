# CREATE / DROP POLICY pairing — `20260627140000_fix_storage_bucket_security.sql`

**Result: PASS** — Every `CREATE POLICY` has a matching `DROP POLICY IF EXISTS` immediately before it. No `USING (true)` / `WITH CHECK (true)` on write policies.

## Pre-create DROP blocks (legacy / dangerous policies)

| DROP POLICY | Line |
|-------------|------|
| `Allow all operations for images` | 72 |
| `Public can delete images` | 73 |
| `Public can upload images` | 74 |
| `Public can delete hero images` | 75 |
| `Public can upload hero images` | 76 |
| `Public can upload career documents` | 77 |
| `Public can view career documents` | 78 |
| `Public can view images` | 79 |
| `Anyone can upload images` | 80 |
| `Anyone can delete images` | 81 |
| `Anyone can upload hero images` | 82 |
| `Anyone can delete hero images` | 83 |
| `Anyone can upload career documents` | 84 |
| `Public can view ticket QR codes` | 85 |

## CREATE POLICY ↔ DROP POLICY pairs

| CREATE POLICY (line) | DROP POLICY IF EXISTS (line) | Match |
|----------------------|------------------------------|-------|
| `Service role can upload ticket QR codes` (97) | same name (90) | ✓ |
| `Service role can update ticket QR codes` (101) | same name (91) | ✓ |
| `Service role can delete ticket QR codes` (106) | same name (92) | ✓ |
| `Service role manage career documents` (111) | same name (110) | ✓ |
| `Service role manage academy payment proofs` (117) | same name (116) | ✓ |
| `Service role manage marketing images` (123) | same name (122) | ✓ |
| `Service role manage hero images` (129) | same name (128) | ✓ |

## Additional ticket policy cleanup (before CREATE block)

| DROP POLICY | Line |
|-------------|------|
| `Service role full access to tickets 1d5g1yf_1` | 93 |
| `Service role full access to tickets 1d5g1yf_2` | 94 |
| `Service role full access to tickets 1d5g1yf_3` | 95 |

## Idempotency notes

- Bucket `UPDATE` statements are idempotent (`WHERE id = …`).
- All policy changes use `DROP POLICY IF EXISTS` before `CREATE POLICY`.
- Re-running the migration does not delete storage objects.
- Public read on `images` / `hero-images` relies on bucket `public = true` and absence of broad anon write/delete policies (not recreated).
