# Design System Strategy: The Cognitive Cockpit

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Cognitive Cockpit."** 

This system moves away from the "soft and friendly" productivity trend, leaning instead into an aesthetic of high-performance utility. It is designed for the solo entrepreneur who views their time as a finite resource and their planner as a precision instrument. By merging the brutalist efficiency of a terminal interface with the calm, spatial breathing room of high-end editorial design, we create an environment of extreme focus.

The "template" look is intentionally broken through **intentional asymmetry**—where data-heavy mono text is offset by wide-set geometric headings—and **tonal layering**, replacing loud structural lines with subtle shifts in darkness.

---

## 2. Colors
The palette is a study in "Deep Dark." It avoids pitch black (#000) to maintain a sense of depth and premium materiality.

### The "No-Line" Rule
To achieve a signature high-end feel, **1px solid borders for sectioning are strictly prohibited.** We define boundaries through background color shifts. A section should not be "boxed in"; it should be "seated" within a container of a different tone.

### Surface Hierarchy & Nesting
Use the `surface-container` tiers to create a physical sense of stacking. 
- **Base Layer:** `surface` (#12121c) for the primary application background.
- **Secondary Areas:** `surface-container-low` (#1b1b25) for sidebar or navigation regions.
- **Primary Content Cards:** `surface-container-highest` (#34343f) or `surface-container` (#1f1f29) to draw the eye to the task at hand.
- **Nesting:** When placing an element inside a card (e.g., an input field inside a task card), use `surface-container-lowest` (#0d0d17) to create a "recessed" or etched look.

### The "Glass & Gradient" Rule
While the system is strictly dark-mode, we utilize **Glassmorphism** for floating elements like Command Palettes or Tooltips. Use `surface-variant` with a `backdrop-blur` (12px–20px) to allow the deep charcoal background to bleed through, creating a sense of sophisticated transparency.

---

## 3. Typography
The typographic soul of the system lies in the tension between the geometric `Space Grotesk` and the rigid `DM Mono`.

*   **Headlines (Space Grotesk):** Used for "Human" elements—greetings, dates, and major category headers. It provides a modern, high-fashion editorial feel.
*   **Data & UI (DM Mono):** Used for "System" elements—task descriptions, time-stamps, energy levels, and input fields. This conveys the terminal-inspired precision.

**Scales:**
- **Display/Headline:** `headline-lg` (2rem) for page titles. Tight letter-spacing (-0.02em).
- **Sub-headers:** `label-md` (0.75rem) in all-caps with generous letter-spacing (0.1em) using `tertiary` (#c6c6cc) to denote metadata or section labels.
- **Body:** `body-md` (0.875rem) `DM Mono` for lists and notes to maintain the "cockpit" density.

---

## 4. Elevation & Depth
In this system, depth is a function of light, not lines.

*   **Tonal Layering:** Instead of shadows, use the transition from `surface-container-low` to `surface-container-high` to imply elevation. An object is "higher" because it is lighter, not because it has a shadow.
*   **Ambient Shadows:** For floating modals, use a "Phantom Shadow": `0 20px 40px rgba(0, 0, 0, 0.4)`. The shadow must be nearly invisible, providing just enough separation from the background to prevent "visual sticking."
*   **The "Ghost Border" Fallback:** If a border is required for accessibility (e.g., in high-density data tables), use a **Ghost Border**: `outline-variant` (#494454) at 15% opacity. It should feel like a hint of a line, rather than a physical barrier.

---

## 5. Components

### Buttons & Pill Controls
- **Primary Action:** Solid `primary` (#d0bcff) with `on-primary` (#3c0091) text. No rounded corners; use `md` (0.375rem) for a sharp, architectural feel.
- **Segmented Controls (Energy Levels):** A `surface-container-low` track with `surface-container-highest` active pills. Use `DM Mono` for the labels to emphasize the "setting" of a value.

### Input Fields
- **Terminal Style:** No background for the input itself. Use a `surface-container-lowest` bottom-border only (2px) that illuminates to `primary` when focused.
- **Placeholder Text:** Use `on-surface-variant` (#cbc3d7) at 50% opacity.

### Cards & Lists
- **Prohibition of Dividers:** Do not use horizontal lines between list items. Use `Spacing 4` (0.9rem) or `Spacing 5` (1.1rem) to create separation through white space. 
- **Interactive States:** On hover, a list item should shift from `surface` to `surface-container-low`.

### The "Status Badge"
- Accents (Blue, Rose, Amber) are reserved strictly for badges. They should be "High-Density" components: `label-sm` text, `0.125rem` (sm) corner radius, and a subtle background of the accent color at 10% opacity with a solid text color.

---

## 6. Do's and Don'ts

### Do:
*   **Use Asymmetry:** Align headings to the left while keeping data right-aligned to create an editorial layout.
*   **Respect the Mono:** Use `DM Mono` for any text that represents a "state" or "variable."
*   **Embrace High Density:** Trust the user's ability to navigate small text and tight padding (Spacing 2 and 3) as long as the hierarchy is clear.

### Don't:
*   **No Rounded "Pills":** Unless it is a status badge or a segmented control, avoid `full` rounded corners. Stick to `md` (0.375rem) for a more professional, "machined" look.
*   **No Opaque Borders:** Never use a 100% opaque border to separate content; it breaks the "Cognitive Cockpit" immersion.
*   **No Playful Colors:** Avoid using the accent colors (Rose, Amber, etc.) for anything other than specific status indicators. The primary experience must remain monochromatic.