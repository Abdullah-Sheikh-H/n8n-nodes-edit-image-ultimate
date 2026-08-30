<p align="center">
  <img src="https://raw.githubusercontent.com/Abdullah-Sheikh-H/n8n-nodes-edit-image-ultimate/main/docs/images/logo.svg" width="96" height="96" alt="Edit Image Ultimate logo">
</p>

<h1 align="center">n8n-nodes-edit-image-ultimate</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/n8n-nodes-edit-image-ultimate"><img src="https://img.shields.io/npm/v/n8n-nodes-edit-image-ultimate.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/n8n-nodes-edit-image-ultimate"><img src="https://img.shields.io/npm/dm/n8n-nodes-edit-image-ultimate.svg" alt="npm downloads"></a>
  <a href="LICENSE.md"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://docs.n8n.io/integrations/community-nodes/"><img src="https://img.shields.io/badge/n8n-community--node-orange" alt="n8n community node"></a>
</p>

<p align="center">
  <strong>Advanced image editing for <a href="https://n8n.io">n8n</a></strong>, powered by <strong><a href="https://sharp.pixelplumbing.com/">Sharp</a></strong> (libvips). No GraphicsMagick required.
</p>

<p align="center">
This node renders text through real SVG — genuine font weights, italics, Gaussian-blurred shadows, frosted-glass backgrounds, and CSS-style justification, none of which GraphicsMagick can do — and pairs it with a full Sharp-powered toolkit: a social-graphic template generator, 24 compositing blend modes, and a Multi-Step mode that chains any combination of operations in a single node.
</p>

<table align="center">
  <tr>
    <td align="center" width="33%">
      <img src="https://raw.githubusercontent.com/Abdullah-Sheikh-H/n8n-nodes-edit-image-ultimate/main/docs/images/actions-list.png" width="260" alt="Edit Image Ultimate — 23 available actions"><br>
      <sub>23 built-in actions</sub>
    </td>
    <td align="center" width="33%">
      <img src="https://raw.githubusercontent.com/Abdullah-Sheikh-H/n8n-nodes-edit-image-ultimate/main/docs/images/text-operation-panel-1.png" width="260" alt="Text operation — font, positioning, and alignment fields"><br>
      <sub>Text — font & positioning</sub>
    </td>
    <td align="center" width="33%">
      <img src="https://raw.githubusercontent.com/Abdullah-Sheikh-H/n8n-nodes-edit-image-ultimate/main/docs/images/text-operation-panel-2.png" width="260" alt="Text operation — wrapping, decoration, and effects fields"><br>
      <sub>Text — wrapping & decoration</sub>
    </td>
  </tr>
</table>

---

## Overview

n8n's built-in **Edit Image** node has 13 actions. This node has 23 — 10 operations that don't exist in the built-in node at all (Flip, Flop, Apply Gamma, Convert to Grayscale, Normalize, Apply Sepia Tone, Sharpen, Create from Template, Tint, Add Watermark), plus the original 13, of which Text, Composite, and Multi Step are substantially deeper here.

**Features**

| Operation | Summary |
|---|---|
| Text | Styled text rendered through real SVG — font weight/style, dynamic font selection, line wrapping, decoration with shadow, text shadow, and a solid-or-frosted-glass background |
| Template | Generates a complete social-graphic (Instagram, YouTube, LinkedIn, and 11 more presets) from scratch, no source image needed |
| Composite | Overlays an image, a solid colour panel, or a genuine frosted-glass panel — with 24 blend modes, configurable size/position, rounded corners, and a border |
| Multi Step | Chains any combination of operations in a single node run, including the operations below that don't exist in the built-in node |
| Flip | Mirrors the image vertically |
| Flop | Mirrors the image horizontally |
| Apply Gamma | Gamma-corrects the image's brightness curve (1.0–3.0) |
| Convert to Grayscale | Converts the image to black and white |
| Normalize | Stretches contrast to the full available dynamic range |
| Apply Sepia Tone | Applies a warm, vintage sepia tone |
| Sharpen | Unsharp mask with sigma / flat / jagged controls |
| Tint | Applies a colour hue overlay |
| Add Watermark | Overlays a logo/image with opacity control and 9-point gravity positioning |

---

## Table of Contents

1. [Installation](#1-installation)
2. [Requirements](#2-requirements)
3. [Operations at a Glance](#3-operations-at-a-glance)
4. [Text Operation](#4-text-operation)
   - 4.1 [Content and Font](#41-content-and-font)
   - 4.2 [Positioning](#42-positioning)
   - 4.3 [Sizing](#43-sizing)
   - 4.4 [Line Wrapping and Overflow](#44-line-wrapping-and-overflow)
   - 4.5 [Text Styling](#45-text-styling)
   - 4.6 [Text Decoration](#46-text-decoration)
   - 4.7 [Text Background](#47-text-background)
   - 4.8 [Case-Insensitivity and Expressions](#48-case-insensitivity-and-expressions)
5. [Template Operation](#5-template-operation)
   - 5.1 [Layout Modes](#51-layout-modes)
   - 5.2 [Template Presets](#52-template-presets)
   - 5.3 [Color Controls](#53-color-controls)
   - 5.4 [Font Controls](#54-font-controls)
   - 5.5 [Text Effects](#55-text-effects)
   - 5.6 [Quote Watermark](#56-quote-watermark)
6. [Image Editing Operations](#6-image-editing-operations)
   - 6.1 [Blur](#61-blur)
   - 6.2 [Border](#62-border)
   - 6.3 [Composite](#63-composite)
   - 6.4 [Create](#64-create)
   - 6.5 [Crop](#65-crop)
   - 6.6 [Draw](#66-draw)
   - 6.7 [Flip](#67-flip)
   - 6.8 [Flop](#68-flop)
   - 6.9 [Apply Gamma](#69-apply-gamma)
   - 6.10 [Convert to Grayscale](#610-convert-to-grayscale)
   - 6.11 [Normalize](#611-normalize)
   - 6.12 [Resize](#612-resize)
   - 6.13 [Rotate](#613-rotate)
   - 6.14 [Apply Sepia Tone](#614-apply-sepia-tone)
   - 6.15 [Sharpen](#615-sharpen)
   - 6.16 [Shear](#616-shear)
   - 6.17 [Tint](#617-tint)
   - 6.18 [Transparent](#618-transparent)
   - 6.19 [Add Watermark](#619-add-watermark)
   - 6.20 [Get Information](#620-get-information)
7. [Multi-Step Mode](#7-multi-step-mode)
8. [Output Options](#8-output-options)
9. [Quick Start Examples](#9-quick-start-examples)
10. [Known Limitations](#10-known-limitations)
11. [Changelog](#11-changelog)
12. [Contributing](#12-contributing)
13. [License](#13-license)

---

## 1. Installation

### Via n8n Community Nodes (recommended)

1. Open your n8n instance
2. Go to **Settings → Community Nodes**
3. Click **Install**
4. Enter `n8n-nodes-edit-image-ultimate`
5. Click **Install**

### Via npm (self-hosted / Docker)

```bash
npm install n8n-nodes-edit-image-ultimate
```

Point the `N8N_CUSTOM_EXTENSIONS` environment variable at the package, or place it under your n8n user data directory's `custom/` folder.

> **Docker + custom fonts:** if you want fonts like Playfair Display or Cormorant Garamond to render (rather than falling back to a default), mount the font files into the container. Sharp renders SVG text using whatever fonts are installed on the host OS — the [Font Family](#41-content-and-font) dropdown only lists what it can actually find there.

---

## 2. Requirements

| Requirement | Version |
|---|---|
| n8n | v2.30.0 or later |
| Node.js | v18 or later |
| System dependencies | None — Sharp ships pre-built native binaries for Windows, Linux, and macOS |

---

## 3. Operations at a Glance

| Operation | What it does |
|---|---|
| [Text](#4-text-operation) | Styled text with wrapping, decoration, shadow, background, and precise positioning |
| [Template](#5-template-operation) | Generates a complete social-media graphic from a preset — no source image needed |
| Blur | Gaussian blur, configurable sigma |
| Border | Solid-colour padding/border |
| Composite | Overlay an image, colour panel, or frosted-glass panel — 24 blend modes |
| Create | Blank canvas in a solid colour |
| Crop | Extract a region by position and size |
| Draw | Rectangle, circle, or line, with fill and stroke |
| Flip | Vertical mirror (top ↔ bottom) |
| Flop | Horizontal mirror (left ↔ right) |
| Gamma | Gamma correction (1.0–3.0) |
| Grayscale | Convert to black and white |
| Normalize | Stretch contrast to the full dynamic range |
| Resize | Five fit modes: cover, contain, fill, inside, outside |
| Rotate | Rotate by any angle, with background fill for non-90° angles |
| Sepia | Warm vintage tone |
| Sharpen | Unsharp mask with sigma / flat / jagged controls |
| Shear | Shear along X/Y via affine transform |
| Tint | Colour hue overlay |
| Transparent | Replace a colour with alpha transparency |
| Watermark | Opacity-controlled image overlay with gravity positioning |
| Get Information | Return image metadata (size, format, DPI, channels) |
| Multi Step | Chain any combination of the above in one node run |

Full field-by-field reference for every operation other than Text and Template is in [§6](#6-image-editing-operations).

---

## 4. Text Operation

Set **Operation** to **Text** to reveal all of the fields below. This is the deepest feature set in the node, so it's organised into the same logical groups you'll see in the n8n UI.

<p align="center">
  <img src="https://raw.githubusercontent.com/Abdullah-Sheikh-H/n8n-nodes-edit-image-ultimate/main/docs/images/text-operation-panel-1.png" width="360" alt="Text operation panel, top half: font, color, weight, style, alignment, gravity">
</p>

### 4.1 Content and Font

| Field | Details |
|---|---|
| **Text** | The text content to render. Supports multi-line input and expressions. |
| **Font Size** | Font size in pixels. |
| **Font Family** | A dropdown populated with the real, exact family names fontconfig has registered on the server (via `fc-list`) — not a guessed name derived from a filename, so whatever you pick is guaranteed to resolve to that exact font. To use a font that isn't listed, click the **fx** expression icon and either type its family name directly, or type a real path to a `.ttf`/`.otf`/`.woff`/`.woff2`/`.ttc` file (with or without the extension) — the node registers that exact font file with the server on the fly and uses it, no manual installation needed. A typed name that doesn't match any real font and isn't a valid file path won't error; fontconfig silently substitutes a different, unrelated font instead, so double-check the spelling (or the path) if a font doesn't look right. |
| **Font Color** | Text colour. |
| **Font Weight** | Full CSS 100–900 range (Thin through Black) via a dropdown. Click **fx** to pass a custom numeric value instead. |
| **Font Style** | Normal / Italic / Oblique. |

> **Font availability:** weight and style variants only render if that specific font file is actually installed on the server — Sharp can't synthesise a bold or italic that doesn't exist. The Font Family dropdown derives names from font *filenames*, cleaned up; this matches standard system fonts well but may be approximate for unusual ones.

### 4.2 Positioning

Positioning is split into four independent controls, matching how design tools like Figma or Photoshop handle a reference point:

| Field | Details |
|---|---|
| **Gravity** | A fixed anchor point on the *full image* — North West, North, North East, West, Center, East, South West, South, South East. Center is always the exact middle of the image, regardless of text content. |
| **Position Unit** | Pixels, or **Percent** (default). See Position X / Position Y below for what 100%/0%/-100% mean. |
| **Position X / Position Y** | Offset from the Gravity anchor, in a single unified system used the same way for every Gravity — no separate "behavior" to pick. Direction is always the same literal compass direction: **+X = right, -X = left, +Y = up, -Y = down**. `0` always means "exactly at the Gravity anchor, no offset." In Percent mode, `100%` reaches the canvas edge in that direction *from that Gravity's own anchor point* (via ray/box intersection) — but if the chosen Gravity already sits on that edge, there's no room left, so pushing further that way has no effect. Concretely: Center is symmetric in both axes (`-100`/`0`/`100` = left/center/right and bottom/center/top). North and South share Center's X range but their Y range is one-sided (North: `-100…0` = bottom…top-anchor; South: `0…100` = bottom-anchor…top). East and West are the mirror on X (East: `-100…0` = left…right-anchor; West: `0…100` = left-anchor…right), sharing Center's Y range. The four corners combine both one-sided ranges — e.g. North East: X `-100…0` (left…right-anchor), Y `-100…0` (bottom…top-anchor). |
| **Box Anchor** | Which point of the *text box itself* lands on the final Gravity + Position point (same 9-point options). For example, Box Anchor = North means the box's top edge sits at that point and the box extends downward from it — this is what lets you pin text flush to an edge without the top being cut off. |
| **Text Align** | Left / Center / Right / **Justify** — controls how each line sits *within* the box, independent of Box Anchor. Only visually matters for multi-line text where lines differ in length. |

**Worked example:** Gravity = North, Position Y = 0, Box Anchor = North → the box's top edge sits exactly at the image's top edge and extends fully downward — nothing is cut off. If Box Anchor were Center instead, the box's *center* would land on that same point, pushing half the box above the visible canvas.

**Justify** is implemented via genuine per-word pixel positioning — each word gets an explicit X coordinate, with gap widths calculated so the line spans the full box width — rather than SVG's `textLength`/`lengthAdjust` attribute, which isn't reliably supported across SVG renderers (including the one Sharp uses). This guarantees consistent, visible justification.
- The **last line of every paragraph** stays at its natural width by default. Stretching a short final line produces large, ugly gaps — no real justify implementation (CSS, Word, InDesign) does it either.
- **Stretch Last Line** (shown when Text Align = Justify) forces every line, including short trailing ones, to stretch to full width — a deliberate poster/graphic-design look rather than standard typography.
- Single-word lines are never stretched, since there's nothing to distribute gaps between.

### 4.3 Sizing

**Box Width Mode** and **Box Height Mode** are fully independent — mix and match, e.g. Width = Custom (60%) with Height = Auto.

| Mode | Behaviour |
|---|---|
| **Auto** | Estimated from the actual text content and font size. |
| **Custom** | Reveals a **Unit** selector (Pixels / Percent of Image Width or Height) plus a size field. |

### 4.4 Line Wrapping and Overflow

**Max Line Length Mode** and **Min Line Length Mode** each support **Characters** / **Percent of Image Width** / **Pixels** (Min also has **Auto**, which disables the minimum entirely).

| Field | Details |
|---|---|
| **Max Line Length (%/px/chars)** | An absolute hard ceiling. In Percent/Pixels mode, width is measured character-by-character against a real width-ratio table (narrow letters like `i`/`l`/`t`/`j` count less than wide letters like `m`/`w`/`M`/`W`), scaled up for bolder font weights and italic style — meaningfully more accurate than a flat "average character width," which mis-measures text depending on which specific letters it contains. Characters mode is a literal character count instead. |
| **Min Line Length (%/px/chars)** | Avoids short "orphan" trailing lines (e.g. a lone word like "zeta" wrapping onto its own line) by merging short lines into the one before them — but only if the merge doesn't exceed Max. If satisfying Min would require exceeding Max, the line is simply left shorter than the minimum; overflowing the canvas is treated as worse than one uneven line. |
| **Text Overflow** | Handles the separate case of a single unbreakable word with no spaces, which word-wrap alone can never break. **Visible** (default) lets long unbroken words spill past the wrap width. **Wrap** force-breaks only genuinely unbreakable single-word lines into hard character chunks — legitimate multi-word lines are never shattered mid-word. **Clip** hides anything extending past the box's bounds entirely. |

### 4.5 Text Styling

| Field | Details |
|---|---|
| **Text Opacity** | 0–100, maps to SVG `fill-opacity`. |
| **Enable Text Stroke** | → **Stroke Color**, **Stroke Width** — a real vector outline via SVG `stroke`, rendered behind the fill. |
| **Enable Text Shadow** | → **Shadow Color**, **Shadow Opacity**, **Shadow Blur**, **Shadow Offset X/Y** — a genuine Gaussian-blurred `feDropShadow`, not a flat offset copy. |

### 4.6 Text Decoration

| Field | Details |
|---|---|
| **Text Decoration** | None / Underline / Overline / Line Through. Drawn as real SVG `<line>` elements rather than the SVG `text-decoration` attribute, which isn't reliably honored by the renderer Sharp uses. The line's span is measured from the actual rendered text, so it tracks the text width even across bold/italic weights and multi-line wrapped text. |
| **Decoration Style** | **Plain** — a simple solid line in the font colour, no extra effects. **Match Text** — the decoration line automatically inherits the same stroke and shadow you've enabled on the text itself, so it blends in instead of looking disconnected. **Custom** — set the decoration's colour, thickness, stroke, and shadow independently from the text. |
| **Decoration Color / Thickness** | *(Custom only)* Colour and pixel thickness of the line. |
| **Enable Decoration Stroke** | *(Custom only)* → **Decoration Stroke Color**, **Decoration Stroke Width** — an outline drawn around the decoration line itself, like a thin outlined bar. |
| **Enable Decoration Shadow** | *(Custom only)* → **Decoration Shadow Color**, **Decoration Shadow Opacity**, **Decoration Shadow Offset X/Y**, and **Decoration Shadow Blur** — an offset shadow line behind the decoration, with an optional genuine Gaussian blur. |

> **Why Decoration Shadow Blur exists as its own field:** a plain horizontal `<line>` has a zero-height bounding box, so a naive percentage-based blur filter region collapses to zero regardless of the blur value — the blur ends up silently clipped away. This node gives each decoration shadow its own explicit pixel-space filter region sized around that specific line, so the blur actually renders instead of disappearing.

### 4.7 Text Background

| Field | Details |
|---|---|
| **Enable Text Background** | → **Background Style**: **Solid** (flat fill colour) or **Glass (Frosted)**. |
| **Glass (Frosted)** | The image region behind the box is genuinely cropped, blurred, and composited back in — clipped to the box's rounded shape — with a tinted overlay on top. A real translucent glass-card effect, not a fake semi-transparent colour. |
| **Frost** | 0–100, shown when Background Style = Glass. 0 = fully invisible (no blur, no tint); 100 = heaviest blur with a fully opaque tint. Controls both tint opacity and backdrop blur intensity together. |
| **Background Padding** | CSS-style shorthand: `"12"` (all sides), `"10 20"` (top/bottom, then left/right — real CSS order, not x/y), `"10 20 30"`, or `"10 20 30 40"` (top, right, bottom, left). |
| **Enable Background Border** | → **Border Color**, **Border Width**. |
| **Border Radius Unit** | Pixels, or **Percent** relative to the box's own size (0% = sharp corners, 100% = fully pill-shaped) → **Border Radius**, a CSS `border-radius`-style shorthand: 1 value = all four corners, 2 values = "top-left/bottom-right top-right/bottom-left", 3 values = "top-left top-right/bottom-left bottom-right", 4 values = "top-left top-right bottom-right bottom-left" (clockwise from top-left). E.g. `"20"` (all corners) or `"20 20 0 0"` (rounded top, square bottom). |

### 4.8 Case-Insensitivity and Expressions

Every dropdown/options field on this node is case-insensitive when set via expression — `"Center"`, `"CENTER"`, and `"center"` all behave identically (Gravity, Box Anchor, Font Style, Text Decoration, Background Style, and every other options field), with whitespace trimmed automatically too.

---

## 5. Template Operation

The **Template** operation generates a fully composed image graphic from scratch — no source image required. Set **Operation** to **Template** to use it.

### 5.1 Layout Modes

| Layout | Description |
|---|---|
| **Standard** | Title and Subtitle text — blog graphics, social posts, announcements. |
| **Quote** | Large centered italic quote text with an author attribution at the bottom. |
| **Meme** | Bold Impact-style text at the top and/or bottom of the image. |

Title, Subtitle, Quote, Top Text, and Bottom Text each have their own **Max/Min Line Length** controls, directly below that text field — Characters, Percent of Image Width, or Pixels, same system as the Text operation's own Max/Min Line Length (see [§4.4](#44-line-wrapping-and-overflow)). Max defaults to 30 characters; Min defaults to Auto (no minimum).

### 5.2 Template Presets

| Preset | Dimensions |
|---|---|
| Instagram Post | 1080 × 1080 |
| Instagram Story | 1080 × 1920 |
| Instagram Portrait | 1080 × 1350 |
| Twitter / X Post | 1200 × 675 |
| YouTube Thumbnail | 1280 × 720 |
| Facebook Post | 1200 × 630 |
| LinkedIn Banner | 1584 × 396 |
| LinkedIn Post | 1200 × 627 |
| Pinterest Pin | 1000 × 1500 |
| Open Graph | 1200 × 630 |
| Email Header | 600 × 200 |
| Presentation Slide | 1920 × 1080 |
| Business Card | 1050 × 600 |
| A4 Document | 2480 × 3508 |
| **Custom** | Any size you specify |

### 5.3 Color Controls

| Control | Description |
|---|---|
| **Background Color** | Solid fill behind everything. |
| **Gradient Overlay Color** | Subtle gradient tint on top of the background, independent from Accent. |
| **Accent Color** | Colour of the accent bar and corner decorations. |
| **Title Color** | Colour of the title or quote text. |
| **Subtitle Color** | Colour of the subtitle or author text. |

### 5.4 Font Controls

Every text field has its own **Font** dropdown so you can mix and match typography per element: **Title Font**, **Subtitle Font**, **Quote Font**, **Quote Author Font**, **Meme Top Font**, **Meme Bottom Font**, **Watermark Font**.

Available fonts include Arial, Times New Roman, Georgia, Courier New, Verdana, Trebuchet MS, Impact, Playfair Display, Cormorant Garamond, Lora, Montserrat, Lato, Courier Prime, and more. Type any font name installed on your server directly via expression mode if it's not in the list.

> Web fonts such as Playfair Display must be installed on the OS running your n8n server to render. System fonts like Arial and Georgia will always work.

### 5.5 Text Effects

One effect applies globally to all text on the canvas:

| Effect | Controls |
|---|---|
| **Default** | Subtle drop shadow for Standard/Quote; outline stroke for Meme. |
| **None** | Flat text, no effects. |
| **Drop Shadow** | Color, Blur Size, Offset X/Y, Opacity. |
| **Glow** | Color, Blur Size, Opacity. |
| **Outline** | Color, Outline Width. |

### 5.6 Quote Watermark

When Layout Type = Quote, a subtle text watermark (e.g. `@yourbrand`) is available: **Watermark Text**, **Font**, **Color**, **Opacity (%)**, plus **X Position (%)** and **Y Position (%)** for precise placement anywhere on the canvas.

---

## 6. Image Editing Operations

Field-by-field reference for every operation besides Text and Template. Every operation also requires a **Property Name** — the binary property on the input item that holds the image data.

### 6.1 Blur

Applies a Gaussian blur.

| Field | Details |
|---|---|
| **Sigma** | 0.3–1000, default 3. Blur radius — higher values blur more. |

### 6.2 Border

Adds a solid-colour border/padding around the image.

| Field | Details |
|---|---|
| **Border Width** | Pixels, default 20. Left and right border width. |
| **Border Height** | Pixels, default 20. Top and bottom border height. |
| **Border Color** | Default `#000000`. |

### 6.3 Composite

Overlays a panel onto the image — an image, a solid colour, or a genuine frosted-glass panel — using any of 24 blend modes.

| Field | Details |
|---|---|
| **Overlay Type** | Image / Color / Frost (Glass). Default Image. Determines which fields below apply. |
| **Composite Image Property** | *(Image only)* Binary property name of the overlay image, default `data2`. Resized to exactly fill the panel's Width × Height (aspect ratio not preserved). |
| **Color** | *(Color only)* Fill colour of the panel. |
| **Opacity (%)** | *(Color and Frost)* 0–100, default 50. For Color, the panel's overall opacity. For Frost, the opacity of the colour tint drawn over the blurred backdrop — 0 leaves the blurred backdrop with no tint at all. |
| **Frost Amount** | *(Frost only)* 0–100, default 50. How heavily the backdrop behind the panel is blurred — the region of the *current* image behind the panel is cropped, blurred, and laid back down clipped to the panel's shape, exactly like Text's Glass background. |
| **Color** | *(Frost only)* Tint colour drawn over the blurred backdrop. |
| **Blend Mode** | 24 options: Clear, Source, Over (Normal), In, Out, Atop, Destination Over/In/Out/Atop, Xor, Add, Saturate, Multiply, Screen, Overlay, Darken, Lighten, Colour Dodge, Colour Burn, Hard Light, Soft Light, Difference, Exclusion — matching standard compositing operators used in design tools like Photoshop. Default Over (Normal). Applies to all three Overlay Types. |
| **Width Unit / Width** | Percent of Image Width, or Pixels. Default 100 (%). |
| **Height Unit / Height** | Percent of Image Height, or Pixels. Default 100 (%). |
| **Gravity** | 9-point anchor on the *base image* — same model as Text's Gravity. Default Center. |
| **Box Anchor** | Which point of the panel itself lands on the Gravity + Position point — same model as Text's Box Anchor. Default Center. |
| **Position Unit** | Pixels, or **Percent** (default). |
| **Position X / Position Y** | Offset from the Gravity anchor, default 0, 0 — same unified system as Text's Position X/Y: +X = right, -X = left, +Y = up, -Y = down, always; `0` = the Gravity anchor; `100%`/`-100%` reaches whichever canvas edge is actually reachable from that Gravity in that direction (a Gravity already sitting on an edge has no room left that way). See the full per-Gravity breakdown in [§4.2](#42-positioning). |
| **Enable Border** | → **Border Color**, **Border Width**. |
| **Border Radius Unit** | Pixels, or Percent of the panel's own size. |
| **Border Radius** | CSS `border-radius`-style shorthand, space-separated, clockwise from the top-left corner: 1 value = all four corners, 2 values = "top-left/bottom-right top-right/bottom-left", 3 values = "top-left top-right/bottom-left bottom-right", 4 values = "top-left top-right bottom-right bottom-left". E.g. `"20"` (all corners) or `"20 20 0 0"` (rounded top, square bottom). Default `"0"` (sharp corners). |

### 6.4 Create

Generates a blank canvas in a solid colour — useful as a starting point before adding Text or other operations.

| Field | Details |
|---|---|
| **Background Color** | Default `#ffffff`, supports alpha. |
| **Image Width / Image Height** | Pixels, default 1080 × 1080. |

### 6.5 Crop

Extracts a rectangular region from the image.

| Field | Details |
|---|---|
| **Width / Height** | Pixels, default 500 × 500. Size of the crop region. |
| **Position X / Position Y** | Pixels, default 0, 0. Top-left corner of the crop region. |

### 6.6 Draw

Draws a rectangle, circle, or line directly onto the image, with independent fill and stroke.

| Field | Details |
|---|---|
| **Primitive** | Rectangle / Circle / Line. Default Rectangle. |
| **Color** | Fill colour, default `#ff0000`, supports alpha. |
| **Stroke Color** | Default `#000000`, supports alpha. |
| **Stroke Width** | Pixels, default 0 (no stroke). |
| **Start Position X/Y, End Position X/Y** | Pixel coordinates defining the shape's bounds. |

### 6.7 Flip

Mirrors the image vertically — top becomes bottom. No additional fields.

### 6.8 Flop

Mirrors the image horizontally — left becomes right. No additional fields.

### 6.9 Apply Gamma

Gamma-corrects the image's brightness curve.

| Field | Details |
|---|---|
| **Gamma Value** | 1.0 to 3.0, default 2.2. Lower values darken the image, higher values brighten it — this adjusts the tonal curve rather than a flat brightness shift, so midtones are affected more than the extremes. |

### 6.10 Convert to Grayscale

Converts the image to black and white. No additional fields.

### 6.11 Normalize

Stretches contrast to use the full available dynamic range — a flat, low-contrast image gets its darkest pixel pushed toward black and its brightest pixel pushed toward white, with everything else scaled proportionally in between. No additional fields.

### 6.12 Resize

Resizes the image using one of five fit strategies.

| Field | Details |
|---|---|
| **Width / Height** | Pixels, default 1080 × 1080. Target dimensions. |
| **Fit** | Cover (scales to fill, crops excess) / Contain (scales to fit, adds padding) / Fill (stretches, ignores aspect ratio) / Inside (scales down only if larger) / Outside (scales up only if smaller). Default Cover. |
| **Background Color (for Contain)** | Default `#000000`, supports alpha. Fill colour for the padding added by Contain. |

### 6.13 Rotate

Rotates the image by any angle.

| Field | Details |
|---|---|
| **Degrees** | -360 to 360, default 90. Positive rotates clockwise. |
| **Background Color** | Default transparent. Fill for the area revealed when rotating by anything other than a multiple of 90°. |

### 6.14 Apply Sepia Tone

Applies a warm, vintage sepia tone across the image. No additional fields.

### 6.15 Sharpen

Applies an unsharp mask — the standard sharpening technique used by most image editors.

| Field | Details |
|---|---|
| **Sharpen Sigma** | 0.5–5, default 1. The radius of the sharpening effect — higher values sharpen a wider band around each edge. |
| **Sharpen Flat** | 0–10000, default 1. Threshold for "flat" (low-detail) areas — lower values cause more of the image to be sharpened, including subtle textures. |
| **Sharpen Jagged** | 0–10000, default 2. Threshold for "jagged" (high-detail) edges — higher values sharpen strong edges more aggressively. |

### 6.16 Shear

Shears the image along the X and/or Y axis via an affine transform.

| Field | Details |
|---|---|
| **Shear X (degrees)** | Default 0. Horizontal shear angle. |
| **Shear Y (degrees)** | Default 10. Vertical shear angle. |

### 6.17 Tint

Applies a colour hue overlay across the image.

| Field | Details |
|---|---|
| **Tint Color** | Default `#ff6b35`. The colour used to tint the image — this shifts the image's hue toward the chosen colour rather than simply overlaying it at reduced opacity. |

### 6.18 Transparent

Replaces a specific colour with alpha transparency (PNG output).

| Field | Details |
|---|---|
| **Background Color to Remove** | Default `#ffffff`. The colour to replace with transparency. |
| **Tolerance** | 0–255, default 30. How close a pixel's colour needs to be to the target colour to be made transparent. |

### 6.19 Add Watermark

Overlays a second image (e.g. a logo) onto the source image, with opacity and positioning control.

| Field | Details |
|---|---|
| **Watermark Image Property** | Binary property name containing the watermark image, default `watermark`. |
| **Gravity (Position)** | 9-point placement: Center, Top Left/Center/Right, Middle Left/Right, Bottom Left/Center/Right. Default Bottom Right. |
| **Opacity (%)** | 0 (invisible) to 100 (fully opaque), default 50. |
| **Max Size (% of Canvas)** | 1–100, default 20. The watermark is scaled so its longest side is this percentage of the canvas — keeps a logo proportionally sized regardless of the source image's dimensions. |

### 6.20 Get Information

Returns image metadata — width, height, format, DPI, and channel count. No additional fields.

---

## 7. Multi-Step Mode

Set **Operation** to **Multi Step** to chain any combination of the operations above in a single node execution, applied in order. Add each step, choose its operation, and configure that operation's own fields inline — useful for common pipelines like Resize → Sharpen → Text without needing separate nodes for each stage.

---

## 8. Output Options

All operations share the following output settings:

| Option | Description |
|---|---|
| **Format** | Defaults to **"Same as Input"** — detects and preserves the original image's format (e.g. a JPEG stays a JPEG) instead of silently converting everything to lossless PNG, which can inflate a detailed photo 10–20× in size. Explicitly set `png` / `jpeg` / `webp` / `avif` / `tiff` / `gif` to override. |
| **Quality** | 1–100 for jpeg / webp / avif, shown only when Format is explicitly one of those. |
| **PNG Compression** | 0 (fastest) to 9 (smallest), relevant only when Format is explicitly `png`. |
| **Output Property Name** | Save to a different binary property. |
| **File Name** | Override the output filename. |

---

## 9. Quick Start Examples

### Create a Quote Image

1. Add an **Edit Image Ultimate** node (no input image needed)
2. **Operation** → `Template`
3. **Template** → `Instagram Post (1080×1080)`
4. **Layout Type** → `Quote`
5. Enter **Quote Text** and **Quote Author**
6. Choose fonts and colours
7. *(Optional)* add a Quote **Watermark** with your handle

### Create a YouTube Thumbnail

1. Add an **Edit Image Ultimate** node
2. **Operation** → `Template`
3. **Template** → `YouTube Thumbnail (1280×720)`
4. **Layout Type** → `Standard`
5. **Title** → `My Awesome Video`, **Subtitle** → `Watch Now!`
6. Pick **Background**, **Gradient Overlay**, and **Accent** colours

### Add a Caption to a Photo (the Text operation, end to end)

1. Connect an image binary to **Edit Image Ultimate**
2. **Operation** → `Text`
3. **Text** → your caption
4. **Gravity** → `South`, **Box Anchor** → `South`, **Position Y** → `-40` (pins the box near the bottom, 40px up from the edge)
5. **Max Line Length Mode** → `Percent of Image Width`, **Max Line Length (%)** → `90`
6. **Text Decoration** → `Underline`, **Decoration Style** → `Custom`, enable **Decoration Shadow** with a small **Decoration Shadow Blur** for a soft-glow underline effect

### Add a Watermark to an Image

1. Connect an image binary to **Edit Image Ultimate**
2. **Operation** → `Watermark`
3. **Watermark Image Property** → binary property name of your logo
4. **Opacity** → `40`
5. **Gravity** → `Bottom Right`

### Multi-Step: Resize → Sharpen → Add Text

1. Add an **Edit Image Ultimate** node
2. **Operation** → `Multi Step`
3. Step 1: `Resize` → 1080×1080, fit `Cover`
4. Step 2: `Sharpen` → sigma 1.5
5. Step 3: `Text` → your caption

---

## 10. Known Limitations

These are deliberate trade-offs, not bugs:

- **Text-width measurement is estimated, not pixel-perfect.** No real font-metrics pass is available without significant added complexity. This affects line-wrapping precision, background-box auto-sizing, and decoration-line span accuracy — all three are derived from the same estimate, so they stay internally consistent even though none is exact.
- **Font Weight/Style depend on the font file actually installed on the server having that variant.** Sharp/SVG can't synthesise a bold or italic that doesn't exist in the font file.
- **The Font Family dropdown derives names from font filenames**, cleaned up — this works well for standard system fonts but may be approximate for unusual ones.

---

## 11. Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history.

**Latest (1.3.0):** Fixed a critical bug where Multi-Step mode (or any chain of Text/Composite/Watermark/Draw operations) silently discarded earlier steps instead of layering them — each subsequent step now correctly builds on top of the last. Fixed font names with a space-then-digit (e.g. "Exo 2") silently rendering as a completely different fallback font. Rewrote Text and Composite's Position X/Y into a single unified system (no more separate "Position Behavior" mode) — direction is always the same compass direction regardless of Gravity, and the reachable range is computed per-Gravity from its own anchor point, so corner and edge Gravities finally behave correctly. Template's Title, Subtitle, Quote, Top Text, and Bottom Text now each have Max/Min Line Length wrapping controls, same as the Text operation. Also fixed a crash (`.trim is not a function`) that could occur when a string-typed field received a non-string value via expression mode. See [1.2.0] in the changelog for Composite's Color/Frost overlay types and CSS border-radius shorthand, and [1.1.0] for the Font Family dropdown, Decoration Style/Shadow features, and the node icon.

---

## 12. Contributing

Pull requests are welcome — please open an issue first to discuss what you'd like to change.

```bash
git clone <your-repository-url>
cd n8n-nodes-edit-image-ultimate
npm install --legacy-peer-deps
npm run dev   # watch mode
```

---

## 13. License

[MIT](LICENSE.md)
