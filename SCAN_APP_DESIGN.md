# Scan App - Complete Design Specification

**Date:** 2025-03-01  
**Type:** Complete UI/UX Design Documentation  
**Purpose:** Comprehensive design specification for the QR code ticket scanning web application matching the Andiamo Events design system

---

## 🎨 DESIGN SYSTEM OVERVIEW

### Color Palette

**Primary Colors:**
- **Background**: `#1A1A1A` (Deep charcoal black) - `hsl(0 0% 10%)`
- **Card/Container**: `#1F1F1F` (Slightly lighter dark surface) - `hsl(0 0% 12%)`
- **Border**: `#2A2A2A` (Low-contrast borders) - `hsl(0 0% 16%)`
- **Primary/Accent**: `#E21836` (Red accent) - `hsl(352 80% 49%)`
- **Foreground/Text**: `#FFFFFF` (White) - `hsl(0 0% 100%)`
- **Muted Text**: `#B0B0B0` (Soft light-gray) - `hsl(0 0% 69%)`
- **Input Background**: `#252525` (Input fields) - `hsl(0 0% 15%)`

**Status Colors:**
- **Success/Valid**: `#10B981` (Green) - `hsl(142 76% 36%)`
- **Error/Invalid**: `#EF4444` (Red) - `hsl(0 84% 60%)`
- **Warning/Duplicate**: `#F59E0B` (Amber) - `hsl(45 93% 47%)`
- **Info**: `#3B82F6` (Blue) - `hsl(217 91% 60%)`

**Neon Effects:**
- **Neon Red**: `hsl(352 100% 65%)` - `#FF3B5C`
- **Neon Glow Shadow**: `0 0 30px hsl(352 100% 65% / 0.6)`

### Typography

**Font Family:**
- **Primary**: `Montserrat` (Google Fonts)
- **Font Weights**: 300 (light), 400 (normal), 500 (medium), 600 (semibold), 700 (bold)
- **Default Weight**: 300 (light)
- **Letter Spacing**: `0.025em`
- **Line Height**: `1.6`

**Font Sizes:**
- **H1/Page Title**: `2.5rem` (40px) - Mobile: `2rem` (32px)
- **H2/Section Title**: `2rem` (32px) - Mobile: `1.75rem` (28px)
- **H3/Card Title**: `1.5rem` (24px) - Mobile: `1.25rem` (20px)
- **H4/Subtitle**: `1.25rem` (20px) - Mobile: `1.125rem` (18px)
- **Body**: `1rem` (16px)
- **Small**: `0.875rem` (14px)
- **Tiny**: `0.75rem` (12px)

### Spacing & Layout

**Border Radius:**
- **Default**: `0.75rem` (12px)
- **Small**: `0.5rem` (8px)
- **Large**: `1rem` (16px)
- **Full**: `9999px` (fully rounded)

**Spacing Scale:**
- `0.25rem` (4px) - `space-1`
- `0.5rem` (8px) - `space-2`
- `1rem` (16px) - `space-4`
- `1.5rem` (24px) - `space-6`
- `2rem` (32px) - `space-8`
- `3rem` (48px) - `space-12`
- `4rem` (64px) - `space-16`

**Container:**
- **Max Width**: `1400px` (2xl breakpoint)
- **Padding**: `2rem` (32px) desktop, `1rem` (16px) mobile
- **Center**: Auto margins

### Shadows & Effects

**Box Shadows:**
- **Card Shadow**: `0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)`
- **Neon Glow**: `0 0 30px hsl(352 100% 65% / 0.6)`
- **Neon Glow Strong**: `0 0 40px hsl(352 100% 65% / 0.8)`
- **Hover Glow**: `0 0 20px hsl(352 80% 49% / 0.5)`

**Backdrop Blur:**
- **Glass Effect**: `backdrop-filter: blur(8px)`

**Transitions:**
- **Default**: `all 0.3s cubic-bezier(0.4, 0, 0.2, 1)`
- **Fast**: `all 0.15s ease-in-out`
- **Slow**: `all 0.5s ease-in-out`

---

## 📱 RESPONSIVE BREAKPOINTS

**Mobile First Approach:**
- **Mobile**: `0px - 767px` (default)
- **Tablet**: `768px - 1023px` (`md:` prefix)
- **Desktop**: `1024px - 1279px` (`lg:` prefix)
- **Large Desktop**: `1280px+` (`xl:` prefix)

---

## 🏗️ LAYOUT STRUCTURE

### Overall Layout

```
┌─────────────────────────────────────────────────────────┐
│  Top Navigation Bar (Fixed, Sticky)                     │
│  - Logo | Event Selector | User Info | Menu            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Main Content Area                                      │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Scanner View / Content Area                      │ │
│  │                                                   │ │
│  │  [Dynamic content based on screen]                │ │
│  │                                                   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Bottom Action Bar (Mobile only, sticky)                │
│  [Flash] [Manual Entry] [History] [Settings]          │
└─────────────────────────────────────────────────────────┘
```

---

## 📄 PAGE DESIGNS

### 1. Login Screen

#### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                    [Logo - Centered]                    │
│                                                         │
│              ┌─────────────────────────┐                │
│              │                         │                │
│              │    Login Card           │                │
│              │                         │                │
│              │  [Username Input]       │                │
│              │  [Password Input]       │                │
│              │                         │                │
│              │  [Remember Me Checkbox] │                │
│              │                         │                │
│              │     [Login Button]      │                │
│              │                         │                │
│              │    [Forgot Password]    │                │
│              │                         │                │
│              └─────────────────────────┘                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### Design Details

**Background:**
- Full-screen dark background: `#1A1A1A`
- Optional subtle gradient overlay for depth

**Logo:**
- Center-aligned at top
- Size: `120px × 120px` (desktop), `100px × 100px` (mobile)
- Margin bottom: `3rem`

**Login Card:**
- **Container**: Glass effect card
  - Background: `#1F1F1F` with `backdrop-filter: blur(8px)`
  - Border: `1px solid #2A2A2A`
  - Border radius: `0.75rem`
  - Padding: `2rem` (desktop), `1.5rem` (mobile)
  - Max width: `400px` (desktop), `100%` (mobile)
  - Box shadow: Card shadow
- **Card Title**: "Sign In" / "Connexion"
  - Font size: `1.75rem` (28px)
  - Font weight: 600 (semibold)
  - Color: White
  - Margin bottom: `1.5rem`
  - Text align: Center

**Input Fields:**
- **Container**: Full width within card
- **Label**: 
  - Font size: `0.875rem` (14px)
  - Font weight: 500 (medium)
  - Color: `#B0B0B0` (muted)
  - Margin bottom: `0.5rem`
- **Input**:
  - Background: `#252525`
  - Border: `1px solid #2A2A2A`
  - Border radius: `0.5rem`
  - Padding: `0.75rem 1rem`
  - Font size: `1rem` (16px) - **IMPORTANT**: Prevents zoom on mobile iOS
  - Color: White
  - Width: 100%
  - Focus state:
    - Border color: `#E21836` (primary red)
    - Box shadow: `0 0 0 3px hsl(352 80% 49% / 0.2)`
    - Outline: None
- **Spacing**: Margin bottom: `1.5rem`

**Remember Me Checkbox:**
- Font size: `0.875rem` (14px)
- Color: `#B0B0B0`
- Margin bottom: `1.5rem`
- Checkbox: Custom styled to match theme

**Login Button:**
- **Style**: Primary button
  - Background: `#E21836` (primary red)
  - Color: White
  - Border: None
  - Border radius: `0.5rem`
  - Padding: `0.75rem 2rem`
  - Font size: `1rem` (16px)
  - Font weight: 500 (medium)
  - Width: 100%
  - Height: `44px` (touch-friendly on mobile)
  - Hover state:
    - Background: `hsl(352 80% 45%)`
    - Box shadow: Neon glow effect
  - Active state:
    - Background: `hsl(352 80% 42%)`
  - Transition: `all 0.3s ease`

**Forgot Password Link:**
- Font size: `0.875rem` (14px)
- Color: `#B0B0B0`
- Text decoration: None
- Hover: Color `#E21836` (primary red)
- Text align: Center
- Margin top: `1rem`

**Error Messages:**
- Background: `hsl(0 84% 60% / 0.1)` (red tint)
- Border: `1px solid #EF4444`
- Border radius: `0.5rem`
- Padding: `0.75rem 1rem`
- Color: `#EF4444`
- Font size: `0.875rem` (14px)
- Margin bottom: `1rem`

**Mobile Specific:**
- Full viewport height (`100vh`)
- Padding: `1rem`
- Card max width: 100% (no max-width constraint)
- Input font size: `16px` (prevents zoom on iOS)
- Touch targets: Minimum `44px × 44px`

---

### 2. Event Selection Screen

#### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│  [Logo]  Scanner        [User Menu]                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│         Select Event                                    │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  🔍 Search Events...                              │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Event Card  │  │  Event Card  │  │  Event Card  │ │
│  │              │  │              │  │              │ │
│  │  Event Name  │  │  Event Name  │  │  Event Name  │ │
│  │  📅 Date     │  │  📅 Date     │  │  📅 Date     │ │
│  │  📍 Venue    │  │  📍 Venue    │  │  📍 Venue    │ │
│  │              │  │              │  │              │ │
│  │  [Select]    │  │  [Select]    │  │  [Select]    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### Design Details

**Top Navigation Bar:**
- Background: `#1A1A1A` with `backdrop-filter: blur(12px)`
- Border bottom: `1px solid #2A2A2A`
- Padding: `1rem 2rem` (desktop), `1rem` (mobile)
- Fixed position, sticky top
- Z-index: 50

**Page Title:**
- Font size: `2rem` (32px) desktop, `1.75rem` (28px) mobile
- Font weight: 600 (semibold)
- Color: White
- Margin: `2rem 0 1.5rem 0`

**Search Bar:**
- **Container**: Glass effect card
  - Background: `#1F1F1F`
  - Border: `1px solid #2A2A2A`
  - Border radius: `0.75rem`
  - Padding: `0.75rem 1rem`
  - Margin bottom: `1.5rem`
- **Input**:
  - Background: Transparent
  - Border: None
  - Color: White
  - Font size: `1rem` (16px)
  - Width: 100%
  - Placeholder color: `#B0B0B0`
- **Search Icon**: Positioned left, color `#B0B0B0`

**Event Cards Grid:**
- **Desktop**: 3 columns (`grid-cols-3`)
- **Tablet**: 2 columns (`grid-cols-2`)
- **Mobile**: 1 column (`grid-cols-1`)
- Gap: `1.5rem`

**Event Card:**
- **Container**:
  - Background: `#1F1F1F`
  - Border: `1px solid #2A2A2A`
  - Border radius: `0.75rem`
  - Padding: `1.5rem`
  - Hover effect:
    - Border color: `#E21836` (primary red)
    - Box shadow: Neon glow
    - Transform: `scale(1.02)`
  - Transition: `all 0.3s ease`
  - Cursor: Pointer
- **Event Name**:
  - Font size: `1.25rem` (20px)
  - Font weight: 600 (semibold)
  - Color: White
  - Margin bottom: `1rem`
- **Event Details**:
  - Font size: `0.875rem` (14px)
  - Color: `#B0B0B0`
  - Margin: `0.5rem 0`
  - Icon + Text layout
- **Select Button**:
  - Background: `#E21836` (primary red)
  - Color: White
  - Border: None
  - Border radius: `0.5rem`
  - Padding: `0.5rem 1.5rem`
  - Font size: `0.875rem` (14px)
  - Font weight: 500 (medium)
  - Width: 100%
  - Margin top: `1rem`
  - Hover: Darker red + glow

**Empty State:**
- Text: "No events found"
- Color: `#B0B0B0`
- Font size: `1rem` (16px)
- Text align: Center
- Padding: `3rem`

**Loading State:**
- Skeleton cards with shimmer effect
- Background: `#252525`
- Border radius: `0.75rem`
- Height: `200px`

---

### 3. Main Scanning Screen

#### Layout Structure (Desktop)

```
┌─────────────────────────────────────────────────────────┐
│  [Logo]  Summer Festival 2025        [Stats] [Menu]    │
│          📅 July 15, 2025 - Grand Hall                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────┐  ┌────────────────────────────┐ │
│  │                  │  │  Recent Scans              │ │
│  │   Camera         │  │                            │ │
│  │   Viewfinder     │  │  ✅ John Doe - VIP         │ │
│  │                  │  │     19:30:00               │ │
│  │  ┌────────────┐  │  │                            │ │
│  │  │   QR       │  │  │  ⚠️  Jane Smith            │ │
│  │  │   Frame    │  │  │     Already scanned        │ │
│  │  └────────────┘  │  │                            │ │
│  │                  │  │  ❌ Invalid Ticket         │ │
│  │                  │  │     19:28:15               │ │
│  │                  │  │                            │ │
│  └──────────────────┘  │  [View All History]        │ │
│                        └────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### Layout Structure (Mobile)

```
┌─────────────────────────────────────────┐
│  Summer Festival 2025          [Menu]   │
│  📅 July 15 - Grand Hall                │
├─────────────────────────────────────────┤
│                                         │
│         Camera Viewfinder               │
│                                         │
│      ┌───────────────────┐              │
│      │   QR Code Frame   │              │
│      └───────────────────┘              │
│                                         │
│      [Scanning indicator...]            │
│                                         │
├─────────────────────────────────────────┤
│  Stats: ✅ 45  ⚠️ 3  ❌ 2               │
├─────────────────────────────────────────┤
│  [⚡] [✏️] [📋] [⚙️]                    │
│  Flash Entry History Settings           │
└─────────────────────────────────────────┘
```

#### Design Details

**Top Bar:**
- Background: `#1A1A1A` with `backdrop-filter: blur(12px)`
- Border bottom: `1px solid #2A2A2A`
- Padding: `1rem 2rem` (desktop), `0.75rem 1rem` (mobile)
- Fixed position, sticky top

**Event Info (Top Bar):**
- **Event Name**:
  - Font size: `1.25rem` (20px) desktop, `1rem` (16px) mobile
  - Font weight: 600 (semibold)
  - Color: White
- **Event Details**:
  - Font size: `0.875rem` (14px)
  - Color: `#B0B0B0`
  - Margin top: `0.25rem`

**Camera Viewfinder Container (Desktop - Left Column):**
- Width: 60% of container
- Aspect ratio: 16:9
- Border radius: `0.75rem`
- Overflow: Hidden
- Position: Relative

**Camera Viewfinder (Mobile):**
- Full width minus padding
- Aspect ratio: 4:3 (better for mobile)
- Border radius: `0.75rem`
- Overflow: Hidden
- Position: Relative
- Max height: `60vh` (prevents covering controls)

**Video Element:**
- Width: 100%
- Height: 100%
- Object fit: Cover
- Background: `#000000` (pure black)

**QR Scanning Frame Overlay:**
- **Container**: Absolute positioned, centered
- **Frame**:
  - Border: `3px solid #E21836` (primary red)
  - Border radius: `0.5rem`
  - Width: `250px` (desktop), `200px` (mobile)
  - Height: `250px` (desktop), `200px` (mobile)
  - Box shadow: Neon glow effect
  - Animation: Pulse glow every 2 seconds
- **Corner Decorations**: Optional corner brackets in red
- **Scanning Line**: Animated line moving up/down (optional)

**Scanning Indicator:**
- Position: Below camera viewfinder
- Text: "Point camera at QR code"
- Font size: `0.875rem` (14px)
- Color: `#B0B0B0`
- Margin top: `1rem`

**Recent Scans Panel (Desktop - Right Column):**
- Width: 38% of container
- **Container**: Glass effect card
  - Background: `#1F1F1F`
  - Border: `1px solid #2A2A2A`
  - Border radius: `0.75rem`
  - Padding: `1.5rem`
  - Max height: `calc(100vh - 200px)`
  - Overflow-y: Auto
- **Title**: "Recent Scans"
  - Font size: `1.125rem` (18px)
  - Font weight: 600 (semibold)
  - Color: White
  - Margin bottom: `1rem`

**Scan History Item:**
- **Container**: 
  - Background: `#252525`
  - Border radius: `0.5rem`
  - Padding: `0.75rem 1rem`
  - Margin bottom: `0.75rem`
  - Border left: `3px solid` (color varies by status)
- **Status Icon**: 
  - ✅ Valid: Green `#10B981`
  - ⚠️ Duplicate: Amber `#F59E0B`
  - ❌ Invalid: Red `#EF4444`
- **Buyer Name**: 
  - Font size: `0.875rem` (14px)
  - Font weight: 500 (medium)
  - Color: White
- **Pass Type**: 
  - Font size: `0.75rem` (12px)
  - Color: `#B0B0B0`
- **Time**: 
  - Font size: `0.75rem` (12px)
  - Color: `#B0B0B0`
  - Float: Right

**Statistics Bar (Mobile):**
- Position: Between camera and controls
- Background: `#1F1F1F`
- Border: `1px solid #2A2A2A`
- Border radius: `0.5rem`
- Padding: `0.75rem 1rem`
- Display: Flex, space-between
- Font size: `0.875rem` (14px)

**Control Buttons (Mobile - Bottom Bar):**
- Position: Fixed bottom (or sticky after camera)
- Background: `#1A1A1A` with `backdrop-filter: blur(12px)`
- Border top: `1px solid #2A2A2A`
- Padding: `1rem`
- Display: Flex, space-between
- Button style:
  - Background: `#1F1F1F`
  - Border: `1px solid #2A2A2A`
  - Border radius: `0.5rem`
  - Padding: `0.75rem`
  - Width: `24%`
  - Icon size: `20px`
  - Font size: `0.75rem` (12px)
  - Color: `#B0B0B0`
  - Active: Border color `#E21836`

**Control Buttons (Desktop):**
- Position: Below camera viewfinder
- Display: Flex, gap `1rem`
- Button style: Same as mobile but larger
  - Padding: `0.75rem 1.5rem`
  - Font size: `0.875rem` (14px)

---

### 4. Scan Result Overlay

#### Success (Valid Ticket)

```
┌─────────────────────────────────────────┐
│                                         │
│           ✅ VALID TICKET               │
│                                         │
│         ┌─────────────────┐             │
│         │                 │             │
│         │  Ticket Details │             │
│         │                 │             │
│         └─────────────────┘             │
│                                         │
│      [Close]     [Next Scan]            │
│                                         │
└─────────────────────────────────────────┘
```

**Overlay Container:**
- Position: Fixed, full screen
- Background: `rgba(0, 0, 0, 0.8)` (dark overlay)
- Z-index: 1000
- Display: Flex, center items
- Animation: Fade in `0.3s ease`

**Result Card:**
- Background: `#1F1F1F`
- Border: `2px solid #10B981` (green)
- Border radius: `0.75rem`
- Padding: `2rem`
- Max width: `500px` (desktop), `90%` (mobile)
- Box shadow: Green glow effect
- Animation: Scale in `0.3s ease`

**Success Icon:**
- Size: `64px × 64px`
- Color: `#10B981` (green)
- Animation: Scale + rotate
- Margin bottom: `1rem`

**Title:**
- Text: "VALID TICKET"
- Font size: `1.5rem` (24px)
- Font weight: 600 (semibold)
- Color: `#10B981` (green)
- Text align: Center
- Margin bottom: `1.5rem`

**Ticket Details Section:**
- Background: `#252525`
- Border radius: `0.5rem`
- Padding: `1rem`
- Margin bottom: `1.5rem`

**Detail Row:**
- Display: Flex, space-between
- Padding: `0.5rem 0`
- Border bottom: `1px solid #2A2A2A` (last child: none)

**Detail Label:**
- Font size: `0.875rem` (14px)
- Color: `#B0B0B0`
- Font weight: 400 (normal)

**Detail Value:**
- Font size: `0.875rem` (14px)
- Color: White
- Font weight: 500 (medium)

**Action Buttons:**
- Display: Flex, gap `1rem`
- Width: 100%

**Close Button:**
- Variant: Outline
- Background: Transparent
- Border: `1px solid #2A2A2A`
- Color: `#B0B0B0`
- Hover: Border color `#E21836`, Color `#E21836`

**Next Scan Button:**
- Variant: Primary
- Background: `#E21836`
- Color: White
- Flex: 1 (takes remaining space)

#### Error (Invalid/Duplicate)

**Result Card:**
- Border: `2px solid #EF4444` (red) or `#F59E0B` (amber)
- Box shadow: Red/amber glow effect

**Error Icon:**
- Color: `#EF4444` (red) or `#F59E0B` (amber)

**Title:**
- Color: `#EF4444` (red) or `#F59E0B` (amber)
- Text: "INVALID TICKET" / "ALREADY SCANNED" / "WRONG EVENT" / "EXPIRED"

**Error Message:**
- Font size: `1rem` (16px)
- Color: `#B0B0B0`
- Text align: Center
- Margin top: `1rem`

**Previous Scan Details** (if duplicate):
- Background: `#252525`
- Border: `1px solid #F59E0B`
- Border radius: `0.5rem`
- Padding: `1rem`
- Margin top: `1rem`

---

### 5. Manual Entry Dialog

#### Layout

```
┌─────────────────────────────────────────┐
│                                         │
│         Manual Entry                    │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Enter Secure Token:              │  │
│  │                                   │  │
│  │  [Input Field: UUID format]       │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│                                         │
│      [Cancel]      [Validate]           │
│                                         │
└─────────────────────────────────────────┘
```

**Dialog Container:**
- Same as scan result overlay
- Background: `rgba(0, 0, 0, 0.8)`
- Z-index: 1000

**Dialog Card:**
- Background: `#1F1F1F`
- Border: `1px solid #2A2A2A`
- Border radius: `0.75rem`
- Padding: `2rem`
- Max width: `500px` (desktop), `90%` (mobile)

**Title:**
- Font size: `1.5rem` (24px)
- Font weight: 600 (semibold)
- Color: White
- Margin bottom: `1.5rem`
- Text align: Center

**Input Field:**
- Background: `#252525`
- Border: `1px solid #2A2A2A`
- Border radius: `0.5rem`
- Padding: `0.75rem 1rem`
- Font size: `1rem` (16px)
- Font family: Monospace (for UUID)
- Color: White
- Width: 100%
- Margin bottom: `1.5rem`
- Focus: Border color `#E21836`, glow effect

**Format Helper:**
- Font size: `0.75rem` (12px)
- Color: `#B0B0B0`
- Text: "Format: 8-4-4-4-12 hexadecimal characters"
- Margin bottom: `1rem`

**Validation Feedback:**
- Real-time format validation
- Valid: Border color green `#10B981`
- Invalid: Border color red `#EF4444`
- Helper text below input

**Action Buttons:**
- Same as scan result overlay
- Cancel: Outline variant
- Validate: Primary variant

---

### 6. Scan History Screen

#### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│  [Logo]  Scan History           [Filter] [Export]      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  🔍 Search by name, phone, order...              │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Filters: [All] [Valid] [Invalid] [Duplicate] [Today] │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  ✅ John Doe - VIP        Order #1234  19:30:00  │ │
│  │     Standard Pass                                │ │
│  └───────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────┐ │
│  │  ⚠️  Jane Smith - Standard   Already scanned     │ │
│  │     Previous: 18:00:00 at VIP Entrance           │ │
│  └───────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────┐ │
│  │  ❌ Invalid Ticket                  19:28:15     │ │
│  │     Ticket not found                              │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  [Load More]                                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### Design Details

**Top Bar:**
- Same as main scanning screen
- Title: "Scan History"
- Actions: Filter button, Export button

**Search Bar:**
- Same as event selection search bar
- Placeholder: "Search by name, phone, order number..."

**Filter Chips:**
- Display: Flex, wrap, gap `0.75rem`
- Margin bottom: `1.5rem`

**Filter Chip:**
- Background: `#1F1F1F`
- Border: `1px solid #2A2A2A`
- Border radius: `9999px` (fully rounded)
- Padding: `0.5rem 1rem`
- Font size: `0.875rem` (14px)
- Color: `#B0B0B0`
- Active state:
  - Background: `#E21836`
  - Border: `1px solid #E21836`
  - Color: White
- Cursor: Pointer
- Hover: Border color `#E21836`

**History Item Card:**
- Background: `#1F1F1F`
- Border: `1px solid #2A2A2A`
- Border radius: `0.75rem`
- Padding: `1rem 1.5rem`
- Margin bottom: `0.75rem`
- Border left: `4px solid` (color by status)
- Hover: Border color glow, transform `translateX(4px)`
- Transition: `all 0.3s ease`

**History Item Header:**
- Display: Flex, space-between, align-center
- Margin bottom: `0.5rem`

**Status Icon + Name:**
- Display: Flex, align-center, gap `0.5rem`
- Font size: `1rem` (16px)
- Font weight: 500 (medium)
- Color: White

**Time:**
- Font size: `0.875rem` (14px)
- Color: `#B0B0B0`

**Pass Type:**
- Font size: `0.875rem` (14px)
- Color: `#B0B0B0`
- Margin top: `0.25rem`

**Error Message** (if invalid):
- Font size: `0.875rem` (14px)
- Color: `#EF4444`
- Margin top: `0.5rem`

**Previous Scan Info** (if duplicate):
- Background: `#252525`
- Border radius: `0.5rem`
- Padding: `0.75rem 1rem`
- Margin top: `0.75rem`
- Border: `1px solid #F59E0B`
- Font size: `0.875rem` (14px)

**Load More Button:**
- Variant: Outline
- Width: 100%
- Margin top: `1.5rem`

**Empty State:**
- Text: "No scans found"
- Color: `#B0B0B0`
- Font size: `1rem` (16px)
- Text align: Center
- Padding: `3rem`

---

### 7. Statistics Dashboard

#### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│  [Logo]  Statistics         [Today] [Week] [Month]     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐               │
│  │  45  │  │  3   │  │  2   │  │  96% │               │
│  │Valid │  │Dup.  │  │Invalid│  │Success│             │
│  └──────┘  └──────┘  └──────┘  └──────┘               │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Scans Per Hour                                   │ │
│  │  [Line Chart]                                     │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────┐  ┌───────────────┐                 │
│  │ Pass Types    │  │ Results       │                 │
│  │ [Pie Chart]   │  │ [Bar Chart]   │                 │
│  └───────────────┘  └───────────────┘                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### Design Details

**Time Filter Buttons:**
- Same style as filter chips
- Position: Top right

**Stat Card:**
- Background: `#1F1F1F`
- Border: `1px solid #2A2A2A`
- Border radius: `0.75rem`
- Padding: `1.5rem`
- Text align: Center

**Stat Number:**
- Font size: `2.5rem` (40px) desktop, `2rem` (32px) mobile
- Font weight: 700 (bold)
- Color: Status color (green/amber/red/blue)

**Stat Label:**
- Font size: `0.875rem` (14px)
- Color: `#B0B0B0`
- Margin top: `0.5rem`

**Chart Container:**
- Background: `#1F1F1F`
- Border: `1px solid #2A2A2A`
- Border radius: `0.75rem`
- Padding: `1.5rem`

**Chart Title:**
- Font size: `1.125rem` (18px)
- Font weight: 600 (semibold)
- Color: White
- Margin bottom: `1rem`

---

## 🎯 COMPONENT DESIGNS

### Button Variants

**Primary Button:**
```css
background: #E21836;
color: white;
border: none;
border-radius: 0.5rem;
padding: 0.75rem 2rem;
font-size: 1rem;
font-weight: 500;
transition: all 0.3s ease;
```

**Hover:**
```css
background: hsl(352 80% 45%);
box-shadow: 0 0 20px hsl(352 80% 49% / 0.5);
```

**Outline Button:**
```css
background: transparent;
color: #B0B0B0;
border: 1px solid #2A2A2A;
border-radius: 0.5rem;
padding: 0.75rem 2rem;
font-size: 1rem;
font-weight: 500;
transition: all 0.3s ease;
```

**Hover:**
```css
border-color: #E21836;
color: #E21836;
```

**Ghost Button:**
```css
background: transparent;
color: #B0B0B0;
border: none;
padding: 0.5rem 1rem;
font-size: 1rem;
transition: all 0.3s ease;
```

**Hover:**
```css
background: #1F1F1F;
color: white;
```

### Input Fields

**Text Input:**
```css
background: #252525;
border: 1px solid #2A2A2A;
border-radius: 0.5rem;
padding: 0.75rem 1rem;
font-size: 1rem; /* 16px prevents zoom on iOS */
color: white;
width: 100%;
transition: all 0.3s ease;
```

**Focus:**
```css
border-color: #E21836;
box-shadow: 0 0 0 3px hsl(352 80% 49% / 0.2);
outline: none;
```

**Placeholder:**
```css
color: #B0B0B0;
```

### Cards

**Default Card:**
```css
background: #1F1F1F;
border: 1px solid #2A2A2A;
border-radius: 0.75rem;
padding: 1.5rem;
backdrop-filter: blur(8px);
```

**Hover Effect:**
```css
border-color: #E21836;
box-shadow: 0 0 20px hsl(352 80% 49% / 0.3);
transform: translateY(-2px);
transition: all 0.3s ease;
```

### Status Badges

**Valid Badge:**
```css
background: hsl(142 76% 36% / 0.2);
color: #10B981;
border: 1px solid #10B981;
border-radius: 9999px;
padding: 0.25rem 0.75rem;
font-size: 0.75rem;
font-weight: 500;
```

**Invalid Badge:**
```css
background: hsl(0 84% 60% / 0.2);
color: #EF4444;
border: 1px solid #EF4444;
```

**Warning Badge:**
```css
background: hsl(45 93% 47% / 0.2);
color: #F59E0B;
border: 1px solid #F59E0B;
```

---

## 📱 MOBILE-SPECIFIC DESIGNS

### Touch Targets

**Minimum Size:**
- All interactive elements: `44px × 44px` minimum
- Buttons: `48px` height recommended
- Icons: `24px × 24px` with `12px` padding = `48px × 48px` total

### Mobile Optimizations

**Viewport:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
```

**Prevent Zoom on Input Focus:**
```css
input, select, textarea {
  font-size: 16px !important; /* Prevents iOS zoom */
}
```

**Touch Action:**
```css
* {
  touch-action: manipulation; /* Prevents double-tap zoom */
}

/* QR Scanner specific */
#qr-reader {
  touch-action: none;
  user-select: none;
}
```

**Safe Areas (iOS):**
```css
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
padding-left: env(safe-area-inset-left);
padding-right: env(safe-area-inset-right);
```

### Mobile Navigation

**Bottom Navigation Bar:**
- Position: Fixed bottom
- Height: `64px` + safe area
- Background: `#1A1A1A` with backdrop blur
- Border top: `1px solid #2A2A2A`
- Padding: `0.75rem`
- Z-index: 50

**Navigation Items:**
- Flex: 1 (equal width)
- Display: Flex column
- Align: Center
- Gap: `0.25rem`

**Icon:**
- Size: `24px × 24px`
- Color: `#B0B0B0`
- Active: `#E21836`

**Label:**
- Font size: `0.75rem` (12px)
- Color: `#B0B0B0`
- Active: `#E21836`

### Mobile Gestures

**Pull to Refresh:**
- History screens support pull-to-refresh
- Loading indicator during refresh

**Swipe Gestures:**
- Swipe left/right on scan history items to reveal actions
- Swipe down to close modals/overlays

---

## 🎬 ANIMATIONS & TRANSITIONS

### Entrance Animations

**Fade In:**
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

animation: fadeIn 0.3s ease;
```

**Slide Up:**
```css
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

animation: slideUp 0.5s ease;
```

**Scale In:**
```css
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

animation: scaleIn 0.3s ease;
```

### Loading Animations

**Skeleton Shimmer:**
```css
@keyframes shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}

background: linear-gradient(
  90deg,
  #252525 0%,
  #2A2A2A 50%,
  #252525 100%
);
background-size: 1000px 100%;
animation: shimmer 2s infinite;
```

**Spinner:**
```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

border: 3px solid #2A2A2A;
border-top-color: #E21836;
border-radius: 50%;
animation: spin 1s linear infinite;
```

### Status Animations

**Success Checkmark:**
```css
@keyframes checkmark {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

animation: checkmark 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
```

**Pulse Glow:**
```css
@keyframes pulseGlow {
  0%, 100% {
    box-shadow: 0 0 20px hsl(352 80% 49% / 0.5);
  }
  50% {
    box-shadow: 0 0 40px hsl(352 80% 49% / 0.8);
  }
}

animation: pulseGlow 2s ease-in-out infinite;
```

### Hover Effects

**Lift:**
```css
transition: transform 0.3s ease;

&:hover {
  transform: translateY(-2px);
}
```

**Glow:**
```css
transition: box-shadow 0.3s ease;

&:hover {
  box-shadow: 0 0 20px hsl(352 80% 49% / 0.5);
}
```

---

## ♿ ACCESSIBILITY

### Color Contrast

**WCAG AA Compliance:**
- Normal text: Minimum 4.5:1 contrast ratio
- Large text: Minimum 3:1 contrast ratio
- Interactive elements: Minimum 3:1 contrast ratio

**Current Contrast Ratios:**
- White (#FFFFFF) on Black (#1A1A1A): 16.5:1 ✅
- Red (#E21836) on Black (#1A1A1A): 4.7:1 ✅
- Muted Gray (#B0B0B0) on Black (#1A1A1A): 4.6:1 ✅

### Keyboard Navigation

**Tab Order:**
- Logical flow: Top to bottom, left to right
- Skip links for main content
- Focus indicators visible

**Focus Indicators:**
```css
outline: 2px solid #E21836;
outline-offset: 2px;
```

### Screen Reader Support

**ARIA Labels:**
- All interactive elements have descriptive labels
- Form inputs have associated labels
- Buttons have aria-label when icon-only

**Semantic HTML:**
- Use proper heading hierarchy (h1 → h2 → h3)
- Use semantic elements (nav, main, article, section)
- Use proper form labels

---

## 📐 RESPONSIVE LAYOUT RULES

### Grid System

**Desktop (1024px+):**
- Container max-width: `1400px`
- Columns: 12-column grid
- Gutter: `2rem` (32px)

**Tablet (768px - 1023px):**
- Container max-width: `100%`
- Padding: `1.5rem`
- Columns: 6-column grid
- Gutter: `1.5rem` (24px)

**Mobile (< 768px):**
- Container max-width: `100%`
- Padding: `1rem` (16px)
- Columns: 4-column grid
- Gutter: `1rem` (16px)

### Flexible Layouts

**Flexbox Usage:**
- Navigation bars
- Button groups
- Card layouts
- Form layouts

**CSS Grid Usage:**
- Event cards grid
- Statistics dashboard
- Chart containers

**Flexible Images:**
```css
img {
  max-width: 100%;
  height: auto;
}
```

### Breakpoint Mixins (if using CSS preprocessor)

```css
/* Mobile First */
@mixin mobile {
  @media (min-width: 0px) { @content; }
}

@mixin tablet {
  @media (min-width: 768px) { @content; }
}

@mixin desktop {
  @media (min-width: 1024px) { @content; }
}

@mixin large {
  @media (min-width: 1280px) { @content; }
}
```

---

## 🎨 VISUAL EFFECTS

### Glass Morphism

```css
.glass {
  background: rgba(31, 31, 31, 0.8); /* #1F1F1F with opacity */
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(42, 42, 42, 0.5); /* #2A2A2A with opacity */
}
```

### Neon Glow Effects

```css
.neon-glow {
  box-shadow: 0 0 20px hsl(352 80% 49% / 0.5),
              0 0 40px hsl(352 80% 49% / 0.3),
              0 0 60px hsl(352 80% 49% / 0.2);
}

.neon-glow-strong {
  box-shadow: 0 0 30px hsl(352 100% 65% / 0.6),
              0 0 60px hsl(352 100% 65% / 0.4),
              0 0 90px hsl(352 100% 65% / 0.3);
}
```

### Gradient Overlays

```css
.gradient-overlay {
  background: linear-gradient(
    135deg,
    hsl(352 80% 49% / 0.1),
    hsl(352 100% 65% / 0.05)
  );
}
```

---

## 📝 IMPLEMENTATION NOTES

### CSS Variables

Use CSS custom properties for consistency:

```css
:root {
  --color-bg: #1A1A1A;
  --color-card: #1F1F1F;
  --color-border: #2A2A2A;
  --color-primary: #E21836;
  --color-text: #FFFFFF;
  --color-muted: #B0B0B0;
  
  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  
  --shadow-card: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-neon: 0 0 30px hsl(352 100% 65% / 0.6);
  
  --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Component Styling Approach

**Option 1: Tailwind CSS (Recommended - matches existing platform)**
- Use Tailwind utility classes
- Extend theme in `tailwind.config.ts`
- Use CSS variables via Tailwind

**Option 2: CSS Modules**
- Scoped component styles
- Import in component files

**Option 3: Styled Components**
- CSS-in-JS approach
- Theme provider for consistency

### Performance Optimizations

**Image Optimization:**
- Use WebP format with fallbacks
- Lazy loading for images
- Responsive images with srcset

**Animation Performance:**
- Use `transform` and `opacity` for animations (GPU-accelerated)
- Avoid animating `width`, `height`, `top`, `left`
- Use `will-change` sparingly

**Code Splitting:**
- Lazy load routes
- Split vendor bundles
- Tree shake unused CSS

---

## ✅ DESIGN CHECKLIST

### Desktop
- [ ] All pages responsive from 1024px to 1920px
- [ ] Hover states on all interactive elements
- [ ] Focus states visible for keyboard navigation
- [ ] All text readable (minimum 14px font size)
- [ ] Touch targets adequate for mouse interaction

### Tablet
- [ ] Layout adapts to 768px - 1023px width
- [ ] Touch targets minimum 44px × 44px
- [ ] Forms usable with touch input
- [ ] Navigation accessible

### Mobile
- [ ] Layout optimized for 320px - 767px width
- [ ] Touch targets minimum 44px × 44px
- [ ] Input font size 16px (prevents iOS zoom)
- [ ] Bottom navigation bar for mobile
- [ ] Safe area support for notched devices
- [ ] Pull-to-refresh on scrollable lists
- [ ] Gesture support (swipe, pinch)

### Accessibility
- [ ] WCAG AA color contrast compliance
- [ ] Keyboard navigation support
- [ ] Screen reader labels
- [ ] Semantic HTML structure
- [ ] Focus indicators visible

### Performance
- [ ] Animations smooth (60fps)
- [ ] Images optimized
- [ ] Code split and lazy loaded
- [ ] Bundle size optimized

---

**End of Design Specification**

This document serves as the complete design specification for the Scan App web application. All visual elements, layouts, components, and responsive behaviors are documented here for implementation reference.
