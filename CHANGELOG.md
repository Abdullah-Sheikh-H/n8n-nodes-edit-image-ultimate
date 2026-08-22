# Changelog

All notable changes to this project are documented here.

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
