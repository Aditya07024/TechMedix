# Design System — Healthcare / Telemedicine App

Reverse-engineered from the reference UI screens (Home, Doctor Profile, Video Consultation, Search/Category, Account). Colors below were sampled directly from the image pixels, so they're accurate. Font family is a visual best-match (fonts can't be extracted from a raster image) — test the suggested candidates and pick whichever renders closest.

---

## 1. Color Palette

| Token | Hex | RGB | Usage |
|---|---|---|---|
| `bg` | `#F1F3FF` | 241, 243, 255 | App screen background (very light lavender-white) |
| `surface` | `#FFFFFF` | 255, 255, 255 | Cards, sheets, inputs, nav bar |
| `brand` (primary) | `#5B82E0` | 91, 130, 224 | Doctor cards, primary buttons, active tab/nav, links, selected states |
| `brand-dark` | `#3F63C9` | — (derived) | Hover/pressed states, gradient bottom if you want depth |
| `brand-light` | `#C9D8F6` | 199, 216, 246 | Unselected day-pills, inactive chips, light tints |
| `border` | `#DCE2F0` | 220, 226, 240 | Card borders, dividers, input outlines |
| `text-primary` | `#12142B` | 18, 20, 43 | Headings, names, primary copy (near-black navy, not pure black) |
| `text-secondary` | `#797D89` | 121, 125, 137 | Subtext, labels, placeholders |
| `warn` (rating star) | `#F4C036` | 244, 192, 54 | Star ratings only |
| `danger` | `#ED2F2F` | 237, 47, 47 | End-call button, destructive actions |

**Notes on the brand blue:** it reads as a near-flat fill across cards, buttons, and the profile header — not a strong gradient. If you want the subtle depth seen in the doctor card, add a soft directional gradient from `brand` → `brand-dark` rather than two distinct colors.

---

## 2. Typography

Visual candidates (geometric, rounded-terminal sans-serif): **Plus Jakarta Sans**, **Manrope**, **Satoshi**, or **Gilroy**. All are free except Gilroy/Satoshi (which have free tiers). Start with **Plus Jakarta Sans** — closest free match on Google Fonts.

| Role | Size | Weight | Example |
|---|---|---|---|
| Display (doctor full name) | 26–28px | Bold (700) | "Dr. Thomas Micheal" |
| Card Name | 18–20px | Bold (700) | "Dr. William James" |
| Section Header | 20–22px | SemiBold/Bold | "Top Doctors", "Category" |
| Body | 14–16px | Medium (500) | paragraph copy, list rows |
| Caption/Tag | 12–13px | Regular, often 70–80% opacity over color | "Neurologist", stat labels |
| Price | 18–20px Bold + 13px Regular | mixed | "$95" + "/session" |
| Button Label | 16px | SemiBold/Bold | "Next", "Home" |

---

## 3. Spacing, Radius & Elevation

- **Grid:** 4px base unit (8 / 12 / 16 / 20 / 24 / 32)
- **Screen padding:** 20–24px horizontal
- **Large feature cards** (doctor card, profile header): `radius: 24px`
- **Medium cards** (stat cards, fee cards, category list rows): `radius: 16px`
- **Buttons, chips, tags, nav pill, avatars:** fully rounded (`radius: 999px` / circle)
- **Shadows:**
  - Colored cards: `0 8px 24px rgba(91,130,224,0.18)`
  - White cards: `0 4px 16px rgba(17,20,43,0.06)`

---

## 4. Iconography

- **Style:** outline/line icons, ~1.5–2px stroke, rounded caps, simple geometric shapes (brain, heart-with-pulse, lungs, joint/bone scan).
- **Closest icon sets:** Lucide, Tabler Icons, or Phosphor (outline weight). Lucide is the easiest to drop into a React/Tailwind stack.
- **Containers:** icon sits centered in a circle.
  - Category icons: ~24px icon inside ~56px white circle, label below.
  - Action/nav icons (back, share, call controls): ~20px icon inside ~40–44px circle, white or translucent-white on photos/video.

---

## 5. Core Components

**Header / Greeting bar**
Greeting text (primary) + subtext (secondary) on the left, two circular icon buttons (search, notification) on the right. Notification has a small blue dot badge, top-right of the bell.

**Category icon row**
Horizontally scrollable row of circular white icon buttons (icon + label below), no border, soft shadow optional. ~6–8 items visible, overflow scrolls.

**Section header**
Bold title left, `brand`-colored "See All" link right, same row, space-between.

**Doctor Card (hero/feature card)**
- Full-bleed `brand` blue background, `radius: 24px`
- Top row: rating badge (white pill, star icon + "4.8") left; heart/favorite icon (white circle, outline) right
- Doctor photo, right-aligned or full-width depending on card size
- Specialty tag (caption, ~75% opacity white)
- Name (bold, white, 2 lines max)
- Price ("$95" bold + "/session" regular, white)
- **Availability sub-panel:** translucent darker-blue overlay strip, "Availability · N slots" left, month + chevrons right
- **Day strip:** 7-day row, each a pill; selected day = white pill containing a solid `brand`-blue circle with white date number; unselected = `brand-light` tinted pill with dark text

**Stat row (3-up)**
Three equal white cards in a row, each: icon top, bold value, caption label below. Used for Experience / Rating / Patients.

**Tab bar (text tabs)**
Horizontal text tabs (About / Availability / Experience / Education / Reviews), active tab in `brand` color + bold + underline, inactive in `text-secondary`.

**Info/Fee card (2-column grid)**
White rounded cards (radius 16px, thin `border`), icon top-left, label (secondary) + value (primary, bold) below.

**Primary CTA button**
Full-width, `brand` fill, fully rounded, white bold label, centered. Sits pinned near bottom of screen with comfortable padding above.

**Bottom navigation**
5 icons in a white rounded bar. Active item renders as a `brand`-filled pill containing icon + label (white text); inactive items are plain gray icons with no label, no background.

**Video call screen**
- Full-bleed video, no padding
- Back button: translucent dark circle, top-left
- Picture-in-picture (other participant): small rounded-rect video, top-right
- Name/role/timer bar: translucent dark pill near bottom, avatar thumbnail + name/specialty + live timer
- Call controls row: 5 circular buttons (flip camera, screenshot, end call, speaker, mic) — translucent white/frosted, except **end call** which is solid `danger` red

**Search bar**
Full-width pill, light/white fill, magnifying-glass icon + placeholder text, sits below a back button.

**Category grid item** (search screen)
2-column grid, white rounded rectangle, icon left + label right, no heavy border — looks like a flattened version of the category circle.

**Tag/pill chip** ("Top Searches")
Small rounded-full chips, light fill, dark text, inline-wrapped row.

**List row** (profile menu, settings)
Icon left, label center, chevron right, white background, divided rows or individually-carded rows with generous vertical padding.

**Form input**
Label above (secondary, small caps-style or regular), rounded rectangle field with a leading icon, value/placeholder in primary text color.

**Segmented control** ("Myself / Others")
Two-option pill toggle, selected option gets white background + subtle border/shadow, unselected is transparent/gray text.

**Payment method row**
White rounded card, brand/payment icon left, label center, radio button right — selected radio fills solid `brand` blue.

**Profile header block**
`brand`-blue rounded card spanning top of screen: avatar (circle, with small camera/edit badge bottom-right) + name (white, bold) + email (white, reduced opacity) — the rest of the screen (list rows) overlaps it from below with a white rounded top edge.

---

## 6. Screen Archetypes (composition order)

1. **Home/Discover:** Header → Category row → Section header → Doctor card (hero) → Doctor card (compact) → Bottom nav
2. **Doctor Profile:** Top icon bar (back/heart/share) → Name + credentials + price → Stat row → Tabs → Tab content → Fee/info grid → Sticky CTA
3. **Video Consultation:** Full-bleed video → PiP → Name/timer bar → Control row
4. **Search/Category:** Back + search bar → Category grid → Top Searches chips → Popular Doctor card
5. **Account:** Either a form (Personal Info), a selectable list (Payment Method), or a profile header + menu list (Profile)

---

## 7. Tailwind Config (drop-in starting point)

```js
// tailwind.config.js (excerpt)
module.exports = {
  theme: {
    extend: {
      colors: {
        bg: '#F1F3FF',
        surface: '#FFFFFF',
        brand: {
          DEFAULT: '#5B82E0',
          dark: '#3F63C9',
          light: '#C9D8F6',
        },
        border: '#DCE2F0',
        text: {
          primary: '#12142B',
          secondary: '#797D89',
        },
        warn: '#F4C036',
        danger: '#ED2F2F',
      },
      borderRadius: {
        card: '24px',
        'card-sm': '16px',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        card: '0 8px 24px rgba(91,130,224,0.18)',
        soft: '0 4px 16px rgba(17,20,43,0.06)',
      },
    },
  },
};
```

```css
/* index.css */
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
```

## 8. Quick reference: example component classes

```jsx
// Doctor hero card
<div className="bg-brand rounded-card p-5 shadow-card text-white">

// Primary CTA
<button className="w-full bg-brand text-white font-semibold rounded-full py-4 shadow-card">

// White info card
<div className="bg-surface border border-border rounded-card-sm p-4">

// Active bottom nav pill
<div className="bg-brand text-white rounded-full px-4 py-2 flex items-center gap-2">
```
