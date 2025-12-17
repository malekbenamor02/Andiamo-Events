# Andiamo Events - Color Palette Documentation

## Overview
This document outlines the complete color palette used in the Andiamo Events application. All colors are defined in HSL format using the **Default (Nightlife Black & Red Theme)**.

---

## 🎨 Base Color System

### Background & Surface Colors

| Color Name | HSL Value | Hex Equivalent | Usage |
|------------|-----------|----------------|-------|
| **Background** | `0 0% 0%` | `#000000` | Main page background, deep nightlife theme base |
| **Card** | `0 0% 10%` | `#1A1A1A` | Card backgrounds, elevated surfaces, modals |
| **Popover** | `0 0% 10%` | `#1A1A1A` | Popover/dropdown backgrounds |
| **Input** | `0 0% 16%` | `#2A2A2A` | Input field backgrounds |
| **Muted** | `0 0% 22%` | `#383838` | Muted backgrounds, disabled states |

### Text & Foreground Colors

| Color Name | HSL Value | Hex Equivalent | Usage |
|------------|-----------|----------------|-------|
| **Foreground** | `0 0% 100%` | `#FFFFFF` | Primary text color, main content |
| **Card Foreground** | `0 0% 100%` | `#FFFFFF` | Text on card backgrounds |
| **Popover Foreground** | `0 0% 100%` | `#FFFFFF` | Text in popovers |
| **Muted Foreground** | `0 0% 72%` | `#B8B8B8` | Secondary text, labels, hints |

### Border & Input Colors

| Color Name | HSL Value | Hex Equivalent | Usage |
|------------|-----------|----------------|-------|
| **Border** | `0 0% 26%` | `#424242` | Borders, dividers, separators |
| **Ring** | `352 80% 49%` | `#E21836` | Focus rings, active states (matches primary) |

---

## 🌈 Primary Brand Colors

### Primary Color (Red)
- **HSL**: `352 80% 49%`
- **Hex**: `#E21836`
- **RGB**: `rgb(226, 24, 54)`
- **Usage**: 
  - Primary buttons
  - Main brand accent
  - Focus states
  - Active navigation items
  - Primary CTAs
  - Neon glow effects

### Secondary Color (Purple)
- **HSL**: `270 80% 60%`
- **Hex**: `#9D6BFF`
- **RGB**: `rgb(157, 107, 255)`
- **Usage**:
  - Secondary buttons
  - Complementary accents
  - Gradient combinations
  - Secondary CTAs

### Accent Color (Cyan)
- **HSL**: `195 100% 55%`
- **Hex**: `#00CFFF`
- **RGB**: `rgb(0, 207, 255)`
- **Usage**:
  - Accent highlights
  - Special features
  - Hover states
  - Decorative elements

### Destructive Color (Dark Red)
- **HSL**: `352 85% 42%`
- **Hex**: `#C0132C`
- **RGB**: `rgb(192, 19, 44)`
- **Usage**:
  - Error states
  - Delete actions
  - Warning messages
  - Destructive buttons

---

## ✨ Neon Color Palette

| Color Name | HSL Value | Hex Equivalent | RGB | Usage |
|------------|-----------|----------------|-----|-------|
| **Neon Red** | `352 100% 65%` | `#FF3B5C` | `rgb(255, 59, 92)` | Primary neon glow, main brand neon |
| **Neon Purple** | `270 90% 65%` | `#B084FF` | `rgb(176, 132, 255)` | Secondary neon glow |
| **Neon Cyan** | `195 100% 55%` | `#00CFFF` | `rgb(0, 207, 255)` | Accent neon glow |
| **Neon Gold** | `45 100% 55%` | `#FFC93C` | `rgb(255, 201, 60)` | Highlight neon, special accents |
| **Neon Orange** | `25 100% 60%` | `#FF9F3D` | `rgb(255, 159, 61)` | Warm neon accents |

**Usage**: Neon colors are used for:
- Glow effects on buttons and cards
- Text gradients
- Animated backgrounds
- Hover states
- Decorative elements
- Particle effects (stars, sparkles)

---

## 🎭 Sidebar Colors

| Color Name | HSL Value | Hex Equivalent | Usage |
|------------|-----------|----------------|-------|
| **Sidebar Background** | `0 0% 0%` | `#000000` | Sidebar container background |
| **Sidebar Foreground** | `0 0% 100%` | `#FFFFFF` | Sidebar text color |
| **Sidebar Primary** | `352 80% 49%` | `#E21836` | Active sidebar items |
| **Sidebar Primary Foreground** | `0 0% 100%` | `#FFFFFF` | Text on active sidebar items |
| **Sidebar Accent** | `0 0% 16%` | `#2A2A2A` | Hovered sidebar items |
| **Sidebar Accent Foreground** | `0 0% 100%` | `#FFFFFF` | Text on hovered sidebar items |
| **Sidebar Border** | `0 0% 26%` | `#424242` | Sidebar dividers |
| **Sidebar Ring** | `352 80% 49%` | `#E21836` | Sidebar focus rings |

---

## 🎨 Gradient Definitions

### Primary Gradient
```css
linear-gradient(135deg, hsl(352 80% 49%), hsl(352 100% 65%))
```
**Colors**: Red → Neon Red  
**Usage**: Primary buttons, main CTAs, hero sections

### Neon Gradient
```css
linear-gradient(135deg, hsl(352 80% 49%), hsl(270 80% 60%), hsl(195 100% 55%))
```
**Colors**: Red → Purple → Cyan  
**Usage**: Text gradients, decorative backgrounds, animated elements

### Dark Gradient
```css
linear-gradient(135deg, hsl(0 0% 0%), hsl(0 0% 10%))
```
**Colors**: Black → Dark surface  
**Usage**: Card backgrounds, subtle depth effects

---

## 💫 Shadow & Glow Effects

### Neon Shadow
- **Value**: `0 0 30px hsl(352 100% 65% / 0.6)`
- **Usage**: Card shadows, button glows, hover effects

### Strong Neon Shadow
- **Value**: `0 0 40px hsl(352 100% 65% / 0.8)`
- **Usage**: Active states, focused elements

### Cyan Shadow
- **Value**: `0 0 20px hsl(195 100% 55% / 0.5)`
- **Usage**: Secondary element glows

### Purple Shadow
- **Value**: `0 0 20px hsl(270 90% 65% / 0.5)`
- **Usage**: Accent element glows

---

## 📝 Usage Guidelines

### When to Use Each Color:

1. **Primary (Red `#E21836`)**: 
   - Main call-to-action buttons
   - Active navigation states
   - Primary brand elements
   - Focus indicators
   - Main neon glow effects

2. **Secondary (Purple `#9D6BFF`)**:
   - Secondary buttons
   - Complementary accents
   - Information highlights
   - Gradient combinations

3. **Accent (Cyan `#00CFFF`)**:
   - Special features
   - Decorative elements
   - Hover states on non-primary elements
   - Accent highlights

4. **Destructive (Dark Red `#C0132C`)**:
   - Error messages
   - Delete/remove actions
   - Warning states
   - Destructive buttons

5. **Muted Colors**:
   - Disabled states
   - Secondary information
   - Placeholder text
   - Subtle backgrounds

6. **Neon Colors**:
   - Glow effects
   - Animated backgrounds
   - Text gradients
   - Decorative particles
   - Special effects

---

## 🔧 Implementation

### CSS Variables
All colors are defined as CSS custom properties in `src/index.css`:
```css
:root {
  --background: 0 0% 0%;
  --foreground: 0 0% 100%;
  --primary: 352 80% 49%;
  --secondary: 270 80% 60%;
  --accent: 195 100% 55%;
  --destructive: 352 85% 42%;
  --neon-purple: 352 100% 65%;
  --neon-cyan: 195 100% 55%;
  --neon-pink: 270 90% 65%;
  --neon-yellow: 45 100% 55%;
  --neon-orange: 25 100% 60%;
  /* ... */
}
```

### Tailwind Usage
Colors can be used in Tailwind classes:
```tsx
className="bg-primary text-primary-foreground"
className="border-secondary"
className="text-accent"
className="bg-neon-purple"
className="text-neon-cyan"
```

### Theme Context
Colors are managed through `ThemeContext.tsx` and applied dynamically via CSS variables.

---

## 🎯 Color Accessibility

- **Contrast Ratios**: All foreground colors on their backgrounds meet WCAG AA standards (minimum 4.5:1)
- **Text Colors**: White (`#ffffff`) on black backgrounds ensures high readability
- **Focus States**: Primary color (`#E21836`) used for focus rings ensures visibility

---

## 📱 Responsive Considerations

Colors remain consistent across all screen sizes. Neon effects and glows may be reduced on mobile for performance.

---

## 🎨 Complete Color Reference

### Quick Reference Table

| Category | Color | HSL | Hex | Usage |
|----------|-------|-----|-----|-------|
| **Background** | Black | `0 0% 0%` | `#000000` | Main background |
| **Card** | Dark Gray | `0 0% 10%` | `#1A1A1A` | Cards, modals |
| **Primary** | Red | `352 80% 49%` | `#E21836` | Main brand color |
| **Secondary** | Purple | `270 80% 60%` | `#9D6BFF` | Secondary accents |
| **Accent** | Cyan | `195 100% 55%` | `#00CFFF` | Accent highlights |
| **Destructive** | Dark Red | `352 85% 42%` | `#C0132C` | Errors, delete |
| **Border** | Gray | `0 0% 26%` | `#424242` | Borders, dividers |
| **Muted** | Gray | `0 0% 22%` | `#383838` | Disabled states |

---

*Last Updated: January 2025*  
*Theme: Default (Nightlife Black & Red) - Single Theme System*
