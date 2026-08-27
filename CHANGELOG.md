# Changelog

All notable changes to this project are documented here.

## [1.2.0] — unreleased

### Added
- **Composite** operation now supports three overlay types via a new **Overlay Type** dropdown, not just an image:
  - **Image** — the existing behaviour, now with configurable size, position, rounded corners, and a border
  - **Color** — a solid colour panel, with Color and Opacity
  - **Frost (Glass)** — a genuine frosted-glass panel (real backdrop blur + tint, same technique as Text's Glass background), with Frost Amount, Opacity, and Color
  - All three share: **Width/Height** (each independently Percent-of-image or Pixels, default 100%), **Gravity** + **Box Anchor** (default Center) with Position X/Y as pixel offsets from the Gravity point, an optional **Border** (color + width), and **Border Radius**
  - **Blend Mode** now applies to all three overlay types, not just Image
- **Border Radius** is now a CSS `border-radius`-style shorthand (space-separated, 1-4 values, clockwise from the top-left corner) instead of a single uniform number — for both the new Composite panel and Text's Background, so e.g. `"20 20 0 0"` rounds only the top two corners. Rendered via a hand-built SVG path (plain SVG `rx`/`ry` can't do independent per-corner radii)
- **Font Family** dropdown for the Text operation, sourced directly from `fc-list`'s real, exact registered family names (not guessed from filenames) — whatever you pick or type is guaranteed to resolve to that exact font
- **A file path in Font Family now actually works.** Typing a real path to a `.ttf`/`.otf`/`.woff`/`.woff2`/`.ttc` file (via the "fx" expression icon, with or without the extension) dynamically registers that exact font with fontconfig at render time and resolves its real family name — no manual server-side installation needed. Repeat runs against an unchanged file skip the one-time registration cost
- **Decoration Style** modes for Text Decoration (underline/overline/line-through): **Plain** (simple line), **Match Text** (inherits the text's own stroke and shadow), **Custom** (independent color, thickness, stroke, and shadow)
- **Decoration Shadow Blur** — the decoration shadow now supports a genuine Gaussian blur, not just a flat offset copy
- Custom node icon (gold, matching the node's `#D4AF37` accent) — replaces the generic FontAwesome placeholder previously used

### Fixed
- Text Decoration is now drawn as real SVG `<line>` elements instead of the `text-decoration` attribute, which the SVG renderer doesn't reliably honor
- Decoration shadow blur was rendering completely clipped away: a horizontal `<line>` has a zero-height bounding box, so the default percentage-based filter region collapsed to zero. Fixed with an explicit pixel-space filter region per line
- **Root cause of both text overflowing its boundary and decoration lines rendering short**: an unrecognized/mistyped Font Family value doesn't error — fontconfig silently substitutes a completely different, unrelated font (confirmed directly: a filename-derived guess was found resolving to DejaVu Sans Bold Oblique instead of the intended font). The dropdown now sources real names from `fc-list`, and width estimation for decoration/box sizing is calibrated against real rendered pixel measurements from two independent fonts (bold is ~4-8% wider than regular; italic doesn't reliably add width). Line-wrapping keeps a separate, larger safety margin specifically to protect against the wrong-font-substitution case actually overflowing the canvas

### Changed
- Composite's Color and Frost Opacity fields default to 50 (partial tint/overlay), not 100 — Image overlays default to fully opaque as before
- README restructured: single Table of Contents, a top-level Features table, and each operation documented individually

## [1.0.0]

Full rewrite of the Text operation's positioning, sizing, and styling system.

### Added
- Independent Gravity (image anchor) and Box Anchor (which part of the text box sits on that point)
- Text Align: Left / Center / Right / **Justify** (real per-word stretch, with an optional "Stretch Last Line" mode)
- Independent Width/Height Auto-or-Custom modes, each in pixels or percent
- Max **and** Min Line Length, each in Characters / Percent / Pixels, with orphan-line-avoiding wrap that never overflows the configured bounds
- Text Opacity, full 100–900 Font Weight, Italic/Oblique Font Style, Text Decoration (underline/overline/line-through)
- Text Stroke (outline)
- Text Shadow with real Gaussian blur, color, opacity, and offset
- Text Background: Solid color or genuine frosted-glass (real backdrop blur + tint)
- CSS-style shorthand Background Padding (1/2/3/4-value syntax)
- Background Border with percent-based corner radius
- Text Overflow modes: Visible / Wrap (force-break unbreakable long words) / Clip
- Case-insensitive handling for every options field, including via expressions

### Fixed
- Character-width estimation now accounts for font weight (bold text is measurably wider per character)
- Blank lines (double line breaks) no longer collapse to zero height
- Justify no longer stretches the final line of a paragraph (matches standard typography)

