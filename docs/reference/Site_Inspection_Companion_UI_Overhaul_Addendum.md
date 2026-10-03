# UI OVERHAUL ADDENDUM — SITE INSPECTION COMPANION

## IMPORTANT — READ THIS IN CONTEXT OF THE EXISTING HANDOVER

This document is **not a replacement for the existing Claude Code handover**.

The existing handover already contains the full project context, architecture, functionality and implementation history.

This document is the **UI/UX overhaul addendum** to be applied at the end of that existing handover.

The purpose of this addendum is to communicate the design direction developed from a limited visual review of the application.

### CRITICAL CONTEXT

Only two screenshots were available for the visual review.

Those screenshots showed:

1. The Inspections/home view.
2. The Inspection/drawing view.

**These are NOT the complete application.**

There are additional screens, workflows, settings, forms, inspection stages, dialogs, editors, reports, drawing interactions and/or other areas of the application that were not visible in the screenshots.

Therefore:

> **DO NOT redesign the application as though the two screenshots represent the entire product.**

Instead, use the design principles in this document to establish a **coherent design system and UX direction**, then inspect the actual codebase and apply that direction intelligently across the ENTIRE existing application.

The existing application is the source of truth for what screens and functionality exist.

The two screenshots are examples of the CURRENT visual language, not a complete specification of the application.

---

# 1. OBJECTIVE

Perform a thoughtful, product-level UI/UX overhaul of the existing Site Inspection Companion.

The goal is NOT:

- to reproduce the two screenshots
- to make every screen look identical
- to simply change colours
- to add more cards
- to rebuild the application from scratch

The goal IS:

> Make the entire existing application feel like one cohesive, professional, purpose-built field engineering product.

The redesign should preserve the application's existing capabilities while substantially improving:

- visual hierarchy
- usability
- consistency
- tablet usability
- touch interaction
- information density
- navigation
- discoverability
- drawing/document workflows
- field usability
- perceived quality

---

# 2. FIRST: AUDIT THE ENTIRE APPLICATION

Before making significant UI changes, inspect the entire existing codebase.

Identify ALL major application areas.

Do not limit the audit to the two screens shown in the screenshots.

Map out:

- routes
- screens/pages
- modals
- dialogs
- drawers
- side panels
- navigation
- settings
- inspection creation/editing
- pre-inspection workflow
- inspection workflow
- site memo workflow
- project management
- drawing/document viewing
- drawing markup
- pins
- observations
- instructions
- photos
- synthetic/test drawings
- report generation
- forms
- checklists
- settings/preferences
- online/offline state
- error states
- empty states
- loading states
- confirmation states
- mobile/tablet layouts
- desktop layouts
- any other existing functionality

Build an internal mental model of the product before redesigning it.

If useful, inspect the application structure and identify which components are shared versus screen-specific.

---

# 3. CREATE A DESIGN SYSTEM, NOT A COLLECTION OF REDESIGNS

The most important principle is consistency.

Do not independently redesign each screen.

Establish a small visual/design system and then apply it across the application.

Consider consistent:

## Colour

Use the existing red brand identity as the primary accent.

Use red selectively for:

- primary actions
- important actions
- active states
- alerts
- destructive actions where appropriate

Use restrained supporting colours for:

- success / verified
- warning / attention
- neutral information
- inactive states

Avoid making every screen predominantly red.

## Surfaces

Prefer:

- warm/off-white application background
- white working surfaces
- subtle borders
- restrained elevation

Avoid excessive nested cards and borders.

## Typography

Create a clear hierarchy for:

- page title
- section heading
- card/item title
- body text
- metadata
- labels
- status
- helper text

Avoid making every piece of text visually equal.

## Spacing

Use a consistent spacing scale.

Avoid arbitrary spacing differences between screens.

## Radius

Use a consistent corner-radius system.

## Controls

Buttons, inputs, tabs, dropdowns, badges, toggles and other controls should share a consistent visual language.

## Icons

Use a consistent icon family and sizing system.

Do not mix arbitrary icon styles.

---

# 4. DESIGN FOR THE ACTUAL USE CASE

This is a structural engineering site inspection application.

The UI should be optimised for an engineer who may be:

- standing on a construction site
- holding a tablet
- wearing PPE
- working outdoors
- moving quickly between drawings and inspection items
- dealing with imperfect site conditions
- needing to document decisions/photos/observations
- looking at drawings while making an inspection decision

This means:

### Prioritise

- large touch targets
- clear actions
- high information hierarchy
- readable text
- low cognitive load
- fast navigation
- obvious current state
- easy access to drawings
- easy photo capture
- obvious inspection status

### Avoid

- tiny controls
- unnecessary navigation
- dense forms
- excessive modal stacking
- hidden primary actions
- overly decorative UI
- excessive information on screen at once

---

# 5. DRAWING-CENTRIC WORKFLOWS

The drawing/document is a core part of this application.

Where a workflow involves drawings, prioritise the drawing rather than treating it as just another content card.

The inspection screen should generally feel like:

CONTEXT
↓
DRAWING
↓
INSPECTION ITEMS / CONTEXTUAL INFORMATION

rather than:

HEADER
+
MANY CARDS
+
DRAWING
+
MANY CARDS

Where appropriate, allow secondary panels to collapse so the drawing can become the primary workspace.

---

# 6. CONTEXTUAL UI

A major design direction is to reduce the amount of UI that is permanently visible.

Use contextual interfaces where appropriate.

For example:

- selecting a drawing pin can reveal its details
- selecting an inspection item can reveal editing controls
- opening a photo can reveal photo actions
- selecting a project can reveal project actions
- opening a document can reveal document controls

Do not remove functionality.

Instead, expose functionality at the moment it is useful.

---

# 7. FIELD MODE MINDSET

The inspection workflow should support a "field mode" mentality.

The engineer should be able to perform common actions quickly:

- Add pin
- Add observation
- Add instruction
- Take/add photo
- Add note
- Change status
- Move between drawing pages
- Review inspection items

The ideal interaction should minimise unnecessary navigation.

For example:

1. User is looking at drawing.
2. User taps ADD PIN.
3. User taps drawing location.
4. Item is created.
5. User can immediately add description/photo/status.
6. User returns to drawing without losing context.

Apply this principle wherever it makes sense in the existing app.

---

# 8. INSPECTIONS HOME — DESIGN DIRECTION

The existing Inspections screen should become a clean entry point into the application.

Important concepts:

- clear page heading
- prominent New Inspection action
- recent inspections
- project/workspace context
- strong status hierarchy

Inspection entries should make it easy to understand:

- what inspection this is
- what project it belongs to
- when it happened
- its current state
- whether action is required

Avoid turning every inspection into a large heavily bordered card.

Consider a cleaner list/activity pattern.

The project area should feel like a workspace selector rather than simply a collection of cards.

---

# 9. INSPECTION / DRAWING SCREEN — DESIGN DIRECTION

This is the strongest example of where the new design philosophy should apply.

Maintain clear context:

PROJECT → INSPECTION → CURRENT WORKFLOW STAGE

Use the existing workflow stages, but make the current stage obvious.

The drawing should receive the majority of the available visual space.

Primary actions should be obvious.

In particular:

**ADD PIN**

should be a strong action.

The Items panel should be visually organised into logical categories such as:

- Observations
- Instructions
- Synthetic/Test Drawings

But do not assume these exact categories are the only ones the application needs.

Inspect the real implementation and preserve any additional functionality.

---

# 10. RESPONSIVE / TABLET DESIGN

Do not treat responsive design as simply shrinking the desktop UI.

The tablet experience should have its own sensible layout behaviour.

For example:

### Wide tablet / desktop

Potential structure:

[Context / Navigation]
[Drawing workspace] [Items / contextual panel]

### Narrower tablet

Potential structure:

[Context]
[Drawing workspace]
[Collapsible contextual panel]

The exact implementation should be determined after inspecting the existing application.

Do not force the same layout onto every screen.

---

# 11. INFORMATION DENSITY

The current UI contains useful information, but some of it competes for attention.

The redesign should establish:

### Primary information

What the user needs immediately.

### Secondary information

Useful context that should remain visible but quieter.

### Tertiary information

Information that can be shown on demand.

Use:

- typography
- spacing
- grouping
- colour
- progressive disclosure

to establish this hierarchy.

Do not solve hierarchy purely by adding more cards.

---

# 12. EMPTY, LOADING AND ERROR STATES

Because the entire application is being redesigned, review states that may not have been visible in the supplied screenshots.

Every major workflow should have intentional:

- loading states
- empty states
- error states
- success states
- confirmation states
- disabled states

These should belong to the same design system.

Do not leave old/default browser-looking states behind.

---

# 13. FORMS AND SETTINGS

The screenshots did not show all forms/settings.

Do not assume these areas are unimportant.

Apply the same principles:

- clear grouping
- strong labels
- obvious primary action
- restrained secondary actions
- useful helper text
- large touch targets
- consistent inputs
- sensible validation/error presentation

Avoid redesigning forms into unnecessarily elaborate card layouts.

---

# 14. DO NOT BREAK EXISTING FUNCTIONALITY

This is a UI/UX task first.

The following must continue working unless there is an explicit technical reason to change them:

- routes
- navigation
- inspection creation
- inspection editing
- project selection
- project data
- inspection data
- drawings
- drawing pages
- pins
- observations
- instructions
- photos
- reordering
- deleting
- workflow stages
- report generation
- settings
- persistence
- online/offline handling
- existing APIs/data sources
- existing state management

If the existing architecture already supports something, reuse it.

Do not create duplicate state just for the new UI.

---

# 15. DO NOT OVERFIT TO THE TWO SCREENSHOTS

This is worth repeating.

Only two screenshots were reviewed by the design process.

There are almost certainly additional views and interactions in the application that were not represented.

Therefore:

### Do NOT:

- copy the screenshot layout blindly
- assume every screen needs the same sidebar
- assume every screen needs the same card structure
- remove functionality because it wasn't visible
- invent UI based solely on the screenshots
- treat the screenshots as a complete product specification

### DO:

- inspect the real application
- understand the complete workflow
- establish the design system
- adapt the design system to each screen
- preserve screen-specific functionality
- improve each workflow according to its actual purpose

The screenshots are evidence of the current visual language, not the full scope of the product.

---

# 16. DESIGN GOAL

The final application should feel like:

> "The same Site Inspection Companion I've been using, but it has matured into a genuinely polished professional engineering product."

It should NOT feel like:

> "Someone replaced the application with a completely different SaaS dashboard."

Preserve the application's identity and functionality while improving the experience dramatically.

---

# 17. IMPLEMENTATION APPROACH

Recommended process:

## Phase 1 — Audit

Inspect the entire application.

Identify all routes, screens, components and workflows.

## Phase 2 — Design foundation

Establish/revise:

- colours
- typography
- spacing
- radius
- buttons
- inputs
- badges
- tabs
- navigation
- panels
- modals
- cards
- status treatments

Use reusable components/tokens where the project architecture allows.

## Phase 3 — Core navigation

Redesign the global shell/navigation so the entire app immediately feels coherent.

## Phase 4 — Main workflows

Apply the design to:

- Inspections
- Project selection
- Inspection workflow
- Drawing workflow
- Items
- Pre-inspection
- Site memo
- other major existing screens

## Phase 5 — Secondary workflows

Apply the same design system to:

- settings
- dialogs
- forms
- editing
- photo interfaces
- error states
- empty states
- confirmations
- other screens discovered during the audit

## Phase 6 — Responsive pass

Test tablet landscape first, then desktop and narrower layouts.

## Phase 7 — Functional regression

Verify that the UI overhaul has not broken existing functionality.

---

# 18. IMPORTANT CLAUDE CODE BEHAVIOUR

Do not start coding immediately based only on this document.

First inspect the repository.

If the existing app uses a component library/design system, understand it before introducing another one.

If there is already a theme/token system, extend it rather than creating a competing system.

If there are existing reusable components, reuse them where sensible.

If there are inconsistencies in the current UI, fix them systematically rather than patching individual screens.

If an architectural change is genuinely necessary, keep it scoped and explain why in your implementation notes.

---

# 19. QUALITY BAR

Before considering the overhaul complete, review the app as a product rather than just checking whether the code compiles.

Ask:

- Does the hierarchy make sense?
- Can an engineer understand where they are immediately?
- Can the user perform common actions with one hand/touch?
- Is the drawing given enough space?
- Are primary actions obvious?
- Are secondary controls quiet?
- Are different screens visually related?
- Does the UI feel like one application?
- Are tablet interactions comfortable?
- Are empty/error/loading states polished?
- Has any existing functionality disappeared?
- Does the design still make sense on screens that were NOT in the original screenshots?

If a new design looks good on the two known screens but feels awkward elsewhere in the application, **do not force the design**.

Adapt the design system to the workflow.

---

# 20. FINAL DIRECTIVE

Use this document as the **design/UX direction for the UI overhaul**.

Use the existing Claude handover and actual codebase as the source of truth for:

- functionality
- architecture
- workflows
- data
- routes
- screens
- existing capabilities

Use this document as the source of truth for:

- design philosophy
- visual hierarchy
- field usability
- consistency
- responsive behaviour
- drawing-first interaction
- contextual UI
- overall product quality

The desired outcome is a cohesive overhaul of the **entire existing application**, not a redesign of only the two screenshots that were available for review.

Inspect first.
Understand the whole product.
Then redesign it intelligently.
