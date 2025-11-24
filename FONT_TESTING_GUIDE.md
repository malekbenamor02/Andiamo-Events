# Font Testing Guide

This guide helps you test different font combinations that match the nightlife/events vibe of Andiamo Events.

## Current Font Setup
- **Headings**: Orbitron (futuristic, tech-style)
- **Body**: Inter (clean, modern sans-serif)

## Available Font Options

### Option 1: Modern & Bold ⭐ Recommended for Nightlife
- **Headings**: Bebas Neue (bold, impactful, great for events)
- **Body**: Work Sans (clean, modern, highly readable)

**To activate**: 
1. In `tailwind.config.ts`, uncomment Option 1 in fontFamily
2. Replace `font-orbitron` with `font-heading` in components
3. Replace body font with `font-body` in `src/index.css`

### Option 2: Clean & Contemporary
- **Headings**: Outfit (modern, clean, geometric)
- **Body**: DM Sans (modern, readable, professional)

### Option 3: Geometric & Modern
- **Headings**: Space Grotesk (geometric, modern, tech-forward)
- **Body**: Manrope (modern, geometric, friendly)

### Option 4: Energetic & Dynamic
- **Headings**: Rajdhani (futuristic but more readable than Orbitron)
- **Body**: Plus Jakarta Sans (contemporary, energetic)

### Option 5: Bold & Impactful
- **Headings**: Montserrat (versatile, modern, bold)
- **Body**: Poppins (friendly, modern, clean)

## Quick Test Instructions

1. **Choose a font option** from above
2. **Edit `tailwind.config.ts`**:
   - Uncomment the font option you want to test
   - Comment out the current fonts if needed

3. **Update `src/index.css`**:
   - Change the body font-family to use the new body font
   - Example: `font-family: "Work Sans", sans-serif;`

4. **Update components**:
   - Replace `font-orbitron` with `font-heading` in heading elements
   - Body text will automatically use the new body font

5. **Test and compare**:
   - Check how fonts look on different pages
   - Test readability at different sizes
   - Ensure fonts match the nightlife/energetic vibe

## Font Comparison

| Font Pair | Vibe | Best For |
|-----------|------|----------|
| Orbitron + Inter | Futuristic, Tech | Current setup |
| Bebas Neue + Work Sans | Bold, Energetic | Nightlife events ⭐ |
| Outfit + DM Sans | Clean, Modern | Professional events |
| Space Grotesk + Manrope | Geometric, Tech | Modern tech events |
| Rajdhani + Plus Jakarta | Energetic, Dynamic | Youth events |
| Montserrat + Poppins | Versatile, Friendly | General events |

## Testing Checklist

- [ ] Headings look bold and impactful
- [ ] Body text is readable at all sizes
- [ ] Fonts match the neon/energetic theme
- [ ] Works well on mobile devices
- [ ] Fonts load quickly
- [ ] Text is readable on dark backgrounds
- [ ] Fonts complement the gradient text effects

## Reverting Changes

To go back to original fonts:
1. Comment out the test fonts in `tailwind.config.ts`
2. Uncomment the original `orbitron` and `sans` fonts
3. Restore original body font in `src/index.css`

