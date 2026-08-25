# Changelog

All notable changes to this project are documented here.

## [1.1.0]

### Added
- **Font Family** dropdown for the Text operation — dynamically populated from fonts actually installed on the server (via `get-system-fonts`), with expression-mode support for any custom name or file path
- **Decoration Style** modes for Text Decoration (underline/overline/line-through): **Plain** (simple line), **Match Text** (inherits the text's own stroke and shadow), **Custom** (independent color, thickness, stroke, and shadow)
- **Decoration Shadow Blur** — the decoration shadow now supports a genuine Gaussian blur, not just a flat offset copy

### Fixed
- Text Decoration is now drawn as real SVG `<line>` elements instead of the `text-decoration` attribute, which the SVG renderer doesn't reliably honor — decoration lines now actually appear, and track the real width of the text underneath them
- Decoration shadow blur was rendering completely clipped away in earlier testing: a horizontal `<line>` has a zero-height bounding box, so the default percentage-based filter region collapsed to zero regardless of the blur value. Fixed by giving each decoration shadow its own explicit pixel-space filter region sized around that specific line
- Bold and italic text could render wider than estimated and spill past the configured line-length boundary (most visible at Max Line Length = 100%). Widened the weight/style width-estimation multipliers and added a small general safety margin so wrapped lines land just inside the boundary instead of flush against it — this also makes the decoration line track the actual text width more closely, since both are derived from the same measurement

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

