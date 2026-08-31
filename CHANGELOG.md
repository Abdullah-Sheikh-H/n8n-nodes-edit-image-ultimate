# Changelog

All notable changes to this project are documented here.

## [1.3.1]

### Fixed
- **Template's seven font fields (Title, Subtitle, Quote, Quote Author, Top Text, Bottom Text, Watermark) were missing most of the server's actual installed fonts.** Each used a small hardcoded 11-font list plus a separate "(Custom)" text field for anything else. They now use the exact same live `getFonts` dropdown as the Text operation's Font Family — sourced from `fc-list`, so every font actually installed on the server shows up, with the same "fx" expression override for a typed name or a real font file path. The separate "(Custom)" fields are gone; typing a custom value now works the same way it already did for Text
- **Case-insensitivity, previously only applied to a handful of fields (Gravity, Box Anchor, Font Style, Text Decoration, Background Style), is now applied to every dropdown/options field on the entire node** — Blend Mode, Resize Fit, Draw Primitive, Watermark Gravity, Template Layout, Template Text Effect, the Template preset name, the output Format, and the Operation selector itself all now accept any casing via expression (`"MULTIPLY"`, `"Multiply"`, `"multiply"` are equivalent), with whitespace trimmed automatically. Font Weight is the one exception, since its values are plain numbers

## [1.3.0]

### Fixed
- **Critical: Multi-Step mode (and any chain of Text/Composite/Watermark/Draw operations) silently discarded earlier steps.** `sharp`'s `.composite()` does not accumulate across separate calls in a chain — each call replaces the pending overlay list rather than adding to it (confirmed directly: a red base + blue square + green square, composited in two separate calls, rendered with the blue square completely missing). This meant a Template step followed by a Text step, followed by another Text step, would each overwrite the previous step's overlays instead of layering on top — "hi2" erasing "hi1", both erasing the Template's gradient. Every operation that composites onto the image (Text, Composite, Watermark, Draw, and Template's own construction) now materializes into a real buffer immediately after compositing, so each step starts from a fully "baked" base
- `(input ?? "").trim is not a function` — any `string`-typed field (Border Radius, Background Padding, Text, Font Family, and every Template text field) could crash the whole node run if it received a non-string value at runtime — which can happen via expression mode, since a UI field's declared `type: 'string'` has no actual effect on what value arrives at runtime. Added a shared `asString()` coercion used everywhere a string method (`.trim()`, `.split()`, `.replace()`, etc.) is called on a field value
- **Font names containing a space followed by a digit (e.g. "Exo 2") rendered as a completely different font, with no error.** Root-caused by direct testing: setting `font-family="Exo 2"` as a plain SVG presentation attribute gets parsed by the underlying renderer as a compact Pango font-description string, where the trailing digit is ambiguous with a point-size specifier — "Exo 2" was silently read as family "Exo" at size 2, falling back to a default font. Confirmed the fix directly: routing the same value through `style="font-family: '...'"` instead uses CSS's own parser and resolves correctly. Fixed everywhere a font is set — Text and every Template text field
- **Position X/Y (Text and Composite) rewritten to a single, unified system — no more separate "Position Behavior" mode to pick.** Direction is now always the same literal compass direction regardless of which Gravity is chosen: **+X = right, -X = left, +Y = up, -Y = down**. `0` always means "exactly at the Gravity anchor, no offset." In Percent mode, `100%` (or `-100%`) reaches whichever canvas edge actually lies in that direction *from that Gravity's own anchor point*, via ray/box intersection — so a Gravity already sitting on an edge (e.g. South is already at the bottom) naturally has no room left in that direction, and that side of the range collapses to a no-op on its own, with no per-Gravity special-casing needed in code. Center (and any axis where the chosen Gravity is centered) stays symmetric in both directions, exactly as before; corner and edge Gravities now behave correctly instead of measuring distance against the wrong edge. Position X/Y field tooltips now include a full per-Gravity quick reference table

### Added
- **Template** operation: Title, Subtitle, Quote, Top Text, and Bottom Text each get their own **Max/Min Line Length** controls — Characters, Percent of Image Width, or Pixels — using the exact same wrapping engine as the Text operation (real estimated glyph width, not a naive average-character guess), instead of a single crude character-count wrap (Quote) or no wrapping at all (Title, Subtitle, meme text)
- **Position X/Y** (Text and Composite) now have a **Position Unit** (Pixels or **Percent**, the default) — see the Position X/Y fix above for the full behavior

## [1.2.0]

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
- **`(input ?? "").trim is not a function`** — any `string`-typed field (Border Radius, Background Padding, Text, Font Family, and every Template text field) could crash the whole node run if it received a non-string value at runtime — which can happen via expression mode, since a UI field's declared `type: 'string'` has no actual effect on what value arrives at runtime. Added a shared `asString()` coercion used everywhere a string method (`.trim()`, `.split()`, `.replace()`, etc.) is called on a field value, so a number, boolean, `null`, or `undefined` is handled gracefully instead of throwing

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

