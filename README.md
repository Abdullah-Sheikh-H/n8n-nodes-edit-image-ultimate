# n8n-nodes-edit-image-ultimate

[![npm version](https://img.shields.io/npm/v/n8n-nodes-edit-image-ultimate.svg)](https://www.npmjs.com/package/n8n-nodes-edit-image-ultimate)
[![npm downloads](https://img.shields.io/npm/dm/n8n-nodes-edit-image-ultimate.svg)](https://www.npmjs.com/package/n8n-nodes-edit-image-ultimate)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)
[![n8n community node](https://img.shields.io/badge/n8n-community--node-orange)](https://docs.n8n.io/integrations/community-nodes/)
[![GitHub](https://img.shields.io/badge/GitHub-source-blue)](https://github.com/Abdullah-Sheikh-H/n8n-nodes-edit-image-ultimate)

> **Advanced image editing for [n8n](https://n8n.io)** — powered by **[Sharp](https://sharp.pixelplumbing.com/)** (libvips). No GraphicsMagick required. Compatible with **n8n v2.30+**.

Create stunning social media graphics, YouTube thumbnails, quote images, memes, and branded content — all directly inside your n8n workflows.

---

## ✨ Features at a Glance

- 🎨 **15+ Template Presets** — Instagram, YouTube, Twitter, LinkedIn, and more
- 🖋️ **3 Layout Modes** — Standard (Title & Subtitle), Quote, Meme
- 🔡 **Per-Field Font Selection** — Choose from 20+ fonts for every text element
- 💧 **Watermark Support** — Image watermarks with gravity, and text watermarks with X/Y position control
- ✨ **Global Text Effects** — Drop Shadow, Glow, Outline, or None
- 🎨 **Full Color Control** — Background, Gradient Overlay, Accent, and Text colors are all independent
- 📦 **20+ Image Operations** — Resize, Crop, Composite, Draw, Blur, Sharpen, and many more
- ⛓️ **Multi-Step Mode** — Chain multiple operations in a single node

### 🆕 Advanced Text Operation (Ultimate additions)

- **Positioning** — 9-point Gravity anchor (image-relative) + independent Box Anchor (which part of the text box sits on that point) + pixel X/Y offsets
- **Alignment** — Left / Center / Right / **Justify** (real per-word stretch justification, with an optional "stretch last line" mode)
- **Sizing** — Width & Height each independently Auto or Custom, in pixels or percent of image size
- **Line wrapping** — Max *and* Min line length, each in Characters, Percent, or Pixels, with orphan-line avoidance that never overflows your set bounds
- **Styling** — Opacity, full 100–900 font weight, italic/oblique style, text-decoration (underline/overline/line-through), stroke/outline, drop shadow (real Gaussian blur)
- **Background** — Solid color or genuine **frosted glass** (real backdrop blur + tint), CSS-style shorthand padding, border with percent-based radius
- **Overflow handling** — Visible / Wrap (force-break long unbroken words) / Clip
- Every option field is case-insensitive and expression-friendly

---

## 📦 Installation

### Via n8n Community Nodes (recommended)

1. Open your n8n instance
2. Go to **Settings → Community Nodes**
3. Click **Install**
4. Search for or paste: `n8n-nodes-edit-image-ultimate`
5. Click **Install**

### Via npm (self-hosted / Docker)

```bash
npm install n8n-nodes-edit-image-ultimate
```

Set the `N8N_CUSTOM_EXTENSIONS` environment variable to point to the package, or place it in your n8n user data directory under `custom/`.

> **Note for Docker users:** If you are running n8n in Docker and want custom fonts (e.g. Playfair Display, Cormorant Garamond) to render correctly, you must mount your font files into the container. Sharp uses the fonts installed on the host OS for SVG text rendering.

---

## 🎨 Template Operation

The **Template** operation is the flagship feature of this node. It generates fully composed image graphics from scratch — no source image needed.

### Layout Modes

| Layout | Description |
|---|---|
| **Standard** | Title and Subtitle text, great for blog graphics, social posts, and announcements |
| **Quote** | Large centered italic quote text with an author attribution at the bottom |
| **Meme** | Bold Impact-style text at the top and/or bottom of the image |

### Template Presets

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

### Color Controls

| Control | Description |
|---|---|
| **Background Color** | Solid fill behind everything |
| **Gradient Overlay Color** | Subtle gradient tint on top of the background (independent from accent) |
| **Accent Color** | Color of the accent bar and corner decorations |
| **Title Color** | Color of the title or quote text |
| **Subtitle Color** | Color of the subtitle or author text |

### Font Controls (Per-Field)

Every text field has its own **Font** dropdown so you can mix and match typography:
- **Title Font** / **Subtitle Font**
- **Quote Font** / **Quote Author Font**
- **Meme Top Font** / **Meme Bottom Font**
- **Watermark Font**

Available fonts include: Arial, Times New Roman, Georgia, Courier New, Verdana, Trebuchet MS, Impact, **Playfair Display**, **Cormorant Garamond**, **Lora**, **Montserrat**, **Lato**, **Courier Prime**, and more. A **Custom** option lets you type any font name installed on your server.

> **Note:** Web fonts like Playfair Display must be installed on the OS running your n8n server to render. System fonts like Arial and Georgia will always work.

### Text Effects (Global)

Choose one effect that applies to all text on the canvas:

| Effect | Controls |
|---|---|
| **Default** | Subtle drop shadow for Standard/Quote; outline stroke for Meme |
| **None** | Flat text with no effects |
| **Drop Shadow** | Color, Blur Size, Offset X/Y, Opacity |
| **Glow** | Color, Blur Size, Opacity |
| **Outline** | Color, Outline Width |

### Quote Layout: Watermark

When using the **Quote** layout, you can add a subtle text watermark (e.g. `@yourbrand`):
- **Watermark Text**, **Font**, **Color**, **Opacity (%)**
- **X Position (%)** and **Y Position (%)** for precise placement anywhere on the canvas

---

## 🛠️ All Operations

### Image Editing
| Operation | Description |
|---|---|
| **Blur** | Gaussian blur with configurable sigma |
| **Border** | Add solid-colour padding/border |
| **Composite** | Overlay an image with 24 blend modes |
| **Create** | Generate a blank canvas with a solid color |
| **Crop** | Extract a region by position and size |
| **Draw** | Rectangle, circle, or line with fill + stroke |
| **Flip** | Vertical mirror (top ↕ bottom) |
| **Flop** | Horizontal mirror (left ↔ right) |
| **Gamma** | Gamma correction (1.0–3.0) |
| **Grayscale** | Convert to black & white |
| **Normalize** | Stretch contrast to full dynamic range |
| **Resize** | 5 fit modes: cover, contain, fill, inside, outside |
| **Rotate** | Rotate by any angle with background fill |
| **Sepia** | Warm vintage tone |
| **Sharpen** | Unsharp mask with fine sigma/flat/jagged controls |
| **Shear** | Shear along X/Y via affine transform |
| **Text** | Styled text with word-wrap, shadow, alignment, line-height |
| **Tint** | Apply a colour hue overlay |
| **Transparent** | Replace a colour with alpha transparency |
| **Watermark** | Opacity-controlled image overlay with gravity positioning |
| **Get Information** | Return image metadata (size, format, DPI, …) |
| **Multi Step** | Chain any combination of operations in a single node |

---

## ✍️ Text Operation — Full Reference

The **Text** operation has by far the deepest feature set in this node. All fields below appear when **Operation** is set to **Text**.

### Positioning — four independent controls

Positioning is split into four separate concerns, matching how design tools like Figma/Photoshop handle a "reference point":

1. **Gravity** — a fixed anchor point on the *full image* (North West, North, North East, West, Center, East, South West, South, South East). E.g. Center = the exact middle of the image, regardless of text content.
2. **Position X / Position Y** — pixel offsets from that Gravity point. Positive X moves right, positive Y moves down.
3. **Box Anchor** — which point of the *text box itself* lands on the final Gravity+Position point (same 9-point options). E.g. Box Anchor = North means the box's top edge sits at that point, so the box extends downward from it — this is what lets you pin text flush to an edge without it being cut off.
4. **Text Align** — Left / Center / Right / **Justify** — controls how each line sits *within* the box (only visually matters for multi-line text where lines differ in length). This is independent of Box Anchor.

**Example:** Gravity = North, Position Y = 0, Box Anchor = North → the box's top edge sits exactly at the image's top edge, extending fully downward, nothing cut off. If Box Anchor were Center instead, the box's center would land on that same point, pushing half the box above the visible canvas.

### Justify — real per-word positioning

Justify is implemented via genuine per-word pixel positioning (each word gets its own explicit X coordinate, with gap widths calculated to make the line span the full box width) rather than relying on SVG's `textLength`/`lengthAdjust` attribute, which isn't reliably supported across SVG renderers. This guarantees consistent, visible justification.

- The **last line of every paragraph** stays at its natural width by default — stretching a short final line creates large, ugly gaps, and no real justify implementation (CSS, Word, InDesign) does it either.
- **Stretch Last Line** (toggle, shown when Text Align = Justify) forces every line, including short trailing ones, to stretch to the full width — a deliberate poster/graphic-design look rather than standard typography.
- Single-word lines are never stretched (there's nothing to distribute gaps between).

### Sizing — Width & Height, independently Auto or Custom

**Box Width Mode** and **Box Height Mode** are fully independent — mix and match, e.g. Width = Custom (60%) with Height = Auto:
- **Auto** — estimated from the actual text content and font size
- **Custom** — reveals a unit selector (**Pixels** / **Percent of Image Width or Height**) plus a size field

### Line wrapping — Max and Min Line Length

Both **Max Line Length Mode** and **Min Line Length Mode** support **Characters** / **Percent of Image Width** / **Pixels** (Min also has **Auto**, disabling the minimum entirely):

- **Percent/Pixels modes measure real estimated pixel width directly**, character-by-character, using a width table (narrow letters like `i`/`l`/`t`/`j` count less than wide letters like `m`/`w`/`M`/`W`), scaled up for bolder font weights. This is meaningfully more accurate than a flat "average character width," which under- or over-estimates depending on the specific letters in your text.
- **Characters mode** is a literal character count, unaffected by the above.
- **Min Line Length** avoids short "orphan" trailing lines (e.g. wrapping leaving a lone word like "zeta" by itself) by merging short lines into the line before them — but **Max Line Length is always a hard ceiling**: a merge only happens if it can be done *without* exceeding Max. If satisfying Min would require exceeding Max, the line is simply left shorter than the minimum — overflowing the canvas is treated as worse than an uneven line.
- **Text Overflow** (Visible / Wrap / Clip) handles the separate case of a single unbreakable word with no spaces (word-wrap can never break those on its own):
  - **Visible** (default) — long unbroken words spill past the wrap width freely
  - **Wrap** — force-breaks only genuinely unbreakable single-word lines into hard character chunks (`word-break: break-all`); legitimate multi-word lines are never shattered mid-word
  - **Clip** — hides anything extending past the text box's bounds entirely (`overflow: hidden`)

### Text styling

| Field | Details |
|---|---|
| **Text Opacity** | 0–100, maps to SVG `fill-opacity` |
| **Font Weight** | Full 100–900 range (all 9 CSS weights); click the **fx** expression icon to pass any custom number |
| **Font Style** | Normal / Italic / Oblique |
| **Text Decoration** | None / Underline / Overline / Line Through — real SVG `text-decoration`, follows the text's actual rendered width |
| **Enable Text Stroke** | → Stroke Color, Stroke Width — real vector outline via SVG `stroke`, rendered behind the fill |
| **Enable Text Shadow** | → Shadow Color, Shadow Opacity, Shadow Blur, Shadow Offset X/Y — genuine Gaussian-blurred `feDropShadow`, not a flat offset copy |

### Text Background — Solid or genuine frosted Glass

- **Enable Text Background** → **Background Style**: Solid Color or **Glass (Frosted)**
  - **Solid** — flat fill color
  - **Glass** — the image region behind the box is actually cropped, blurred, and composited back in (clipped to the box's rounded shape), with a tinted overlay on top — a real translucent glass-card effect, not a fake semi-transparent color
- **Frost** (0–100, shown when Background Style = Glass) — 0 = fully invisible (no blur, no tint), 100 = heaviest blur + fully opaque tint. Controls both the tint opacity and backdrop blur intensity together.
- **Background Padding** — CSS-style shorthand, e.g. `"12"` (all sides), `"10 20"` (top/bottom, then left/right — real CSS order, not x/y), `"10 20 30"`, or `"10 20 30 40"` (top, right, bottom, left)
- **Enable Background Border** → Border Color, Border Width
- **Border Radius Unit**: Pixels or **Percent** (relative to the box's own size — 0% = sharp corners, 100% = fully pill-shaped) → **Border Radius**

### Case-insensitivity

Every dropdown/options field on this node is case-insensitive when set via expression — `"Center"`, `"CENTER"`, and `"center"` all behave identically (Gravity, Box Anchor, Font Style, Text Decoration, Background Style, and every other options field), with whitespace automatically trimmed too.

---

## 📤 Output Options

All operations support the following output settings:

| Option | Description |
|---|---|
| **Format** | Defaults to **"Same as Input"** — detects and keeps the original image's format (e.g. JPEG stays JPEG) instead of silently converting everything to lossless PNG, which can inflate a detailed photo 10–20x in size. Explicitly set `png` / `jpeg` / `webp` / `avif` / `tiff` / `gif` if you need to override. |
| **Quality** | 1–100 for jpeg / webp / avif (only shown when Format is explicitly set to one of these) |
| **PNG Compression** | 0 (fastest) to 9 (smallest), only relevant if Format is explicitly `png` |
| **Output Property Name** | Save to a different binary property |
| **File Name** | Override the output filename |

---

## 🚀 Quick Start Examples

### Create a Quote Image

1. Add an **Edit Image+** node (no input needed)
2. Set **Operation** → `Template`
3. Choose **Template** → `Instagram Post (1080x1080)`
4. Set **Layout Type** → `Quote`
5. Enter your **Quote Text** and **Quote Author**
6. Choose your fonts and colors
7. (Optional) Add a **Watermark** with your handle

### Create a YouTube Thumbnail

1. Add an **Edit Image+** node
2. Set **Operation** → `Template`
3. Choose **Template** → `YouTube Thumbnail (1280x720)`
4. Set **Layout Type** → `Standard`
5. Set **Title** → `My Awesome Video`
6. Set **Subtitle** → `Watch Now!`
7. Pick your **Background**, **Gradient Overlay**, and **Accent** colors

### Add a Watermark to an Image

1. Connect an image binary to **Edit Image+**
2. Set **Operation** → `Watermark`
3. Set **Watermark Image Property** → binary property name of your logo
4. Set **Opacity** → `40`
5. Set **Gravity** → `Bottom Right`

### Multi-Step: Resize → Sharpen → Add Text

1. Add **Edit Image+** node
2. Set **Operation** → `Multi Step`
3. Add Step 1: `Resize` → 1080×1080, fit `Cover`
4. Add Step 2: `Sharpen` → sigma 1.5
5. Add Step 3: `Text` → your caption

---

## ⚙️ Requirements

- **n8n** v2.30.0 or later
- **Node.js** v18 or later
- No extra system dependencies — Sharp ships with pre-built native binaries for Windows, Linux, and macOS

---

## 📋 Changelog

### v0.2.8
- Added **Global Text Effects**: Drop Shadow, Glow, Outline, and None — fully configurable with color, opacity, blur, offset, and width controls
- Separated **Gradient Overlay Color** from **Accent Color** for independent control

### v0.2.7
- Gradient overlay color is now independent from the accent color

### v0.2.6
- Fixed SVG XML parse error caused by font names with double quotes (e.g. `"Cormorant Garamond"`)

### v0.2.5
- Fixed accent bar positioning in the Quote layout — it now sits correctly above the dynamic multi-line quote
- Accent bar hidden for Meme layout

### v0.2.4
- Fixed watermark and font settings not being applied (missing parameters in the single-op collector)

### v0.2.3
- Added **per-field font selection** for all 6 text fields (Title, Subtitle, Quote, Author, Meme Top, Meme Bottom)
- Added **Quote Watermark** with text, font, color, opacity, and X/Y position controls
- All fonts use single-quoted SVG attributes to prevent XML parse errors

### v0.2.2
- Fixed accent bar overlapping quote text in Quote layout
- Made accent bar positioning dynamic based on layout and text height

### v0.2.1
- Added **Quote layout** and **Meme layout** to the Template operation
- Added dropdown for layout type selection

### v0.2.0
- Full rewrite using **Sharp (libvips)** — no GraphicsMagick required
- Fixed n8n v2 API compatibility
- Added 10 new operations: Template, Flip, Flop, Grayscale, Sepia, Tint, Sharpen, Normalize, Gamma, Watermark
- 15+ template presets (Instagram, YouTube, LinkedIn, etc.)
- Improved Text: font-weight, italic, alignment, drop shadow, line-height
- Improved Draw: stroke colour + width, correct ellipse
- Improved Resize: 5 smart fit modes
- Added AVIF output format

### v0.1.x
- Original release — GraphicsMagick based (no longer maintained)

---

## 🤝 Contributing

Pull requests are welcome! Please open an issue first to discuss what you'd like to change.

```bash
git clone https://github.com/Abdullah-Sheikh-H/n8n-nodes-edit-image-ultimate.git
cd n8n-nodes-edit-image-ultimate
npm install --legacy-peer-deps
npm run dev   # watch mode
```

---

## 📄 License

[MIT](LICENSE.md)
