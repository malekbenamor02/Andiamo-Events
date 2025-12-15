# Email Assets

This folder contains logo images for email templates.

## Logo Files Needed

You need to add two PNG logo files here:
- `logo-black.png` - Black logo for light mode emails
- `logo-white.png` - White logo for dark mode emails

## Converting Images to Base64

After adding your logo images, you need to convert them to base64 strings and update `src/lib/email-assets.ts`.

### Option 1: Using Node.js (Recommended)

Create a temporary script or run in Node.js console:

```javascript
const fs = require('fs');

// Read and convert logo-black.png
const blackLogo = fs.readFileSync('./public/email-assets/logo-black.png');
const blackBase64 = blackLogo.toString('base64');

// Read and convert logo-white.png
const whiteLogo = fs.readFileSync('./public/email-assets/logo-white.png');
const whiteBase64 = whiteLogo.toString('base64');

console.log('Black Logo Base64:', blackBase64);
console.log('White Logo Base64:', whiteBase64);
```

### Option 2: Using Online Tool

1. Visit https://www.base64-image.de/
2. Upload your `logo-black.png`
3. Copy the base64 string
4. Replace `PLACEHOLDER_BLACK_LOGO_BASE64` in `src/lib/email-assets.ts`
5. Repeat for `logo-white.png`

### Option 3: Using Command Line (Mac/Linux)

```bash
base64 -i public/email-assets/logo-black.png
base64 -i public/email-assets/logo-white.png
```

### Option 4: Using PowerShell (Windows)

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("public/email-assets/logo-black.png"))
[Convert]::ToBase64String([IO.File]::ReadAllBytes("public/email-assets/logo-white.png"))
```

## Updating the Code (Automatic Method - Recommended)

After adding your logo PNG files, simply run:

```bash
node scripts/update-email-logos.cjs
```

This script will automatically:
1. Read the logo images from `public/email-assets/`
2. Convert them to base64
3. Update `src/lib/email-assets.ts` with the encoded strings

## Manual Method

If you prefer to do it manually, after getting the base64 strings, update `src/lib/email-assets.ts`:

```typescript
export const EMAIL_LOGOS = {
  logoBlack: `data:image/png;base64,YOUR_BLACK_LOGO_BASE64_STRING_HERE`,
  logoWhite: `data:image/png;base64,YOUR_WHITE_LOGO_BASE64_STRING_HERE`
};
```

## Result

The logos will then be embedded directly in the email HTML, making them work even when email clients block external images. No external URL dependencies!

