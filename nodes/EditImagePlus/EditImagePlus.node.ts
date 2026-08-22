import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError, deepCopy } from 'n8n-workflow';
import sharp from 'sharp';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Approximate per-character width ratios (as a fraction of font size / em),
 * based on typical sans-serif (Arial/Helvetica-like) metrics. A flat average
 * character width badly misjudges text with an unusual mix of narrow/wide
 * letters — e.g. "listening" is packed with narrow characters (i, l, t, n)
 * and measures meaningfully narrower than a flat average would suggest,
 * causing premature wrapping. This table lets width estimates reflect the
 * ACTUAL characters in the text, not just its length.
 */
const CHAR_WIDTH_RATIOS: Record<string, number> = {
	i: 0.28, j: 0.28, l: 0.28, I: 0.28, "'": 0.22, '.': 0.26, ',': 0.26,
	':': 0.26, ';': 0.26, '!': 0.28, '|': 0.22, '`': 0.22, '"': 0.36,
	f: 0.34, t: 0.34, r: 0.36, '(': 0.32, ')': 0.32, '[': 0.3, ']': 0.3,
	'{': 0.32, '}': 0.32, ' ': 0.28, '-': 0.34,
	m: 0.87, w: 0.8, M: 0.9, W: 0.92,
};
const UPPERCASE_DEFAULT_RATIO = 0.66;
const LOWERCASE_DEFAULT_RATIO = 0.54;
const DIGIT_DEFAULT_RATIO = 0.56;
const FALLBACK_DEFAULT_RATIO = 0.55; // used for accented/non-Latin characters too

function charWidthRatio(ch: string): number {
	if (ch in CHAR_WIDTH_RATIOS) return CHAR_WIDTH_RATIOS[ch];
	if (ch >= '0' && ch <= '9') return DIGIT_DEFAULT_RATIO;
	if (ch >= 'A' && ch <= 'Z') return UPPERCASE_DEFAULT_RATIO;
	if (ch >= 'a' && ch <= 'z') return LOWERCASE_DEFAULT_RATIO;
	return FALLBACK_DEFAULT_RATIO;
}

/**
 * Estimates the real rendered pixel width of a string by summing per-character
 * width ratios, scaled by font size and a bold-weight multiplier. Far more
 * accurate than `text.length * averageCharWidth` for real-world text, since
 * it reflects which specific characters are present, not just how many.
 */
function estimateTextWidth(text: string, fontSize: number, boldMultiplier: number): number {
	let total = 0;
	for (const ch of text) {
		total += charWidthRatio(ch);
	}
	return total * fontSize * boldMultiplier;
}

/**
 * Wraps text to a maximum PIXEL width (not a character count), measuring each
 * candidate line with a real per-character width estimate. This is the direct,
 * accurate approach for Percent/Pixels line-length modes — no lossy round trip
 * through an average-character-width-derived character count.
 */
function wrapTextByWidth(text: string, maxWidthPx: number, measure: (s: string) => number): string {
	const lines: string[] = [];
	for (const paragraph of text.split('\n')) {
		let current = '';
		for (const word of paragraph.split(' ')) {
			const tentative = current.length === 0 ? word : current + ' ' + word;
			if (current.length > 0 && measure(tentative) > maxWidthPx) {
				lines.push(current);
				current = word;
			} else {
				current = tentative;
			}
		}
		lines.push(current);
	}
	return lines.join('\n');
}

/**
 * Pixel-width version of wrapTextWithMin — same min/max balancing logic
 * (avoid short orphan lines, hard-capped overshoot protection), but measuring
 * real pixel width per candidate line instead of character count.
 */
function wrapTextByWidthWithMin(
	text: string,
	maxWidthPx: number,
	minWidthPx: number,
	measure: (s: string) => number,
): string {
	const safeMin = Math.min(minWidthPx, Math.max(1, maxWidthPx - 1));
	// Never allow a merge to exceed the true max width — overflow past the
	// canvas edge is a worse visual outcome than a line that's shorter than
	// the requested minimum. Min Line Length is best-effort: it merges short
	// orphan lines whenever it can do so WITHOUT exceeding Max, but if a
	// short line genuinely can't be merged without going over, it's left as
	// a shorter-than-minimum line rather than overflowing.
	const hardCap = maxWidthPx;

	const outParagraphs: string[] = [];
	for (const paragraph of text.split('\n')) {
		// Step 1: plain greedy max-based wrap — no min-forcing yet. A forward-only
		// "force the next word on if we're under the minimum" approach can't see
		// past the immediate next word, so it can still strand a short word right
		// after the one it just force-added (exactly the "the" / "end." case).
		// A backward merge pass after the fact handles this correctly instead.
		const rawLines = wrapTextByWidth(paragraph, maxWidthPx, measure).split('\n');

		// Step 2: repeatedly merge any line under the minimum into the line
		// before it, as long as the combined width stays within the hard cap.
		const lines = rawLines.slice();
		let mergedSomething = true;
		while (mergedSomething) {
			mergedSomething = false;
			for (let i = lines.length - 1; i > 0; i--) {
				if (measure(lines[i]) < safeMin) {
					const combined = lines[i - 1] + ' ' + lines[i];
					if (measure(combined) <= hardCap) {
						lines[i - 1] = combined;
						lines.splice(i, 1);
						mergedSomething = true;
						break; // indices shifted — restart the scan
					}
				}
			}
		}
		outParagraphs.push(lines.join('\n'));
	}
	return outParagraphs.join('\n');
}

/**
 * Pixel-width version of forceBreakLongLines — hard-breaks a single long
 * unbreakable token (no spaces) at the character position where its
 * cumulative estimated width would exceed maxWidthPx.
 */
/**
 * Hard-breaks a line by real pixel width, but ONLY if it's a single unbreakable
 * token with no spaces in it (e.g. "Baqarah(12ioioio14)ewewe"). Multi-word
 * lines that happen to exceed maxWidthPx are left alone — that can legitimately
 * happen from Min Line Length's bounded overshoot, and shattering those
 * mid-word would undo that merging entirely.
 */
function forceBreakLongLinesByWidth(text: string, maxWidthPx: number, measure: (s: string) => number): string {
	const outLines: string[] = [];
	for (const line of text.split('\n')) {
		if (measure(line) <= maxWidthPx || line.includes(' ')) {
			outLines.push(line);
			continue;
		}
		let chunk = '';
		for (const ch of line) {
			const tentative = chunk + ch;
			if (chunk.length > 0 && measure(tentative) > maxWidthPx) {
				outLines.push(chunk);
				chunk = ch;
			} else {
				chunk = tentative;
			}
		}
		if (chunk.length > 0) outLines.push(chunk);
	}
	return outLines.join('\n');
}

/**
 * Normalizes an options-field string for case-insensitive comparison — trims
 * whitespace and lowercases. Used everywhere an option value (from the UI
 * dropdown or a raw expression string) is compared against a known set of
 * values, so "Center", "CENTER", "center" etc. all behave identically.
 */
function ci(value: unknown, fallback = ''): string {
	if (typeof value !== 'string') return fallback;
	const trimmed = value.trim().toLowerCase();
	return trimmed.length > 0 ? trimmed : fallback;
}

/**
 * Character-count version of forceBreakLongLinesByWidth — same single-token
 * guard, so Min Line Length's legitimate multi-word overshoot lines aren't
 * shattered mid-word by this.
 */
function forceBreakLongLines(text: string, maxLen: number): string {
	const outLines: string[] = [];
	for (const line of text.split('\n')) {
		if (line.length <= maxLen || line.includes(' ')) {
			outLines.push(line);
			continue;
		}
		let remaining = line;
		while (remaining.length > maxLen) {
			outLines.push(remaining.slice(0, maxLen));
			remaining = remaining.slice(maxLen);
		}
		outLines.push(remaining);
	}
	return outLines.join('\n');
}

/**
 * Parses a CSS-style padding shorthand string into individual top/right/bottom/left
 * values, following the exact same rules as CSS `padding`:
 *   "10"             -> all four sides = 10
 *   "10 20"          -> top/bottom = 10, left/right = 20
 *   "10 20 30"       -> top = 10, left/right = 20, bottom = 30
 *   "10 20 30 40"    -> top = 10, right = 20, bottom = 30, left = 40 (clockwise from top)
 */
function parsePadding(input: string): { top: number; right: number; bottom: number; left: number } {
	const parts = (input ?? '')
		.trim()
		.split(/\s+/)
		.map(Number)
		.filter((n) => !isNaN(n));

	if (parts.length === 0) return { top: 12, right: 12, bottom: 12, left: 12 };
	if (parts.length === 1) return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
	if (parts.length === 2) return { top: parts[0], bottom: parts[0], right: parts[1], left: parts[1] };
	if (parts.length === 3) return { top: parts[0], right: parts[1], left: parts[1], bottom: parts[2] };
	return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
}

/**
 * Converts a CSS-style hex colour (#RRGGBB or #RRGGBBAA) to a sharp RGBA object.
 */
function hexToRgba(hex: string): { r: number; g: number; b: number; alpha: number } {
	const clean = hex.replace('#', '');
	const r = parseInt(clean.substring(0, 2), 16) || 0;
	const g = parseInt(clean.substring(2, 4), 16) || 0;
	const b = parseInt(clean.substring(4, 6), 16) || 0;
	const alpha = clean.length === 8 ? (parseInt(clean.substring(6, 8), 16) || 255) / 255 : 1;
	return { r, g, b, alpha };
}

/**
 * Word-wraps text to a maximum number of characters per line.
 */
function wrapText(text: string, maxLineLength: number): string {
	const lines: string[] = [];
	for (const paragraph of text.split('\n')) {
		let current = '';
		for (const word of paragraph.split(' ')) {
			if (current.length + word.length + 1 > maxLineLength && current.length > 0) {
				lines.push(current.trimEnd());
				current = word + ' ';
			} else {
				current += word + ' ';
			}
		}
		lines.push(current.trimEnd());
	}
	return lines.join('\n');
}

/**
 * Like wrapText, but also enforces a minimum line length to avoid short
 * "orphan" lines. A line is only allowed to break once it has reached
 * minLineLength — if it hasn't, the next word is added even if that pushes
 * the line past maxLineLength (a modest, deliberate overflow is preferred
 * over an oddly-short line). If minLineLength >= maxLineLength, it's clamped
 * down to maxLineLength - 1 to guarantee the wrapper still makes progress.
 */
function wrapTextWithMin(text: string, maxLineLength: number, minLineLength: number): string {
	// Only basic sanity: min must be strictly less than max, or the algorithm
	// can never break at all. Otherwise your exact minLineLength is respected —
	// no silent overriding.
	const safeMin = Math.min(minLineLength, Math.max(1, maxLineLength - 1));
	// Never allow a merge to exceed the true max length — overflow past the
	// canvas is worse than a line shorter than requested. Min is best-effort.
	const hardCap = maxLineLength;

	const outParagraphs: string[] = [];
	for (const paragraph of text.split('\n')) {
		// Plain greedy max-based wrap first — a forward-only "force this word on
		// if under the minimum" pass can't see past the immediate next word, so
		// it can still strand a short word right after one it just force-added.
		// A backward merge pass afterward handles this correctly instead.
		const rawLines = wrapText(paragraph, maxLineLength).split('\n');
		const lines = rawLines.slice();
		let mergedSomething = true;
		while (mergedSomething) {
			mergedSomething = false;
			for (let i = lines.length - 1; i > 0; i--) {
				if (lines[i].length < safeMin) {
					const combined = lines[i - 1] + ' ' + lines[i];
					if (combined.length <= hardCap) {
						lines[i - 1] = combined;
						lines.splice(i, 1);
						mergedSomething = true;
						break;
					}
				}
			}
		}
		outParagraphs.push(lines.join('\n'));
	}
	return outParagraphs.join('\n');
}

/**
 * Escapes characters that would break inline SVG.
 */
function escapeSvg(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

// ---------------------------------------------------------------------------
// Templates definition
// ---------------------------------------------------------------------------

interface ImageTemplate {
	name: string;
	width: number;
	height: number;
	description: string;
}

const IMAGE_TEMPLATES: ImageTemplate[] = [
	{ name: 'Instagram Post (1:1)', width: 1080, height: 1080, description: 'Instagram square post' },
	{ name: 'Instagram Story (9:16)', width: 1080, height: 1920, description: 'Instagram/TikTok story' },
	{ name: 'Instagram Portrait (4:5)', width: 1080, height: 1350, description: 'Instagram portrait' },
	{ name: 'Twitter/X Post (16:9)', width: 1200, height: 675, description: 'Twitter card image' },
	{ name: 'YouTube Thumbnail', width: 1280, height: 720, description: 'YouTube video thumbnail' },
	{ name: 'Facebook Post', width: 1200, height: 630, description: 'Facebook link preview' },
	{ name: 'LinkedIn Banner', width: 1584, height: 396, description: 'LinkedIn profile banner' },
	{ name: 'LinkedIn Post', width: 1200, height: 627, description: 'LinkedIn post image' },
	{ name: 'Pinterest Pin', width: 1000, height: 1500, description: 'Pinterest tall pin' },
	{ name: 'Open Graph (OG)', width: 1200, height: 630, description: 'General Open Graph image' },
	{ name: 'Email Header', width: 600, height: 200, description: 'Email header banner' },
	{ name: 'Presentation Slide (16:9)', width: 1920, height: 1080, description: 'Full-HD slide' },
	{ name: 'Business Card', width: 1050, height: 600, description: 'Standard business card' },
	{ name: 'A4 Document', width: 2480, height: 3508, description: 'A4 at 300 DPI' },
	{ name: 'Custom', width: 800, height: 600, description: 'Enter your own dimensions' },
];

// ---------------------------------------------------------------------------
// Operations options list
// ---------------------------------------------------------------------------

const nodeOperations: INodePropertyOptions[] = [
	{ name: 'Blur', value: 'blur', description: 'Apply Gaussian blur to the image', action: 'Blur image' },
	{ name: 'Border', value: 'border', description: 'Add a solid-colour border', action: 'Add border' },
	{ name: 'Composite', value: 'composite', description: 'Overlay one image on top of another', action: 'Composite image' },
	{ name: 'Create', value: 'create', description: 'Generate a blank canvas', action: 'Create image' },
	{ name: 'Crop', value: 'crop', description: 'Extract a region from the image', action: 'Crop image' },
	{ name: 'Draw', value: 'draw', description: 'Draw shapes (rectangle, circle, line)', action: 'Draw on image' },
	{ name: 'Flip', value: 'flip', description: 'Flip the image vertically (top ↔ bottom)', action: 'Flip image' },
	{ name: 'Flop', value: 'flop', description: 'Flop the image horizontally (left ↔ right)', action: 'Flop image' },
	{ name: 'Gamma', value: 'gamma', description: 'Apply gamma correction', action: 'Apply gamma' },
	{ name: 'Grayscale', value: 'grayscale', description: 'Convert image to grayscale', action: 'Convert to grayscale' },
	{ name: 'Normalize', value: 'normalize', description: 'Stretch contrast to full dynamic range', action: 'Normalize image' },
	{ name: 'Rotate', value: 'rotate', description: 'Rotate the image by an angle', action: 'Rotate image' },
	{ name: 'Resize', value: 'resize', description: 'Change image dimensions', action: 'Resize image' },
	{ name: 'Sepia', value: 'sepia', description: 'Apply a warm sepia tone', action: 'Apply sepia tone' },
	{ name: 'Sharpen', value: 'sharpen', description: 'Increase image sharpness', action: 'Sharpen image' },
	{ name: 'Shear', value: 'shear', description: 'Shear the image along X or Y axis', action: 'Shear image' },
	{ name: 'Template', value: 'template', description: 'Create from a preset canvas template', action: 'Create from template' },
	{ name: 'Text', value: 'text', description: 'Render text onto the image', action: 'Add text' },
	{ name: 'Tint', value: 'tint', description: 'Apply a colour tint', action: 'Tint image' },
	{ name: 'Transparent', value: 'transparent', description: 'Make the image background transparent (PNG)', action: 'Make transparent' },
	{ name: 'Watermark', value: 'watermark', description: 'Overlay a watermark image with configurable opacity', action: 'Add watermark' },
];

// ---------------------------------------------------------------------------
// Per-operation parameter definitions
// ---------------------------------------------------------------------------

const templateFontOptions = [
	{ name: 'Arial (Sans-Serif)', value: 'Arial, sans-serif' },
	{ name: 'Cormorant Garamond (Serif)', value: '"Cormorant Garamond", serif' },
	{ name: 'Courier New (Monospace)', value: '"Courier New", monospace' },
	{ name: 'Courier Prime (Monospace)', value: '"Courier Prime", monospace' },
	{ name: 'Georgia (Serif)', value: 'Georgia, serif' },
	{ name: 'Impact (Sans-Serif)', value: 'Impact, sans-serif' },
	{ name: 'Lato (Sans-Serif)', value: 'Lato, sans-serif' },
	{ name: 'Lora (Serif)', value: 'Lora, serif' },
	{ name: 'Montserrat (Sans-Serif)', value: 'Montserrat, sans-serif' },
	{ name: 'Playfair Display (Serif)', value: '"Playfair Display", serif' },
	{ name: 'Times New Roman (Serif)', value: '"Times New Roman", serif' },
	{ name: 'Custom (Type below)', value: 'custom' },
];

const nodeOperationOptions: INodeProperties[] = [
	// ────────────────────────────────────────────────────────────────────────
	// create
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Background Color',
		name: 'backgroundColor',
		type: 'color',
		default: '#ffffff',
		typeOptions: { showAlpha: true },
		displayOptions: { show: { operation: ['create'] } },
		description: 'Background colour of the new image',
	},
	{
		displayName: 'Image Width',
		name: 'width',
		type: 'number',
		default: 1080,
		typeOptions: { minValue: 1 },
		displayOptions: { show: { operation: ['create'] } },
		description: 'Width of the new image in pixels',
	},
	{
		displayName: 'Image Height',
		name: 'height',
		type: 'number',
		default: 1080,
		typeOptions: { minValue: 1 },
		displayOptions: { show: { operation: ['create'] } },
		description: 'Height of the new image in pixels',
	},

	// ────────────────────────────────────────────────────────────────────────
	// template
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Template',
		name: 'templateName',
		type: 'options',
		default: 'Instagram Post (1:1)',
		displayOptions: { show: { operation: ['template'] } },
		options: IMAGE_TEMPLATES.map((t) => ({
			name: `${t.name} (${t.width}×${t.height})`,
			value: t.name,
			description: t.description,
		})),
		description: 'Choose a preset canvas size',
	},
	{
		displayName: 'Custom Width',
		name: 'customWidth',
		type: 'number',
		default: 800,
		typeOptions: { minValue: 1 },
		displayOptions: { show: { operation: ['template'], templateName: ['Custom'] } },
		description: 'Custom canvas width in pixels',
	},
	{
		displayName: 'Custom Height',
		name: 'customHeight',
		type: 'number',
		default: 600,
		typeOptions: { minValue: 1 },
		displayOptions: { show: { operation: ['template'], templateName: ['Custom'] } },
		description: 'Custom canvas height in pixels',
	},
	{
		displayName: 'Background Color',
		name: 'templateBgColor',
		type: 'color',
		default: '#1a1a2e',
		typeOptions: { showAlpha: false },
		displayOptions: { show: { operation: ['template'] } },
		description: 'Background fill colour for the template canvas',
	},
	{
		displayName: 'Gradient Overlay Color',
		name: 'templateGradientColor',
		type: 'color',
		default: '#e94560',
		typeOptions: { showAlpha: false },
		displayOptions: { show: { operation: ['template'] } },
		description: 'Color of the subtle gradient overlay on the background',
	},
	{
		displayName: 'Layout Type',
		name: 'templateLayout',
		type: 'options',
		options: [
			{ name: 'Standard (Title & Subtitle)', value: 'standard' },
			{ name: 'Quote', value: 'quote' },
			{ name: 'Meme (Top & Bottom Text)', value: 'meme' },
		],
		default: 'standard',
		displayOptions: { show: { operation: ['template'] } },
		description: 'The layout of the text on the canvas',
	},
	{
		displayName: 'Title Text',
		name: 'templateTitle',
		type: 'string',
		default: '',
		placeholder: 'e.g. My Brand',
		displayOptions: { show: { operation: ['template'], templateLayout: ['standard'] } },
		description: 'Primary headline text (leave blank to skip)',
	},
	{
		displayName: 'Title Font',
		name: 'templateTitleFont',
		type: 'options',
		options: templateFontOptions,
		default: 'Arial, sans-serif',
		displayOptions: { show: { operation: ['template'], templateLayout: ['standard'] } },
		description: 'Font family for the title (Note: Custom fonts must be installed on your n8n OS)',
	},
	{
		displayName: 'Title Font (Custom)',
		name: 'templateTitleFontCustom',
		type: 'string',
		default: '',
		displayOptions: { show: { operation: ['template'], templateLayout: ['standard'], templateTitleFont: ['custom'] } },
		description: 'Type the exact font-family name (e.g. "Playfair Display", serif)',
	},
	{
		displayName: 'Title Color',
		name: 'templateTitleColor',
		type: 'color',
		default: '#ffffff',
		displayOptions: { show: { operation: ['template'], templateLayout: ['standard', 'quote', 'meme'] } },
		description: 'Primary text colour',
	},
	{
		displayName: 'Subtitle Text',
		name: 'templateSubtitle',
		type: 'string',
		default: '',
		placeholder: 'e.g. Your tagline here',
		displayOptions: { show: { operation: ['template'], templateLayout: ['standard'] } },
		description: 'Secondary subtitle text (leave blank to skip)',
	},
	{
		displayName: 'Subtitle Font',
		name: 'templateSubtitleFont',
		type: 'options',
		options: templateFontOptions,
		default: 'Arial, sans-serif',
		displayOptions: { show: { operation: ['template'], templateLayout: ['standard'] } },
		description: 'Font family for the subtitle',
	},
	{
		displayName: 'Subtitle Font (Custom)',
		name: 'templateSubtitleFontCustom',
		type: 'string',
		default: '',
		displayOptions: { show: { operation: ['template'], templateLayout: ['standard'], templateSubtitleFont: ['custom'] } },
		description: 'Type the exact font-family name (e.g. "Playfair Display", serif)',
	},
	{
		displayName: 'Subtitle Color',
		name: 'templateSubtitleColor',
		type: 'color',
		default: '#cccccc',
		displayOptions: { show: { operation: ['template'], templateLayout: ['standard', 'quote'] } },
		description: 'Secondary text colour',
	},
	{
		displayName: 'Quote Text',
		name: 'templateQuote',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		placeholder: 'e.g. "To be or not to be..."',
		displayOptions: { show: { operation: ['template'], templateLayout: ['quote'] } },
		description: 'A centered quote to display on the template. Wraps automatically.',
	},
	{
		displayName: 'Quote Font',
		name: 'templateQuoteFont',
		type: 'options',
		options: templateFontOptions,
		default: 'Georgia, serif',
		displayOptions: { show: { operation: ['template'], templateLayout: ['quote'] } },
		description: 'Font family for the quote',
	},
	{
		displayName: 'Quote Font (Custom)',
		name: 'templateQuoteFontCustom',
		type: 'string',
		default: '',
		displayOptions: { show: { operation: ['template'], templateLayout: ['quote'], templateQuoteFont: ['custom'] } },
		description: 'Type the exact font-family name',
	},
	{
		displayName: 'Quote Author',
		name: 'templateQuoteAuthor',
		type: 'string',
		default: '',
		placeholder: 'e.g. William Shakespeare',
		displayOptions: { show: { operation: ['template'], templateLayout: ['quote'] } },
		description: 'The author of the quote, displayed centered at the bottom',
	},
	{
		displayName: 'Quote Author Font',
		name: 'templateQuoteAuthorFont',
		type: 'options',
		options: templateFontOptions,
		default: 'Arial, sans-serif',
		displayOptions: { show: { operation: ['template'], templateLayout: ['quote'] } },
		description: 'Font family for the author',
	},
	{
		displayName: 'Quote Author Font (Custom)',
		name: 'templateQuoteAuthorFontCustom',
		type: 'string',
		default: '',
		displayOptions: { show: { operation: ['template'], templateLayout: ['quote'], templateQuoteAuthorFont: ['custom'] } },
		description: 'Type the exact font-family name',
	},
	{
		displayName: 'Top Text',
		name: 'templateMemeTop',
		type: 'string',
		default: '',
		placeholder: 'e.g. WHEN YOU REALIZE...',
		displayOptions: { show: { operation: ['template'], templateLayout: ['meme'] } },
		description: 'Text displayed at the top of the meme',
	},
	{
		displayName: 'Top Text Font',
		name: 'templateMemeTopFont',
		type: 'options',
		options: templateFontOptions,
		default: 'Impact, sans-serif',
		displayOptions: { show: { operation: ['template'], templateLayout: ['meme'] } },
		description: 'Font family for the top text',
	},
	{
		displayName: 'Top Text Font (Custom)',
		name: 'templateMemeTopFontCustom',
		type: 'string',
		default: '',
		displayOptions: { show: { operation: ['template'], templateLayout: ['meme'], templateMemeTopFont: ['custom'] } },
		description: 'Type the exact font-family name',
	},
	{
		displayName: 'Bottom Text',
		name: 'templateMemeBottom',
		type: 'string',
		default: '',
		placeholder: 'e.g. ITS FRIDAY',
		displayOptions: { show: { operation: ['template'], templateLayout: ['meme'] } },
		description: 'Text displayed at the bottom of the meme',
	},
	{
		displayName: 'Bottom Text Font',
		name: 'templateMemeBottomFont',
		type: 'options',
		options: templateFontOptions,
		default: 'Impact, sans-serif',
		displayOptions: { show: { operation: ['template'], templateLayout: ['meme'] } },
		description: 'Font family for the bottom text',
	},
	{
		displayName: 'Bottom Text Font (Custom)',
		name: 'templateMemeBottomFontCustom',
		type: 'string',
		default: '',
		displayOptions: { show: { operation: ['template'], templateLayout: ['meme'], templateMemeBottomFont: ['custom'] } },
		description: 'Type the exact font-family name',
	},
	{
		displayName: 'Accent Color',
		name: 'templateAccentColor',
		type: 'color',
		default: '#e94560',
		displayOptions: { show: { operation: ['template'] } },
		description: 'Accent bar / decorative element colour',
	},

	// -- Global Text Effects --
	{
		displayName: 'Global Text Effect',
		name: 'templateTextEffect',
		type: 'options',
		options: [
			{ name: 'Default (Subtle Shadow for Standard, Outline for Meme)', value: 'default' },
			{ name: 'None', value: 'none' },
			{ name: 'Drop Shadow', value: 'shadow' },
			{ name: 'Glow', value: 'glow' },
			{ name: 'Outline', value: 'outline' },
		],
		default: 'default',
		displayOptions: { show: { operation: ['template'] } },
		description: 'Apply an effect to all main text elements on the canvas',
	},
	{
		displayName: 'Effect Color',
		name: 'templateEffectColor',
		type: 'color',
		default: '#000000',
		displayOptions: { show: { operation: ['template'], templateTextEffect: ['shadow', 'glow', 'outline'] } },
	},
	{
		displayName: 'Effect Opacity (%)',
		name: 'templateEffectOpacity',
		type: 'number',
		typeOptions: { minValue: 0, maxValue: 100 },
		default: 50,
		displayOptions: { show: { operation: ['template'], templateTextEffect: ['shadow', 'glow'] } },
	},
	{
		displayName: 'Shadow/Glow Blur Size',
		name: 'templateEffectBlur',
		type: 'number',
		default: 4,
		displayOptions: { show: { operation: ['template'], templateTextEffect: ['shadow', 'glow'] } },
	},
	{
		displayName: 'Shadow Offset X',
		name: 'templateEffectOffsetX',
		type: 'number',
		default: 2,
		displayOptions: { show: { operation: ['template'], templateTextEffect: ['shadow'] } },
	},
	{
		displayName: 'Shadow Offset Y',
		name: 'templateEffectOffsetY',
		type: 'number',
		default: 2,
		displayOptions: { show: { operation: ['template'], templateTextEffect: ['shadow'] } },
	},
	{
		displayName: 'Outline Width',
		name: 'templateEffectOutlineWidth',
		type: 'number',
		default: 2,
		displayOptions: { show: { operation: ['template'], templateTextEffect: ['outline'] } },
	},

	// -- Watermark (Quote Layout) --
	{
		displayName: 'Watermark Text',
		name: 'quoteWatermarkText',
		type: 'string',
		default: '',
		placeholder: 'e.g. @yourhandle',
		displayOptions: { show: { operation: ['template'], templateLayout: ['quote'] } },
		description: 'Optional watermark text (leave blank to skip)',
	},
	{
		displayName: 'Watermark Font',
		name: 'quoteWatermarkFont',
		type: 'options',
		options: templateFontOptions,
		default: 'Arial, sans-serif',
		displayOptions: { show: { operation: ['template'], templateLayout: ['quote'] } },
		description: 'Font family for the watermark',
	},
	{
		displayName: 'Watermark Font (Custom)',
		name: 'quoteWatermarkFontCustom',
		type: 'string',
		default: '',
		displayOptions: { show: { operation: ['template'], templateLayout: ['quote'], quoteWatermarkFont: ['custom'] } },
		description: 'Type the exact font-family name',
	},
	{
		displayName: 'Watermark Color',
		name: 'quoteWatermarkColor',
		type: 'color',
		default: '#ffffff',
		displayOptions: { show: { operation: ['template'], templateLayout: ['quote'] } },
	},
	{
		displayName: 'Watermark Opacity (%)',
		name: 'quoteWatermarkOpacity',
		type: 'number',
		typeOptions: { minValue: 0, maxValue: 100 },
		default: 30,
		displayOptions: { show: { operation: ['template'], templateLayout: ['quote'] } },
	},
	{
		displayName: 'Watermark X Position (%)',
		name: 'quoteWatermarkX',
		type: 'number',
		typeOptions: { minValue: 0, maxValue: 100 },
		default: 50,
		displayOptions: { show: { operation: ['template'], templateLayout: ['quote'] } },
		description: 'Horizontal position from 0 (left) to 100 (right)',
	},
	{
		displayName: 'Watermark Y Position (%)',
		name: 'quoteWatermarkY',
		type: 'number',
		typeOptions: { minValue: 0, maxValue: 100 },
		default: 95,
		displayOptions: { show: { operation: ['template'], templateLayout: ['quote'] } },
		description: 'Vertical position from 0 (top) to 100 (bottom)',
	},

	// ────────────────────────────────────────────────────────────────────────
	// draw
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Primitive',
		name: 'primitive',
		type: 'options',
		displayOptions: { show: { operation: ['draw'] } },
		options: [
			{ name: 'Circle', value: 'circle' },
			{ name: 'Line', value: 'line' },
			{ name: 'Rectangle', value: 'rectangle' },
		],
		default: 'rectangle',
		description: 'Shape to draw',
	},
	{
		displayName: 'Color',
		name: 'color',
		type: 'color',
		default: '#ff0000',
		typeOptions: { showAlpha: true },
		displayOptions: { show: { operation: ['draw'] } },
		description: 'Fill colour of the shape',
	},
	{
		displayName: 'Stroke Color',
		name: 'strokeColor',
		type: 'color',
		default: '#000000',
		typeOptions: { showAlpha: true },
		displayOptions: { show: { operation: ['draw'] } },
		description: 'Outline stroke colour (set alpha to 0 for no stroke)',
	},
	{
		displayName: 'Stroke Width',
		name: 'strokeWidth',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0 },
		displayOptions: { show: { operation: ['draw'] } },
		description: 'Width of the stroke outline in pixels (0 = no stroke)',
	},
	{
		displayName: 'Start Position X',
		name: 'startPositionX',
		type: 'number',
		default: 50,
		displayOptions: { show: { operation: ['draw'], primitive: ['circle', 'line', 'rectangle'] } },
		description: 'X start position of the shape',
	},
	{
		displayName: 'Start Position Y',
		name: 'startPositionY',
		type: 'number',
		default: 50,
		displayOptions: { show: { operation: ['draw'], primitive: ['circle', 'line', 'rectangle'] } },
		description: 'Y start position of the shape',
	},
	{
		displayName: 'End Position X',
		name: 'endPositionX',
		type: 'number',
		default: 250,
		displayOptions: { show: { operation: ['draw'], primitive: ['circle', 'line', 'rectangle'] } },
		description: 'X end position of the shape',
	},
	{
		displayName: 'End Position Y',
		name: 'endPositionY',
		type: 'number',
		default: 250,
		displayOptions: { show: { operation: ['draw'], primitive: ['circle', 'line', 'rectangle'] } },
		description: 'Y end position of the shape',
	},
	{
		displayName: 'Corner Radius',
		name: 'cornerRadius',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0 },
		displayOptions: { show: { operation: ['draw'], primitive: ['rectangle'] } },
		description: 'Radius for rounded rectangle corners',
	},

	// ────────────────────────────────────────────────────────────────────────
	// text
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		placeholder: 'Text to render',
		displayOptions: { show: { operation: ['text'] } },
		description: 'Text content to add to the image',
	},
	{
		displayName: 'Font Size',
		name: 'fontSize',
		type: 'number',
		default: 48,
		typeOptions: { minValue: 1 },
		displayOptions: { show: { operation: ['text'] } },
		description: 'Font size in pixels',
	},
	{
		displayName: 'Font Color',
		name: 'fontColor',
		type: 'color',
		default: '#ffffff',
		displayOptions: { show: { operation: ['text'] } },
		description: 'Text colour',
	},
	{
		displayName: 'Font Weight',
		name: 'fontWeight',
		type: 'options',
		default: '400',
		displayOptions: { show: { operation: ['text'] } },
		options: [
			{ name: 'Thin (100)', value: '100' },
			{ name: 'Extra Light (200)', value: '200' },
			{ name: 'Light (300)', value: '300' },
			{ name: 'Normal (400)', value: '400' },
			{ name: 'Medium (500)', value: '500' },
			{ name: 'Semi-Bold (600)', value: '600' },
			{ name: 'Bold (700)', value: '700' },
			{ name: 'Extra Bold (800)', value: '800' },
			{ name: 'Black (900)', value: '900' },
		],
		description:
			'Font weight. SVG/Sharp supports the full numeric range natively — click the expression icon (fx) to pass a custom number instead of using the dropdown.',
	},
	{
		displayName: 'Font Style',
		name: 'fontStyle',
		type: 'options',
		default: 'normal',
		displayOptions: { show: { operation: ['text'] } },
		options: [
			{ name: 'Normal', value: 'normal' },
			{ name: 'Italic', value: 'italic' },
			{ name: 'Oblique', value: 'oblique' },
		],
		description: 'Font style',
	},
	{
		displayName: 'Text Align',
		name: 'textAlign',
		type: 'options',
		default: 'center',
		displayOptions: { show: { operation: ['text'] } },
		options: [
			{ name: 'Left', value: 'left' },
			{ name: 'Center', value: 'center' },
			{ name: 'Right', value: 'right' },
			{ name: 'Justify', value: 'justify' },
		],
		description:
			'Horizontal text alignment within the box. Justify stretches each line (except the last line of each paragraph, by default) to fill the full box width, like CSS text-align: justify.',
	},
	{
		displayName: 'Stretch Last Line',
		name: 'justifyStretchLastLine',
		type: 'boolean',
		default: false,
		displayOptions: { show: { operation: ['text'], textAlign: ['justify'] } },
		description:
			'Off (default/standard): the last line of each paragraph keeps its natural width, like every real justify implementation (CSS, Word, InDesign) — stretching a short final line creates large, ugly gaps between words. On: every line, including short trailing ones, is force-stretched to fill the full width, gaps and all — a deliberate poster/graphic-design look rather than standard typography.',
	},
	{
		displayName: 'Gravity',
		name: 'gravity',
		type: 'options',
		default: 'Center',
		displayOptions: { show: { operation: ['text'] } },
		options: [
			{ name: 'North West', value: 'NorthWest' },
			{ name: 'North', value: 'North' },
			{ name: 'North East', value: 'NorthEast' },
			{ name: 'West', value: 'West' },
			{ name: 'Center', value: 'Center' },
			{ name: 'East', value: 'East' },
			{ name: 'South West', value: 'SouthWest' },
			{ name: 'South', value: 'South' },
			{ name: 'South East', value: 'SouthEast' },
		],
		description:
			'Anchor point on the full image (e.g. Center = exact middle of the image). Position X/Y are pixel offsets from this anchor.',
	},
	{
		displayName: 'Box Anchor',
		name: 'boxAnchor',
		type: 'options',
		default: 'Center',
		displayOptions: { show: { operation: ['text'] } },
		options: [
			{ name: 'North West', value: 'NorthWest' },
			{ name: 'North', value: 'North' },
			{ name: 'North East', value: 'NorthEast' },
			{ name: 'West', value: 'West' },
			{ name: 'Center', value: 'Center' },
			{ name: 'East', value: 'East' },
			{ name: 'South West', value: 'SouthWest' },
			{ name: 'South', value: 'South' },
			{ name: 'South East', value: 'SouthEast' },
		],
		description:
			'Which point of the text box itself sits at the Gravity anchor (Position X/Y). E.g. North = the box\'s top edge is placed at the anchor, so the box extends downward from it. Center = the box\'s own center sits exactly at the anchor. This is independent of Text Align, which only controls how lines align within the box.',
	},
	{
		displayName: 'Position X',
		name: 'positionX',
		type: 'number',
		default: 0,
		displayOptions: { show: { operation: ['text'] } },
		description: 'Horizontal offset from the Gravity anchor, in pixels. Positive moves right, negative moves left.',
	},
	{
		displayName: 'Position Y',
		name: 'positionY',
		type: 'number',
		default: 0,
		displayOptions: { show: { operation: ['text'] } },
		description: 'Vertical offset from the Gravity anchor, in pixels. Positive moves down, negative moves up.',
	},
	{
		displayName: 'Line Height',
		name: 'lineHeight',
		type: 'number',
		default: 1.4,
		typeOptions: { minValue: 0.5, maxValue: 5, numberPrecision: 1 },
		displayOptions: { show: { operation: ['text'] } },
		description: 'Line height multiplier (e.g. 1.4 = 140% of font size)',
	},
	{
		displayName: 'Max Line Length Mode',
		name: 'lineLengthMode',
		type: 'options',
		default: 'chars',
		displayOptions: { show: { operation: ['text'] } },
		options: [
			{ name: 'Characters', value: 'chars' },
			{ name: 'Percent of Image Width', value: 'percent' },
			{ name: 'Pixels', value: 'pixels' },
		],
		description: 'How the line-wrap width below is measured',
	},
	{
		displayName: 'Max Line Length (Chars)',
		name: 'lineLength',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 40,
		displayOptions: { show: { operation: ['text'], lineLengthMode: ['chars'] } },
		description: 'Maximum characters per line before wrapping',
	},
	{
		displayName: 'Max Line Length (%)',
		name: 'lineLengthPercent',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 100 },
		default: 80,
		displayOptions: { show: { operation: ['text'], lineLengthMode: ['percent'] } },
		description: 'Wrap width as a percentage of the full image width',
	},
	{
		displayName: 'Max Line Length (Px)',
		name: 'lineLengthPixels',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 800,
		displayOptions: { show: { operation: ['text'], lineLengthMode: ['pixels'] } },
		description: 'Wrap width in pixels',
	},
	{
		displayName: 'Min Line Length Mode',
		name: 'minLineLengthMode',
		type: 'options',
		default: 'auto',
		displayOptions: { show: { operation: ['text'] } },
		options: [
			{ name: 'Auto (no minimum)', value: 'auto' },
			{ name: 'Characters', value: 'chars' },
			{ name: 'Percent of Image Width', value: 'percent' },
			{ name: 'Pixels', value: 'pixels' },
		],
		description:
			'Prevents short "orphan" lines by requiring each line to reach at least this length before it\'s allowed to break — the line will exceed Max Line Length rather than break early if it hasn\'t hit the minimum yet (capped at 125% of Max as a safety ceiling against runaway overflow). Setting Min close to or equal to Max is a valid but tight configuration — it forces every line toward full width, which can look uneven since word-wrapping can only break at whole words, not any point. Auto disables this (normal wrapping, breaks purely based on Max Line Length).',
	},
	{
		displayName: 'Min Line Length (Chars)',
		name: 'minLineLength',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 20,
		displayOptions: { show: { operation: ['text'], minLineLengthMode: ['chars'] } },
		description: 'Minimum characters per line before a break is allowed',
	},
	{
		displayName: 'Min Line Length (%)',
		name: 'minLineLengthPercent',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 100 },
		default: 40,
		displayOptions: { show: { operation: ['text'], minLineLengthMode: ['percent'] } },
		description: 'Minimum line width as a percentage of the full image width',
	},
	{
		displayName: 'Min Line Length (Px)',
		name: 'minLineLengthPixels',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 400,
		displayOptions: { show: { operation: ['text'], minLineLengthMode: ['pixels'] } },
		description: 'Minimum line width in pixels',
	},
	{
		displayName: 'Text Overflow',
		name: 'textOverflow',
		type: 'options',
		default: 'visible',
		displayOptions: { show: { operation: ['text'] } },
		options: [
			{ name: 'Overflow (Visible)', value: 'visible' },
			{ name: 'Wrap (Break Long Words)', value: 'wrap' },
			{ name: 'Clip (Hide Overflow)', value: 'clip' },
		],
		description:
			'What happens when text exceeds the wrap width — e.g. a single long word/token with no spaces, which Max Line Length alone cannot break. "Overflow" (default) lets it spill past freely, same as before. "Wrap" force-breaks any long word mid-character so it never exceeds the line width, like CSS word-break: break-all. "Clip" hides anything extending past the text box bounds entirely, like CSS overflow: hidden — uses the box\'s own bounds (the same one Box Anchor positions), whether or not a visible background is enabled.',
	},
	{
		displayName: 'Text Opacity',
		name: 'textOpacity',
		type: 'number',
		typeOptions: { minValue: 0, maxValue: 100 },
		default: 100,
		displayOptions: { show: { operation: ['text'] } },
		description: 'Opacity of the text from 0 (invisible) to 100 (fully opaque)',
	},
	{
		displayName: 'Text Decoration',
		name: 'textDecoration',
		type: 'options',
		default: 'none',
		displayOptions: { show: { operation: ['text'] } },
		options: [
			{ name: 'None', value: 'none' },
			{ name: 'Underline', value: 'underline' },
			{ name: 'Overline', value: 'overline' },
			{ name: 'Line Through', value: 'line-through' },
		],
		description: 'Line decoration drawn through/under/over the text',
	},
	{
		displayName: 'Enable Text Stroke',
		name: 'textStroke',
		type: 'boolean',
		default: false,
		displayOptions: { show: { operation: ['text'] } },
		description: 'Whether to draw an outline around the text characters',
	},
	{
		displayName: 'Stroke Color',
		name: 'strokeColor',
		type: 'color',
		default: '#000000',
		displayOptions: { show: { operation: ['text'], textStroke: [true] } },
		description: 'Color of the text outline',
	},
	{
		displayName: 'Stroke Width',
		name: 'strokeWidth',
		type: 'number',
		typeOptions: { minValue: 0 },
		default: 1,
		displayOptions: { show: { operation: ['text'], textStroke: [true] } },
		description: 'Thickness of the text outline, in pixels',
	},
	{
		displayName: 'Enable Text Background',
		name: 'textBackground',
		type: 'boolean',
		default: false,
		displayOptions: { show: { operation: ['text'] } },
		description: 'Whether to draw a box behind the text',
	},
	{
		displayName: 'Background Style',
		name: 'backgroundStyle',
		type: 'options',
		default: 'solid',
		displayOptions: { show: { operation: ['text'], textBackground: [true] } },
		options: [
			{ name: 'Solid Color', value: 'solid' },
			{ name: 'Glass (Frosted)', value: 'glass' },
		],
		description:
			'Solid fills the box with a flat color. Glass creates a genuine frosted-glass effect by blurring the image behind the box and tinting it — like a translucent card over a photo.',
	},
	{
		displayName: 'Background Color',
		name: 'textBackgroundColor',
		type: 'color',
		default: '#000000',
		displayOptions: { show: { operation: ['text'], textBackground: [true] } },
		description: 'Color of the box (Solid) or the tint color of the glass panel (Glass)',
	},
	{
		displayName: 'Frost',
		name: 'glassFrost',
		type: 'number',
		typeOptions: { minValue: 0, maxValue: 100 },
		default: 50,
		displayOptions: { show: { operation: ['text'], textBackground: [true], backgroundStyle: ['glass'] } },
		description:
			'0 = fully transparent (glass panel invisible, blurred backdrop shows through completely). 100 = fully frosted/opaque tinted glass. Also increases the backdrop blur slightly at higher values, for a heavier frosted look.',
	},
	{
		displayName: 'Box Width Mode',
		name: 'boxWidthMode',
		type: 'options',
		default: 'auto',
		displayOptions: { show: { operation: ['text'], textBackground: [true] } },
		options: [
			{ name: 'Auto (fit to text)', value: 'auto' },
			{ name: 'Custom', value: 'custom' },
		],
		description: 'Auto estimates box width from the text content. Custom lets you set an exact width.',
	},
	{
		displayName: 'Box Width Unit',
		name: 'boxWidthUnit',
		type: 'options',
		default: 'px',
		displayOptions: { show: { operation: ['text'], textBackground: [true], boxWidthMode: ['custom'] } },
		options: [
			{ name: 'Pixels', value: 'px' },
			{ name: 'Percent of Image Width', value: 'percent' },
		],
	},
	{
		displayName: 'Box Width',
		name: 'boxWidthCustom',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 800,
		displayOptions: { show: { operation: ['text'], textBackground: [true], boxWidthMode: ['custom'] } },
		description: 'Fixed width of the background box, in the unit set above',
	},
	{
		displayName: 'Box Height Mode',
		name: 'boxHeightMode',
		type: 'options',
		default: 'auto',
		displayOptions: { show: { operation: ['text'], textBackground: [true] } },
		options: [
			{ name: 'Auto (fit to text)', value: 'auto' },
			{ name: 'Custom', value: 'custom' },
		],
		description: 'Auto estimates box height from the text content. Custom lets you set an exact height.',
	},
	{
		displayName: 'Box Height Unit',
		name: 'boxHeightUnit',
		type: 'options',
		default: 'px',
		displayOptions: { show: { operation: ['text'], textBackground: [true], boxHeightMode: ['custom'] } },
		options: [
			{ name: 'Pixels', value: 'px' },
			{ name: 'Percent of Image Height', value: 'percent' },
		],
	},
	{
		displayName: 'Box Height',
		name: 'boxHeightCustom',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 200,
		displayOptions: { show: { operation: ['text'], textBackground: [true], boxHeightMode: ['custom'] } },
		description: 'Fixed height of the background box, in the unit set above',
	},
	{
		displayName: 'Background Padding',
		name: 'textBackgroundPadding',
		type: 'string',
		default: '12',
		displayOptions: { show: { operation: ['text'], textBackground: [true] } },
		description:
			'CSS-style padding shorthand, space-separated. 1 value = all sides. 2 values = "top/bottom left/right" (NOT x/y — this is the real CSS order, easy to misremember). 3 values = "top left/right bottom". 4 values = "top right bottom left" (clockwise from top). Examples: "12" (all sides 12px) · "10 20" (10px top & bottom, 20px left & right) · "10 20 30 40" (10 top, 20 right, 30 bottom, 40 left).',
	},
	{
		displayName: 'Enable Background Border',
		name: 'textBackgroundBorder',
		type: 'boolean',
		default: false,
		displayOptions: { show: { operation: ['text'], textBackground: [true] } },
		description: 'Whether to draw a border around the background box',
	},
	{
		displayName: 'Border Color',
		name: 'textBackgroundBorderColor',
		type: 'color',
		default: '#FFFFFF',
		displayOptions: { show: { operation: ['text'], textBackground: [true], textBackgroundBorder: [true] } },
		description: 'Color of the border around the background box',
	},
	{
		displayName: 'Border Width',
		name: 'textBackgroundBorderWidth',
		type: 'number',
		typeOptions: { minValue: 0 },
		default: 2,
		displayOptions: { show: { operation: ['text'], textBackground: [true], textBackgroundBorder: [true] } },
		description: 'Thickness of the border, in pixels',
	},
	{
		displayName: 'Border Radius Unit',
		name: 'textBackgroundBorderRadiusUnit',
		type: 'options',
		default: 'px',
		displayOptions: { show: { operation: ['text'], textBackground: [true] } },
		options: [
			{ name: 'Pixels', value: 'px' },
			{ name: 'Percent', value: 'percent' },
		],
		description:
			'Percent is relative to the box\'s own size (0% = sharp corners, 100% = fully rounded/pill shape), so it scales automatically with the box instead of needing a fixed pixel value.',
	},
	{
		displayName: 'Border Radius',
		name: 'textBackgroundBorderRadius',
		type: 'number',
		typeOptions: { minValue: 0 },
		default: 0,
		displayOptions: { show: { operation: ['text'], textBackground: [true] } },
		description: 'Corner rounding of the background box. 0 = sharp corners. Unit is set by Border Radius Unit above.',
	},
	{
		displayName: 'Enable Text Shadow',
		name: 'textShadow',
		type: 'boolean',
		default: false,
		displayOptions: { show: { operation: ['text'] } },
		description: 'Whether to add a drop shadow behind the text',
	},
	{
		displayName: 'Shadow Color',
		name: 'shadowColor',
		type: 'color',
		default: '#000000',
		displayOptions: { show: { operation: ['text'], textShadow: [true] } },
	},
	{
		displayName: 'Shadow Opacity',
		name: 'shadowOpacity',
		type: 'number',
		typeOptions: { minValue: 0, maxValue: 100 },
		default: 60,
		displayOptions: { show: { operation: ['text'], textShadow: [true] } },
	},
	{
		displayName: 'Shadow Blur',
		name: 'shadowBlur',
		type: 'number',
		typeOptions: { minValue: 0 },
		default: 3,
		displayOptions: { show: { operation: ['text'], textShadow: [true] } },
		description: 'Softness of the shadow edge (SVG stdDeviation)',
	},
	{
		displayName: 'Shadow Offset X',
		name: 'shadowOffsetX',
		type: 'number',
		default: 2,
		displayOptions: { show: { operation: ['text'], textShadow: [true] } },
	},
	{
		displayName: 'Shadow Offset Y',
		name: 'shadowOffsetY',
		type: 'number',
		default: 2,
		displayOptions: { show: { operation: ['text'], textShadow: [true] } },
	},

	// ────────────────────────────────────────────────────────────────────────
	// blur
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Sigma',
		name: 'sigma',
		type: 'number',
		typeOptions: { minValue: 0.3, maxValue: 1000, numberPrecision: 1 },
		default: 3,
		displayOptions: { show: { operation: ['blur'] } },
		description: 'Blur radius (sigma). Higher = more blur.',
	},

	// ────────────────────────────────────────────────────────────────────────
	// border
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Border Width',
		name: 'borderWidth',
		type: 'number',
		default: 20,
		typeOptions: { minValue: 0 },
		displayOptions: { show: { operation: ['border'] } },
		description: 'Left and right border width in pixels',
	},
	{
		displayName: 'Border Height',
		name: 'borderHeight',
		type: 'number',
		default: 20,
		typeOptions: { minValue: 0 },
		displayOptions: { show: { operation: ['border'] } },
		description: 'Top and bottom border height in pixels',
	},
	{
		displayName: 'Border Color',
		name: 'borderColor',
		type: 'color',
		default: '#000000',
		displayOptions: { show: { operation: ['border'] } },
		description: 'Colour of the border',
	},

	// ────────────────────────────────────────────────────────────────────────
	// composite
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Composite Image Property',
		name: 'dataPropertyNameComposite',
		type: 'string',
		default: 'data2',
		placeholder: 'data2',
		displayOptions: { show: { operation: ['composite'] } },
		description: 'Binary property name that contains the image to overlay',
	},
	{
		displayName: 'Blend Mode',
		name: 'operator',
		type: 'options',
		displayOptions: { show: { operation: ['composite'] } },
		options: [
			{ name: 'Clear', value: 'clear' },
			{ name: 'Source', value: 'source' },
			{ name: 'Over (Normal)', value: 'over' },
			{ name: 'In', value: 'in' },
			{ name: 'Out', value: 'out' },
			{ name: 'Atop', value: 'atop' },
			{ name: 'Destination Over', value: 'dest-over' },
			{ name: 'Destination In', value: 'dest-in' },
			{ name: 'Destination Out', value: 'dest-out' },
			{ name: 'Destination Atop', value: 'dest-atop' },
			{ name: 'Xor', value: 'xor' },
			{ name: 'Add', value: 'add' },
			{ name: 'Saturate', value: 'saturate' },
			{ name: 'Multiply', value: 'multiply' },
			{ name: 'Screen', value: 'screen' },
			{ name: 'Overlay', value: 'overlay' },
			{ name: 'Darken', value: 'darken' },
			{ name: 'Lighten', value: 'lighten' },
			{ name: 'Colour Dodge', value: 'colour-dodge' },
			{ name: 'Colour Burn', value: 'colour-burn' },
			{ name: 'Hard Light', value: 'hard-light' },
			{ name: 'Soft Light', value: 'soft-light' },
			{ name: 'Difference', value: 'difference' },
			{ name: 'Exclusion', value: 'exclusion' },
		],
		default: 'over',
		description: 'Blending mode for compositing',
	},
	{
		displayName: 'Position X',
		name: 'positionX',
		type: 'number',
		default: 0,
		displayOptions: { show: { operation: ['composite'] } },
		description: 'X offset of the overlay image (pixels from left)',
	},
	{
		displayName: 'Position Y',
		name: 'positionY',
		type: 'number',
		default: 0,
		displayOptions: { show: { operation: ['composite'] } },
		description: 'Y offset of the overlay image (pixels from top)',
	},

	// ────────────────────────────────────────────────────────────────────────
	// crop
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Width',
		name: 'width',
		type: 'number',
		default: 500,
		typeOptions: { minValue: 1 },
		displayOptions: { show: { operation: ['crop'] } },
		description: 'Width of the crop region',
	},
	{
		displayName: 'Height',
		name: 'height',
		type: 'number',
		default: 500,
		typeOptions: { minValue: 1 },
		displayOptions: { show: { operation: ['crop'] } },
		description: 'Height of the crop region',
	},
	{
		displayName: 'Position X',
		name: 'positionX',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0 },
		displayOptions: { show: { operation: ['crop'] } },
		description: 'X coordinate (from left) of the crop start',
	},
	{
		displayName: 'Position Y',
		name: 'positionY',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0 },
		displayOptions: { show: { operation: ['crop'] } },
		description: 'Y coordinate (from top) of the crop start',
	},

	// ────────────────────────────────────────────────────────────────────────
	// resize
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Width',
		name: 'width',
		type: 'number',
		default: 1080,
		typeOptions: { minValue: 1 },
		displayOptions: { show: { operation: ['resize'] } },
		description: 'Target width in pixels',
	},
	{
		displayName: 'Height',
		name: 'height',
		type: 'number',
		default: 1080,
		typeOptions: { minValue: 1 },
		displayOptions: { show: { operation: ['resize'] } },
		description: 'Target height in pixels',
	},
	{
		displayName: 'Fit',
		name: 'resizeOption',
		type: 'options',
		options: [
			{ name: 'Cover (Crop to Fill)', value: 'cover', description: 'Scales to fill, crops excess' },
			{ name: 'Contain (Letterbox)', value: 'contain', description: 'Scales to fit, adds padding' },
			{ name: 'Fill (Ignore Aspect Ratio)', value: 'fill', description: 'Stretches to exact dimensions' },
			{ name: 'Inside (Max Area)', value: 'inside', description: 'Scales down only if larger than dimensions' },
			{ name: 'Outside (Min Area)', value: 'outside', description: 'Scales up only if smaller than dimensions' },
		],
		default: 'cover',
		displayOptions: { show: { operation: ['resize'] } },
		description: 'How to fit the image into the target dimensions',
	},
	{
		displayName: 'Background Color (for Contain)',
		name: 'resizeBackground',
		type: 'color',
		default: '#000000',
		typeOptions: { showAlpha: true },
		displayOptions: { show: { operation: ['resize'], resizeOption: ['contain'] } },
		description: 'Background fill colour when using "Contain" fit',
	},

	// ────────────────────────────────────────────────────────────────────────
	// rotate
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Degrees',
		name: 'rotate',
		type: 'number',
		typeOptions: { minValue: -360, maxValue: 360 },
		default: 90,
		displayOptions: { show: { operation: ['rotate'] } },
		description: 'Angle to rotate (positive = clockwise)',
	},
	{
		displayName: 'Background Color',
		name: 'backgroundColor',
		type: 'color',
		default: '#00000000',
		typeOptions: { showAlpha: true },
		displayOptions: { show: { operation: ['rotate'] } },
		description: 'Fill colour for the area revealed by rotation',
	},

	// ────────────────────────────────────────────────────────────────────────
	// shear
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Shear X (degrees)',
		name: 'degreesX',
		type: 'number',
		typeOptions: { numberPrecision: 1 },
		default: 0,
		displayOptions: { show: { operation: ['shear'] } },
		description: 'Horizontal shear angle in degrees',
	},
	{
		displayName: 'Shear Y (degrees)',
		name: 'degreesY',
		type: 'number',
		typeOptions: { numberPrecision: 1 },
		default: 10,
		displayOptions: { show: { operation: ['shear'] } },
		description: 'Vertical shear angle in degrees',
	},

	// ────────────────────────────────────────────────────────────────────────
	// transparent (PNG output, trims near-white/black to alpha)
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Background Color to Remove',
		name: 'transparentColor',
		type: 'color',
		default: '#ffffff',
		displayOptions: { show: { operation: ['transparent'] } },
		description: 'The background colour to replace with transparency',
	},
	{
		displayName: 'Tolerance',
		name: 'tolerance',
		type: 'number',
		typeOptions: { minValue: 0, maxValue: 255 },
		default: 30,
		displayOptions: { show: { operation: ['transparent'] } },
		description: 'Colour matching tolerance (0 = exact match only, 255 = match everything)',
	},

	// ────────────────────────────────────────────────────────────────────────
	// sharpen
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Sigma',
		name: 'sharpenSigma',
		type: 'number',
		typeOptions: { minValue: 0.5, maxValue: 5, numberPrecision: 1 },
		default: 1,
		displayOptions: { show: { operation: ['sharpen'] } },
		description: 'Unsharp mask sigma. Higher = wider radius.',
	},
	{
		displayName: 'Flat Area Threshold',
		name: 'sharpenFlat',
		type: 'number',
		typeOptions: { minValue: 0, maxValue: 10000, numberPrecision: 1 },
		default: 1,
		displayOptions: { show: { operation: ['sharpen'] } },
		description: 'Threshold of flat areas (lower = sharpen more of the image)',
	},
	{
		displayName: 'Jagged Area Threshold',
		name: 'sharpenJagged',
		type: 'number',
		typeOptions: { minValue: 0, maxValue: 10000, numberPrecision: 1 },
		default: 2,
		displayOptions: { show: { operation: ['sharpen'] } },
		description: 'Threshold of jagged edges (higher = sharpen edges more aggressively)',
	},

	// ────────────────────────────────────────────────────────────────────────
	// gamma
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Gamma Value',
		name: 'gammaValue',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 3, numberPrecision: 1 },
		default: 2.2,
		displayOptions: { show: { operation: ['gamma'] } },
		description: 'Gamma value between 1.0 (darker) and 3.0 (brighter)',
	},

	// ────────────────────────────────────────────────────────────────────────
	// tint
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Tint Color',
		name: 'tintColor',
		type: 'color',
		default: '#ff6b35',
		displayOptions: { show: { operation: ['tint'] } },
		description: 'Colour to tint the image with',
	},

	// ────────────────────────────────────────────────────────────────────────
	// watermark
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Watermark Image Property',
		name: 'watermarkProperty',
		type: 'string',
		default: 'watermark',
		placeholder: 'watermark',
		displayOptions: { show: { operation: ['watermark'] } },
		description: 'Binary property name containing the watermark image',
	},
	{
		displayName: 'Gravity (Position)',
		name: 'watermarkGravity',
		type: 'options',
		displayOptions: { show: { operation: ['watermark'] } },
		options: [
			{ name: 'Center', value: 'centre' },
			{ name: 'Top Left', value: 'northwest' },
			{ name: 'Top Center', value: 'north' },
			{ name: 'Top Right', value: 'northeast' },
			{ name: 'Middle Left', value: 'west' },
			{ name: 'Middle Right', value: 'east' },
			{ name: 'Bottom Left', value: 'southwest' },
			{ name: 'Bottom Center', value: 'south' },
			{ name: 'Bottom Right', value: 'southeast' },
		],
		default: 'southeast',
		description: 'Where to place the watermark',
	},
	{
		displayName: 'Opacity (%)',
		name: 'watermarkOpacity',
		type: 'number',
		typeOptions: { minValue: 0, maxValue: 100 },
		default: 50,
		displayOptions: { show: { operation: ['watermark'] } },
		description: 'Watermark opacity from 0 (invisible) to 100 (fully opaque)',
	},
	{
		displayName: 'Max Size (% of Canvas)',
		name: 'watermarkScale',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 100 },
		default: 20,
		displayOptions: { show: { operation: ['watermark'] } },
		description: 'Scale the watermark so its longest side is this % of the canvas',
	},
];

// ---------------------------------------------------------------------------
// Node class
// ---------------------------------------------------------------------------

export class EditImagePlus implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Edit Image Ultimate',
		name: 'editImageUltimate',
		icon: 'fa:image',
		group: ['transform'],
		version: 1,
		description: 'Advanced image editing: blur, crop, resize, text, templates, effects and more — powered by Sharp',
		defaults: {
			name: 'Edit Image Ultimate',
			color: '#D4AF37',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			// ────────────────────────────────────────────────────────────────
			// Top-level operation selector
			// ────────────────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Get Information',
						value: 'information',
						description: 'Return image metadata (size, format, DPI, …)',
						action: 'Get image information',
					},
					{
						name: 'Multi Step',
						value: 'multiStep',
						description: 'Chain multiple operations in one node',
						action: 'Apply multiple operations',
					},
					...nodeOperations,
				].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())),
				default: 'resize',
			},
			// Input binary property
			{
				displayName: 'Input Property Name',
				name: 'dataPropertyName',
				type: 'string',
				default: 'data',
				displayOptions: {
					hide: { operation: ['information', 'create', 'template'] },
				},
				description: 'Name of the binary property that contains the input image',
			},
			{
				displayName: 'Input Property Name',
				name: 'dataPropertyName',
				type: 'string',
				default: 'data',
				displayOptions: {
					show: { operation: ['information'] },
				},
				description: 'Name of the binary property that contains the input image',
			},

			// ────────────────────────────────────────────────────────────────
			// multiStep fixed-collection
			// ────────────────────────────────────────────────────────────────
			{
				displayName: 'Operations',
				name: 'operations',
				placeholder: 'Add Operation',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true, sortable: true },
				displayOptions: { show: { operation: ['multiStep'] } },
				description: 'Operations to apply in sequence',
				default: {},
				options: [
					{
						name: 'operations',
						displayName: 'Operations',
						values: [
							{
								displayName: 'Operation',
								name: 'operation',
								type: 'options',
								noDataExpression: true,
								options: nodeOperations,
								default: 'resize',
							},
							...nodeOperationOptions,
						],
					},
				],
			},

			// Spread single-step operation params
			...nodeOperationOptions,

			// ────────────────────────────────────────────────────────────────
			// Output options
			// ────────────────────────────────────────────────────────────────
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Output Option',
				default: {},
				displayOptions: { hide: { operation: ['information'] } },
				options: [
					{
						displayName: 'Output Property Name',
						name: 'outputPropertyName',
						type: 'string',
						default: '',
						placeholder: 'Leave blank to overwrite input property',
						description: 'Binary property name for the output image',
					},
					{
						displayName: 'Format',
						name: 'format',
						type: 'options',
						options: [
							{ name: 'Same as Input', value: 'same' },
							{ name: 'AVIF', value: 'avif' },
							{ name: 'GIF', value: 'gif' },
							{ name: 'JPEG', value: 'jpeg' },
							{ name: 'PNG', value: 'png' },
							{ name: 'TIFF', value: 'tiff' },
							{ name: 'WebP', value: 'webp' },
						],
						default: 'same',
						description:
							'Output image format. "Same as Input" keeps the original format (recommended — avoids accidentally re-encoding a JPEG photo as lossless PNG, which can massively inflate file size).',
					},
					{
						displayName: 'Quality (JPEG / WebP / AVIF)',
						name: 'quality',
						type: 'number',
						typeOptions: { minValue: 1, maxValue: 100 },
						default: 90,
						displayOptions: { show: { format: ['jpeg', 'webp', 'avif'] } },
						description: 'Output quality 1–100 (higher = better quality, larger file)',
					},
					{
						displayName: 'PNG Compression Level',
						name: 'pngCompressionLevel',
						type: 'number',
						typeOptions: { minValue: 0, maxValue: 9 },
						default: 6,
						displayOptions: { show: { format: ['png'] } },
						description: 'PNG compression level 0 (fastest) to 9 (smallest)',
					},
					{
						displayName: 'File Name',
						name: 'fileName',
						type: 'string',
						default: '',
						description: 'Override the file name stored in binary data',
					},
				],
			},
		],
	};

	// -------------------------------------------------------------------------
	// execute
	// -------------------------------------------------------------------------
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const item = items[itemIndex];
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const dataPropertyName = this.getNodeParameter('dataPropertyName', itemIndex, 'data') as string;
				const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;

				// Determine which operations list to process
				let operations: IDataObject[] = [];
				if (operation === 'multiStep') {
					const operationsData = this.getNodeParameter('operations', itemIndex, { operations: [] }) as IDataObject;
					operations = (operationsData.operations as IDataObject[]) ?? [];
				} else {
					// Collect all parameters for single operation
					const singleOp = buildSingleOpParams(this, operation, itemIndex);
					operations = [{ operation, ...singleOp }];
				}

				// ── Get information ─────────────────────────────────────────
				if (operation === 'information') {
					this.helpers.assertBinaryData(itemIndex, dataPropertyName);
					const buf = await this.helpers.getBinaryDataBuffer(itemIndex, dataPropertyName);
					const meta = await sharp(buf).metadata();
					returnData.push({
						json: meta as unknown as IDataObject,
						pairedItem: { item: itemIndex },
					});
					continue;
				}

				// ── Determine output property name ──────────────────────────
				const outputPropertyName = ((options.outputPropertyName as string) || '') || dataPropertyName;

				// ── Build sharp pipeline ─────────────────────────────────────
				let sharpInstance: sharp.Sharp;

				if (operations[0]?.operation === 'create') {
					const op = operations[0];
					const bg = hexToRgba(op.backgroundColor as string ?? '#ffffff');
					sharpInstance = sharp({
						create: {
							width: op.width as number,
							height: op.height as number,
							channels: 4,
							background: { r: bg.r, g: bg.g, b: bg.b, alpha: bg.alpha },
						},
					});
				} else if (operations[0]?.operation === 'template') {
					sharpInstance = await buildTemplateInstance(operations[0]);
				} else {
					this.helpers.assertBinaryData(itemIndex, dataPropertyName);
					const buf = await this.helpers.getBinaryDataBuffer(itemIndex, dataPropertyName);
					sharpInstance = sharp(buf);
				}

				// Apply each operation
				for (const op of operations) {
					sharpInstance = await applyOperation(this, sharpInstance, op, itemIndex);
				}

				// ── Output format ───────────────────────────────────────────
				// "same" resolves to the original input image's format at runtime,
				// so a JPEG photo stays a JPEG instead of silently ballooning into
				// a much larger lossless PNG. Falls back to PNG if there's no
				// input binary to detect from (e.g. Create/Template operations)
				// or the detected format isn't one Sharp can encode.
				let fmt = (options.format as string) || 'same';
				if (fmt === 'same') {
					const inputMime = item.binary?.[dataPropertyName]?.mimeType as string | undefined;
					const supported = ['avif', 'gif', 'jpeg', 'png', 'tiff', 'webp'];
					const detected = inputMime?.split('/')[1]?.toLowerCase();
					const normalized = detected === 'jpg' ? 'jpeg' : detected;
					fmt = normalized && supported.includes(normalized) ? normalized : 'png';
				}
				const mimeType = `image/${fmt}`;
				const quality = (options.quality as number) ?? 90;
				const pngLevel = (options.pngCompressionLevel as number) ?? 6;

				if (fmt === 'jpeg') {
					sharpInstance = sharpInstance.jpeg({ quality });
				} else if (fmt === 'webp') {
					sharpInstance = sharpInstance.webp({ quality });
				} else if (fmt === 'avif') {
					sharpInstance = sharpInstance.avif({ quality });
				} else if (fmt === 'png') {
					sharpInstance = sharpInstance.png({ compressionLevel: pngLevel });
				} else if (fmt === 'tiff') {
					sharpInstance = sharpInstance.tiff({ quality });
				} else if (fmt === 'gif') {
					sharpInstance = sharpInstance.gif();
				} else {
					sharpInstance = sharpInstance.png({ compressionLevel: pngLevel });
				}

				const outputBuffer = await sharpInstance.toBuffer();

				// ── Assemble output item ────────────────────────────────────
				const newItem: INodeExecutionData = {
					json: deepCopy(item.json),
					binary: item.binary ? deepCopy(item.binary) : {},
					pairedItem: { item: itemIndex },
				};

				const fileName = (options.fileName as string) || `image.${fmt}`;
				const binaryData = await this.helpers.prepareBinaryData(
					outputBuffer,
					fileName,
					mimeType,
				);
				newItem.binary![outputPropertyName] = binaryData;

				returnData.push(newItem);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
			}
		}

		return [returnData];
	}
}

// ---------------------------------------------------------------------------
// Parameter collector for single-step mode
// ---------------------------------------------------------------------------

function buildSingleOpParams(ctx: IExecuteFunctions, operation: string, itemIndex: number): IDataObject {
	const paramNames: Record<string, string[]> = {
		blur: ['sigma'],
		border: ['borderColor', 'borderWidth', 'borderHeight'],
		composite: ['dataPropertyNameComposite', 'operator', 'positionX', 'positionY'],
		create: ['backgroundColor', 'width', 'height'],
		crop: ['width', 'height', 'positionX', 'positionY'],
		draw: ['color', 'strokeColor', 'strokeWidth', 'cornerRadius', 'endPositionX', 'endPositionY', 'primitive', 'startPositionX', 'startPositionY'],
		flip: [],
		flop: [],
		gamma: ['gammaValue'],
		grayscale: [],
		normalize: [],
		resize: ['width', 'height', 'resizeOption', 'resizeBackground'],
		rotate: ['backgroundColor', 'rotate'],
		sepia: [],
		sharpen: ['sharpenSigma', 'sharpenFlat', 'sharpenJagged'],
		shear: ['degreesX', 'degreesY'],
		template: ['templateName', 'customWidth', 'customHeight', 'templateBgColor', 'templateGradientColor', 'templateLayout', 'templateTitle', 'templateTitleFont', 'templateTitleFontCustom', 'templateTitleColor', 'templateSubtitle', 'templateSubtitleFont', 'templateSubtitleFontCustom', 'templateSubtitleColor', 'templateQuote', 'templateQuoteFont', 'templateQuoteFontCustom', 'templateQuoteAuthor', 'templateQuoteAuthorFont', 'templateQuoteAuthorFontCustom', 'templateMemeTop', 'templateMemeTopFont', 'templateMemeTopFontCustom', 'templateMemeBottom', 'templateMemeBottomFont', 'templateMemeBottomFontCustom', 'templateAccentColor', 'templateTextEffect', 'templateEffectColor', 'templateEffectOpacity', 'templateEffectBlur', 'templateEffectOffsetX', 'templateEffectOffsetY', 'templateEffectOutlineWidth', 'quoteWatermarkText', 'quoteWatermarkFont', 'quoteWatermarkFontCustom', 'quoteWatermarkColor', 'quoteWatermarkOpacity', 'quoteWatermarkX', 'quoteWatermarkY'],
		text: [
			'text', 'fontSize', 'fontColor', 'fontWeight', 'fontStyle', 'textAlign', 'justifyStretchLastLine',
			'gravity', 'boxAnchor', 'positionX', 'positionY', 'lineHeight',
			'lineLengthMode', 'lineLength', 'lineLengthPercent', 'lineLengthPixels',
			'minLineLengthMode', 'minLineLength', 'minLineLengthPercent', 'minLineLengthPixels',
			'textOverflow',
			'textOpacity', 'textDecoration',
			'textStroke', 'strokeColor', 'strokeWidth',
			'textBackground', 'backgroundStyle', 'textBackgroundColor', 'glassFrost',
			'boxWidthMode', 'boxWidthUnit', 'boxWidthCustom',
			'boxHeightMode', 'boxHeightUnit', 'boxHeightCustom',
			'textBackgroundPadding',
			'textBackgroundBorder', 'textBackgroundBorderColor', 'textBackgroundBorderWidth', 'textBackgroundBorderRadiusUnit', 'textBackgroundBorderRadius',
			'textShadow', 'shadowColor', 'shadowOpacity', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY',
		],
		tint: ['tintColor'],
		transparent: ['transparentColor', 'tolerance'],
		watermark: ['watermarkProperty', 'watermarkGravity', 'watermarkOpacity', 'watermarkScale'],
	};

	const result: IDataObject = {};
	const params = paramNames[operation] ?? [];
	for (const p of params) {
		try {
			result[p] = ctx.getNodeParameter(p, itemIndex);
		} catch (_) {
			// Parameter not set — use default from node definition
		}
	}
	return result;
}

// ---------------------------------------------------------------------------
// Template builder
// ---------------------------------------------------------------------------

async function buildTemplateInstance(op: IDataObject): Promise<sharp.Sharp> {
	const templateName = op.templateName as string;
	const tpl = IMAGE_TEMPLATES.find((t) => t.name === templateName) ?? IMAGE_TEMPLATES[0];
	const width = templateName === 'Custom' ? (op.customWidth as number ?? 800) : tpl.width;
	const height = templateName === 'Custom' ? (op.customHeight as number ?? 600) : tpl.height;

	const bg = hexToRgba(op.templateBgColor as string ?? '#1a1a2e');
	const layout = op.templateLayout as string ?? 'standard';
	
	const titleText = escapeSvg((op.templateTitle as string ?? '').trim());
	const subtitleText = escapeSvg((op.templateSubtitle as string ?? '').trim());
	const titleColor = op.templateTitleColor as string ?? '#ffffff';
	const subtitleColor = op.templateSubtitleColor as string ?? '#cccccc';
	const accentColor = op.templateAccentColor as string ?? '#e94560';
	const gradientColor = op.templateGradientColor as string ?? accentColor;
	
	const quoteText = escapeSvg((op.templateQuote as string ?? '').trim());
	const quoteAuthor = escapeSvg((op.templateQuoteAuthor as string ?? '').trim());

	const memeTop = escapeSvg((op.templateMemeTop as string ?? '').toUpperCase().trim());
	const memeBottom = escapeSvg((op.templateMemeBottom as string ?? '').toUpperCase().trim());

	// Fonts
	const titleFont = op.templateTitleFont === 'custom' ? (op.templateTitleFontCustom as string || 'Arial, sans-serif') : (op.templateTitleFont as string || 'Arial, sans-serif');
	const subtitleFont = op.templateSubtitleFont === 'custom' ? (op.templateSubtitleFontCustom as string || 'Arial, sans-serif') : (op.templateSubtitleFont as string || 'Arial, sans-serif');
	const quoteFont = op.templateQuoteFont === 'custom' ? (op.templateQuoteFontCustom as string || 'Georgia, serif') : (op.templateQuoteFont as string || 'Georgia, serif');
	const authorFont = op.templateQuoteAuthorFont === 'custom' ? (op.templateQuoteAuthorFontCustom as string || 'Arial, sans-serif') : (op.templateQuoteAuthorFont as string || 'Arial, sans-serif');
	const memeTopFont = op.templateMemeTopFont === 'custom' ? (op.templateMemeTopFontCustom as string || 'Impact, sans-serif') : (op.templateMemeTopFont as string || 'Impact, sans-serif');
	const memeBottomFont = op.templateMemeBottomFont === 'custom' ? (op.templateMemeBottomFontCustom as string || 'Impact, sans-serif') : (op.templateMemeBottomFont as string || 'Impact, sans-serif');

	// Quote Watermark
	const quoteWmText = escapeSvg((op.quoteWatermarkText as string ?? '').trim());
	const quoteWmFont = op.quoteWatermarkFont === 'custom' ? (op.quoteWatermarkFontCustom as string || 'Arial, sans-serif') : (op.quoteWatermarkFont as string || 'Arial, sans-serif');
	const quoteWmColor = op.quoteWatermarkColor as string ?? '#ffffff';
	const quoteWmOpacity = (op.quoteWatermarkOpacity as number ?? 30) / 100;
	const quoteWmX = op.quoteWatermarkX as number ?? 50;
	const quoteWmY = op.quoteWatermarkY as number ?? 95;

	// Text Effects
	const textEffect = op.templateTextEffect as string ?? 'default';
	const effectColor = op.templateEffectColor as string ?? '#000000';
	const effectOpacity = (op.templateEffectOpacity as number ?? 50) / 100;
	const effectBlur = op.templateEffectBlur as number ?? 4;
	const effectOffsetX = op.templateEffectOffsetX as number ?? 2;
	const effectOffsetY = op.templateEffectOffsetY as number ?? 2;
	const effectOutlineWidth = op.templateEffectOutlineWidth as number ?? 2;

	let customFilterSvg = '';
	let applyFilterAttr = '';
	let applyStrokeAttr = '';

	if (textEffect === 'default') {
		// Backwards compatibility
		customFilterSvg = `
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="2" dy="2" stdDeviation="4" flood-opacity="0.5"/>
    </filter>`;
		applyFilterAttr = 'filter="url(#shadow)"'; 
	} else if (textEffect === 'shadow') {
		customFilterSvg = `
    <filter id="customEffect" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="${effectOffsetX}" dy="${effectOffsetY}" stdDeviation="${effectBlur}" flood-color="${effectColor}" flood-opacity="${effectOpacity}"/>
    </filter>`;
		applyFilterAttr = 'filter="url(#customEffect)"';
	} else if (textEffect === 'glow') {
		customFilterSvg = `
    <filter id="customEffect" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="${effectBlur}" flood-color="${effectColor}" flood-opacity="${effectOpacity}"/>
    </filter>`;
		applyFilterAttr = 'filter="url(#customEffect)"';
	} else if (textEffect === 'outline') {
		applyStrokeAttr = `stroke="${effectColor}" stroke-width="${effectOutlineWidth}" stroke-linejoin="round"`;
	}

	const effectAttrMain = textEffect === 'default' ? 'filter="url(#shadow)"' : `${applyFilterAttr} ${applyStrokeAttr}`.trim();
	const effectAttrSub = textEffect === 'default' ? '' : `${applyFilterAttr} ${applyStrokeAttr}`.trim();

	// Responsive font sizes
	const titleFontSize = Math.max(24, Math.round(width * 0.065));
	const subtitleFontSize = Math.max(16, Math.round(width * 0.033));
	const padding = Math.round(width * 0.06);
	const accentBarH = Math.max(4, Math.round(height * 0.006));

	// Title Y position — roughly 45% from top
	const titleY = Math.round(height * 0.45);
	const subtitleY = titleY + titleFontSize * 1.6;

	// Accent bar X and Y
	let accentBarX = padding;
	let accentBarY = titleY - titleFontSize * 1.4;

	let titleSvg = '';
	if (titleText && layout === 'standard') {
		titleSvg = `
		<text
			x="${padding}" y="${titleY}"
			font-family='${titleFont}'
			font-size="${titleFontSize}"
			font-weight="bold"
			fill="${titleColor}"
			${effectAttrMain}
		>${titleText}</text>`;
	}

	let subtitleSvg = '';
	if (subtitleText && layout === 'standard') {
		subtitleSvg = `
		<text
			x="${padding}" y="${subtitleY}"
			font-family='${subtitleFont}'
			font-size="${subtitleFontSize}"
			fill="${subtitleColor}"
			opacity="0.9"
			${effectAttrSub}
		>${subtitleText}</text>`;
	}

	let quoteSvg = '';
	if (quoteText && layout === 'quote') {
		const qFontSize = Math.max(24, Math.round(width * 0.055));
		const maxCharsPerLine = Math.floor(width / (qFontSize * 0.6));
		const words = quoteText.split(' ');
		const lines = [];
		let curLine = '';
		for (const w of words) {
			if ((curLine + w).length > maxCharsPerLine) {
				lines.push(curLine.trim());
				curLine = w + ' ';
			} else {
				curLine += w + ' ';
			}
		}
		if (curLine) lines.push(curLine.trim());

		// Center vertically, accounting for multi-line
		const startY = Math.round(height * 0.5) - ((lines.length - 1) * (qFontSize * 1.5) / 2);
		
		// Update accent bar to sit above the quote
		accentBarX = padding;
		accentBarY = startY - (qFontSize * 1.5);

		const tspans = lines.map((l, i) => `<tspan x="${width / 2}" dy="${i === 0 ? 0 : qFontSize * 1.5}">${l}</tspan>`).join('');
		
		quoteSvg = `
		<text
			x="${width / 2}" y="${startY}"
			font-family='${quoteFont}'
			font-size="${qFontSize}"
			font-style="italic"
			fill="${titleColor}"
			text-anchor="middle"
			${effectAttrMain}
		>${tspans}</text>`;
	}

	let authorSvg = '';
	if (quoteAuthor && layout === 'quote') {
		const aFontSize = Math.max(16, Math.round(width * 0.035));
		authorSvg = `
		<text
			x="${width / 2}" y="${height - padding}"
			font-family='${authorFont}'
			font-size="${aFontSize}"
			fill="${subtitleColor}"
			text-anchor="middle"
			opacity="0.9"
			${effectAttrSub}
		>— ${quoteAuthor}</text>`;
	}

	let memeSvg = '';
	if (layout === 'meme') {
		const mFontSize = Math.max(30, Math.round(height * 0.1));
		
		const defaultMemeStroke = `stroke="#000000" stroke-width="${Math.max(1, Math.round(mFontSize * 0.05))}"`;
		const memeEffectAttr = textEffect === 'default' ? defaultMemeStroke : `${applyFilterAttr} ${applyStrokeAttr}`.trim();

		// For meme layout, move the accent bar far above the text or hide it by placing it off-screen
		accentBarY = -1000;
		if (memeTop) {
			memeSvg += `
			<text
				x="${width / 2}" y="${mFontSize * 1.1}"
				font-family='${memeTopFont}'
				font-size="${mFontSize}"
				font-weight="bold"
				fill="${titleColor}"
				${memeEffectAttr}
				text-anchor="middle"
			>${memeTop}</text>`;
		}
		if (memeBottom) {
			memeSvg += `
			<text
				x="${width / 2}" y="${height - (mFontSize * 0.3)}"
				font-family='${memeBottomFont}'
				font-size="${mFontSize}"
				font-weight="bold"
				fill="${titleColor}"
				${memeEffectAttr}
				text-anchor="middle"
			>${memeBottom}</text>`;
		}
	}

	let quoteWatermarkSvg = '';
	if (quoteWmText && layout === 'quote') {
		const wmFontSize = Math.max(12, Math.round(width * 0.025));
		const wmX = (width * quoteWmX) / 100;
		const wmY = (height * quoteWmY) / 100;
		quoteWatermarkSvg = `
		<text
			x="${wmX}" y="${wmY}"
			font-family='${quoteWmFont}'
			font-size="${wmFontSize}"
			fill="${quoteWmColor}"
			opacity="${quoteWmOpacity}"
			text-anchor="middle"
		>${quoteWmText}</text>`;
	}

	const svg = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
${customFilterSvg}
  </defs>
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="${op.templateBgColor ?? '#1a1a2e'}"/>
  <!-- Subtle gradient overlay -->
  <defs>
    <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${gradientColor}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${gradientColor}" stop-opacity="0.02"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#grad)"/>
  <!-- Accent bar -->
  <rect x="${accentBarX}" y="${accentBarY}" width="${Math.round(width * 0.12)}" height="${accentBarH}" fill="${accentColor}" rx="${Math.round(accentBarH / 2)}"/>
  ${titleSvg}
  ${subtitleSvg}
  ${quoteSvg}
  ${authorSvg}
  ${memeSvg}
  ${quoteWatermarkSvg}
  <!-- Corner decoration -->
  <rect x="${width - 60}" y="${height - 60}" width="40" height="4" fill="${accentColor}" opacity="0.6" rx="2"/>
  <rect x="${width - 24}" y="${height - 60}" width="4" height="40" fill="${accentColor}" opacity="0.6" rx="2"/>
</svg>`;

	const base = sharp({
		create: {
			width,
			height,
			channels: 4,
			background: { r: bg.r, g: bg.g, b: bg.b, alpha: bg.alpha },
		},
	});

	return base.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]);
}

// ---------------------------------------------------------------------------
// Operation applier
// ---------------------------------------------------------------------------

async function applyOperation(
	ctx: IExecuteFunctions,
	instance: sharp.Sharp,
	op: IDataObject,
	itemIndex: number,
): Promise<sharp.Sharp> {
	const operation = op.operation as string;

	if (operation === 'blur') {
		const sigma = Math.max(0.3, (op.sigma as number) ?? 3);
		return instance.blur(sigma);
	}

	if (operation === 'border') {
		const bw = (op.borderWidth as number) ?? 20;
		const bh = (op.borderHeight as number) ?? 20;
		const col = hexToRgba((op.borderColor as string) ?? '#000000');
		return instance.extend({
			top: bh,
			bottom: bh,
			left: bw,
			right: bw,
			background: { r: col.r, g: col.g, b: col.b, alpha: col.alpha },
		});
	}

	if (operation === 'composite') {
		const propName = op.dataPropertyNameComposite as string;
		ctx.helpers.assertBinaryData(itemIndex, propName);
		const overlayBuf = await ctx.helpers.getBinaryDataBuffer(itemIndex, propName);
		return instance.composite([{
			input: overlayBuf,
			left: (op.positionX as number) ?? 0,
			top: (op.positionY as number) ?? 0,
			blend: (op.operator as sharp.Blend) ?? 'over',
		}]);
	}

	if (operation === 'create') {
		// Already handled before the loop — skip
		return instance;
	}

	if (operation === 'template') {
		// Already handled before the loop — skip
		return instance;
	}

	if (operation === 'crop') {
		return instance.extract({
			left: (op.positionX as number) ?? 0,
			top: (op.positionY as number) ?? 0,
			width: (op.width as number) ?? 500,
			height: (op.height as number) ?? 500,
		});
	}

	if (operation === 'draw') {
		const meta = await instance.metadata();
		const imgW = meta.width ?? 800;
		const imgH = meta.height ?? 600;
		const fillColor = op.color as string ?? '#ff0000';
		const strokeColor = op.strokeColor as string ?? '#000000';
		const strokeWidth = (op.strokeWidth as number) ?? 0;
		const x1 = (op.startPositionX as number) ?? 0;
		const y1 = (op.startPositionY as number) ?? 0;
		const x2 = (op.endPositionX as number) ?? 100;
		const y2 = (op.endPositionY as number) ?? 100;
		const primitive = op.primitive as string ?? 'rectangle';
		const cr = (op.cornerRadius as number) ?? 0;
		const strokeAttr = strokeWidth > 0 ? `stroke="${strokeColor}" stroke-width="${strokeWidth}"` : 'stroke="none"';

		let shapeSvg = '';
		if (primitive === 'rectangle') {
			const w = Math.abs(x2 - x1);
			const h = Math.abs(y2 - y1);
			shapeSvg = `<rect x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${w}" height="${h}" rx="${cr}" ry="${cr}" fill="${fillColor}" ${strokeAttr}/>`;
		} else if (primitive === 'circle') {
			const cx = (x1 + x2) / 2;
			const cy = (y1 + y2) / 2;
			const rx = Math.abs(x2 - x1) / 2;
			const ry = Math.abs(y2 - y1) / 2;
			shapeSvg = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fillColor}" ${strokeAttr}/>`;
		} else if (primitive === 'line') {
			shapeSvg = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${fillColor}" stroke-width="${Math.max(1, strokeWidth || 2)}" stroke-linecap="round"/>`;
		}

		const svg = `<svg width="${imgW}" height="${imgH}" xmlns="http://www.w3.org/2000/svg">${shapeSvg}</svg>`;
		return instance.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]);
	}

	if (operation === 'flip') {
		return instance.flip();
	}

	if (operation === 'flop') {
		return instance.flop();
	}

	if (operation === 'gamma') {
		const g = (op.gammaValue as number) ?? 2.2;
		return instance.gamma(g);
	}

	if (operation === 'grayscale') {
		return instance.grayscale();
	}

	if (operation === 'normalize') {
		return instance.normalize();
	}

	if (operation === 'resize') {
		const fitMap: Record<string, keyof sharp.FitEnum> = {
			cover: 'cover',
			contain: 'contain',
			fill: 'fill',
			inside: 'inside',
			outside: 'outside',
		};
		const fit = fitMap[(op.resizeOption as string) ?? 'cover'] ?? 'cover';
		const bg = op.resizeBackground ? hexToRgba(op.resizeBackground as string) : { r: 0, g: 0, b: 0, alpha: 1 };
		return instance.resize({
			width: (op.width as number) ?? 1080,
			height: (op.height as number) ?? 1080,
			fit,
			background: { r: bg.r, g: bg.g, b: bg.b, alpha: bg.alpha },
			withoutEnlargement: false,
		});
	}

	if (operation === 'rotate') {
		const bg = hexToRgba((op.backgroundColor as string) ?? '#00000000');
		return instance.rotate((op.rotate as number) ?? 0, {
			background: { r: bg.r, g: bg.g, b: bg.b, alpha: bg.alpha },
		});
	}

	if (operation === 'sepia') {
		// Sepia via colour recombination matrix
		return instance.recomb([
			[0.3588, 0.7044, 0.1368],
			[0.2990, 0.5870, 0.1140],
			[0.2392, 0.4696, 0.0912],
		]);
	}

	if (operation === 'sharpen') {
		const sigma = (op.sharpenSigma as number) ?? 1;
		const flat = (op.sharpenFlat as number) ?? 1;
		const jagged = (op.sharpenJagged as number) ?? 2;
		return instance.sharpen({ sigma, m1: flat, m2: jagged });
	}

	if (operation === 'shear') {
		const dx = (op.degreesX as number) ?? 0;
		const dy = (op.degreesY as number) ?? 10;
		// Shear via affine transform: [a, b, c, d] where shear-x = tan(dx), shear-y = tan(dy)
		const tanX = Math.tan((dx * Math.PI) / 180);
		const tanY = Math.tan((dy * Math.PI) / 180);
		return instance.affine([1, tanX, tanY, 1], { background: '#00000000' });
	}

	if (operation === 'text') {
		const meta = await instance.metadata();
		const imgW = meta.width ?? 800;
		const imgH = meta.height ?? 600;

		const rawText = (op.text as string) ?? '';
		const fontSize = (op.fontSize as number) ?? 48;
		const fontWeight = (op.fontWeight as string) ?? '400';

		// Max/Min Line Length: for Percent/Pixels modes, wrap by REAL estimated
		// pixel width directly (measuring the actual characters in each line via
		// estimateTextWidth), not by converting to an average-derived character
		// count first — that two-step conversion is what caused words like
		// "listening" (narrow-letter-heavy) to wrap earlier than necessary.
		// "Characters" mode is intentionally still a literal character count.
		const lineLengthMode = ci(op.lineLengthMode, 'chars');
		const weightNum = parseInt(fontWeight, 10) || 400;
		const boldMultiplier = 1 + Math.max(0, (weightNum - 400) / 500) * 0.15; // 1.0 at 400 → ~1.15 at 900
		const measure = (s: string) => estimateTextWidth(s, fontSize, boldMultiplier);

		let lineLen = 0; // used only for 'chars' mode
		let wrapWidthPx: number | null = null;
		if (lineLengthMode === 'percent') {
			const pct = (op.lineLengthPercent as number) ?? 80;
			wrapWidthPx = imgW * (pct / 100);
		} else if (lineLengthMode === 'pixels') {
			wrapWidthPx = (op.lineLengthPixels as number) ?? 800;
		} else {
			lineLen = (op.lineLength as number) ?? 40;
		}

		const textOverflow = ci(op.textOverflow, 'visible');

		// Min Line Length: same mode system as Max, plus "Auto" to disable it.
		const minLineLengthMode = ci(op.minLineLengthMode, 'auto');
		let minLineLen = 0;
		let minWrapWidthPx: number | null = null;
		if (minLineLengthMode === 'percent') {
			minWrapWidthPx = imgW * ((op.minLineLengthPercent as number) ?? 40) / 100;
		} else if (minLineLengthMode === 'pixels') {
			minWrapWidthPx = (op.minLineLengthPixels as number) ?? 400;
		} else if (minLineLengthMode === 'chars') {
			minLineLen = (op.minLineLength as number) ?? 20;
			if (wrapWidthPx !== null) {
				// Max is Percent/Pixels (pixel-space) but Min is Characters — bridge
				// the character count into an estimated pixel width so the minimum
				// still actually applies, instead of silently being ignored.
				minWrapWidthPx = measure('n'.repeat(minLineLen));
			}
		}

		let wrapped: string;
		if (wrapWidthPx !== null) {
			// Percent/Pixels mode — genuine pixel-width wrapping.
			wrapped =
				minWrapWidthPx !== null
					? wrapTextByWidthWithMin(rawText, wrapWidthPx, minWrapWidthPx, measure)
					: wrapTextByWidth(rawText, wrapWidthPx, measure);
		} else {
			// Characters mode — literal character-count wrapping, as before.
			wrapped = minLineLengthMode === 'auto' ? wrapText(rawText, lineLen) : wrapTextWithMin(rawText, lineLen, minLineLen);
		}
		if (textOverflow === 'wrap') {
			// Word-wrapping alone can't break a single long token with no spaces
			// (e.g. "Baqarah(12ioioio14)ewewe") — hard-break anything still over
			// the limit, using real pixel-width measurement when available.
			wrapped =
				wrapWidthPx !== null
					? forceBreakLongLinesByWidth(wrapped, wrapWidthPx, measure)
					: forceBreakLongLines(wrapped, lineLen);
		}
		const lines = wrapped.split('\n');

		const fontColor = (op.fontColor as string) ?? '#ffffff';
		const fontStyle = ci(op.fontStyle, 'normal');
		const textAlign = ci(op.textAlign, 'center');
		const stretchLastLine = (op.justifyStretchLastLine as boolean) === true;
		const lineHeight = ((op.lineHeight as number) ?? 1.4) * fontSize;

		// Gravity: a pure anchor point on the FULL image (not a sub-region).
		// Position X/Y are pixel offsets from that anchor — positive X = right,
		// positive Y = down, regardless of which gravity is chosen. Text Align
		// controls how the text block is aligned horizontally around the final X.
		const gravity = ci(op.gravity, 'center');
		const boxAnchor = ci(op.boxAnchor, 'center');
		const offsetX = (op.positionX as number) ?? 0;
		const offsetY = (op.positionY as number) ?? 0;

		let anchorX = imgW / 2;
		let anchorY = imgH / 2;
		if (gravity === 'northwest' || gravity === 'west' || gravity === 'southwest') {
			anchorX = 0;
		} else if (gravity === 'northeast' || gravity === 'east' || gravity === 'southeast') {
			anchorX = imgW;
		}
		if (gravity === 'northwest' || gravity === 'north' || gravity === 'northeast') {
			anchorY = 0;
		} else if (gravity === 'southwest' || gravity === 'south' || gravity === 'southeast') {
			anchorY = imgH;
		}

		const posX = anchorX + offsetX;
		const posY = anchorY + offsetY;

		const textOpacity = ((op.textOpacity as number) ?? 100) / 100;
		const textDecoration = ci(op.textDecoration, 'none');

		const strokeEnabled = (op.textStroke as boolean) === true;
		const strokeColor = (op.strokeColor as string) ?? '#000000';
		const strokeWidth = (op.strokeWidth as number) ?? 1;

		const shadow = (op.textShadow as boolean) ?? false;
		const shadowColor = (op.shadowColor as string) ?? '#000000';
		const shadowOpacity = ((op.shadowOpacity as number) ?? 60) / 100;
		const shadowBlur = (op.shadowBlur as number) ?? 3;
		const shadowOffsetX = (op.shadowOffsetX as number) ?? 2;
		const shadowOffsetY = (op.shadowOffsetY as number) ?? 2;

		const bgEnabled = (op.textBackground as boolean) === true;
		const backgroundStyle = ci(op.backgroundStyle, 'solid');
		const bgColor = (op.textBackgroundColor as string) ?? '#000000';
		const glassFrost = ((op.glassFrost as number) ?? 50) / 100;
		const bgPaddingRaw = (op.textBackgroundPadding as string) ?? '12';
		const pad = parsePadding(bgPaddingRaw);
		const bgBorderEnabled = (op.textBackgroundBorder as boolean) === true;
		const bgBorderColor = (op.textBackgroundBorderColor as string) ?? '#FFFFFF';
		const bgBorderWidth = (op.textBackgroundBorderWidth as number) ?? 2;
		const bgBorderRadiusUnit = ci(op.textBackgroundBorderRadiusUnit, 'px');
		const bgBorderRadiusValue = (op.textBackgroundBorderRadius as number) ?? 0;

		const boxWidthMode = ci(op.boxWidthMode, 'auto');
		const boxWidthUnit = ci(op.boxWidthUnit, 'px');
		const boxHeightMode = ci(op.boxHeightMode, 'auto');
		const boxHeightUnit = ci(op.boxHeightUnit, 'px');

		const shadowFilter = shadow
			? `<filter id="ts" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="${shadowOffsetX}" dy="${shadowOffsetY}" stdDeviation="${shadowBlur}" flood-color="${shadowColor}" flood-opacity="${shadowOpacity}"/></filter>`
			: '';
		const filterAttr = shadow ? 'filter="url(#ts)"' : '';

		const strokeAttr = strokeEnabled
			? `stroke="${strokeColor}" stroke-width="${strokeWidth}" paint-order="stroke fill"`
			: '';

		const decorationAttr =
			textDecoration !== 'none' ? `text-decoration="${textDecoration}"` : '';

		// ── Box geometry ──────────────────────────────────────────────────────
		// Width and Height each independently choose Auto (fit to text) or Custom
		// (fixed size, in px or % of the image's own width/height).
		const ascentRatio = 0.8;
		const descentRatio = 0.2;
		const longestLine = lines.reduce((max, l) => (measure(l) > measure(max) ? l : max), lines[0] ?? '');
		// Auto width: if Max Line Length is set in Percent/Pixels mode, use that
		// exact wrap width as the box's width — this is the real intended
		// container width. Using the actual longest *rendered* line instead
		// (which word-wrap will almost always fall short of, since it can only
		// break at whole words) is why "Max = 100%" previously still produced
		// a narrower, centered-looking box instead of true edge-to-edge.
		// Chars mode has no defined pixel width to anchor to, so it falls back
		// to a real per-character width estimate of the actual longest line.
		const autoWidth = wrapWidthPx ?? measure(longestLine);
		const autoHeight = fontSize * (ascentRatio + descentRatio) + (lines.length - 1) * lineHeight;

		let boxWidth: number;
		if (boxWidthMode === 'custom') {
			const raw = (op.boxWidthCustom as number) ?? 800;
			boxWidth = boxWidthUnit === 'percent' ? imgW * (raw / 100) : raw;
		} else {
			boxWidth = autoWidth;
		}

		let boxHeight: number;
		if (boxHeightMode === 'custom') {
			const raw = (op.boxHeightCustom as number) ?? 200;
			boxHeight = boxHeightUnit === 'percent' ? imgH * (raw / 100) : raw;
		} else {
			boxHeight = autoHeight;
		}

		// Box Anchor: which point of the box sits at (posX, posY). This is
		// independent of Text Align — Text Align only controls how each line
		// aligns WITHIN the box's own width, exactly like CSS text-align inside
		// a container. Box Anchor decides where that container itself sits.
		let boxLeft = posX;
		if (boxAnchor === 'north' || boxAnchor === 'center' || boxAnchor === 'south') {
			boxLeft = posX - boxWidth / 2;
		} else if (boxAnchor === 'northeast' || boxAnchor === 'east' || boxAnchor === 'southeast') {
			boxLeft = posX - boxWidth;
		}
		let boxTop = posY;
		if (boxAnchor === 'west' || boxAnchor === 'center' || boxAnchor === 'east') {
			boxTop = posY - boxHeight / 2;
		} else if (boxAnchor === 'southwest' || boxAnchor === 'south' || boxAnchor === 'southeast') {
			boxTop = posY - boxHeight;
		}

		// Text position WITHIN the box, per Text Align (like CSS text-align).
		// Justify uses text-anchor="start" and stretches each line (except the
		// last) to the full box width via SVG's textLength/lengthAdjust — the
		// standard technique for justified text in SVG.
		let textX = boxLeft;
		if (textAlign === 'center') textX = boxLeft + boxWidth / 2;
		else if (textAlign === 'right') textX = boxLeft + boxWidth;

		const svgTextAnchor = textAlign === 'center' ? 'middle' : textAlign === 'right' ? 'end' : 'start';

		const firstLineBaselineY = boxTop + fontSize * ascentRatio;

		// Justify is built via manual per-word absolute positioning rather than
		// SVG's textLength/lengthAdjust attributes — those aren't reliably
		// honored by every SVG renderer (including librsvg, which Sharp uses),
		// whereas plain per-tspan x-coordinates are universally supported.
		const tspanParts: string[] = [];
		lines.forEach((line, i) => {
			const dy = i === 0 ? 0 : lineHeight;
			const isBlank = line.length === 0;
			// The last line of EVERY paragraph stays unstretched by default, not
			// just the very last line of the whole text — otherwise a short final
			// sentence right before a blank-line paragraph break gets awkwardly
			// stretched, which is universally considered bad typography.
			const isLastLineOfParagraph = i === lines.length - 1 || lines[i + 1].length === 0;
			const shouldJustifyThisLine =
				textAlign === 'justify' && !isBlank && (!isLastLineOfParagraph || stretchLastLine);
			const words = line.split(' ').filter((w) => w.length > 0);

			if (shouldJustifyThisLine && words.length > 1) {
				const wordWidths = words.map((w) => measure(w));
				const totalWordsWidth = wordWidths.reduce((a, b) => a + b, 0);
				const gapCount = words.length - 1;
				const gapWidth = Math.max(0, (boxWidth - totalWordsWidth) / gapCount);
				let cursorX = boxLeft;
				words.forEach((word, wi) => {
					const wordDy = wi === 0 ? dy : 0;
					tspanParts.push(`<tspan x="${cursorX}" dy="${wordDy}">${escapeSvg(word)}</tspan>`);
					cursorX += wordWidths[wi] + gapWidth;
				});
			} else {
				// Single-word lines can't be justified (no gaps to stretch) —
				// render normally, same as non-justify alignments.
				const tspanX = textAlign === 'justify' ? boxLeft : textX;
				// A blank line (from a double line-break / empty paragraph) produces
				// an empty <tspan>, which some SVG renderers don't reliably advance
				// the line height for since there are no glyphs to lay out. A
				// non-breaking space forces it to still take up a full line's
				// worth of vertical space.
				const content = isBlank ? '&#160;' : escapeSvg(line);
				tspanParts.push(`<tspan x="${tspanX}" dy="${dy}">${content}</tspan>`);
			}
		});
		const tspans = tspanParts.join('');

		let bgRect = '';
		let glassLayer = '';
		let radiusPx = 0;
		let rectX = 0, rectY = 0, rectW = 0, rectH = 0;

		if (bgEnabled) {
			rectX = boxLeft - pad.left;
			rectY = boxTop - pad.top;
			rectW = boxWidth + pad.left + pad.right;
			rectH = boxHeight + pad.top + pad.bottom;

			// Percent radius is relative to the box's own size (0% = sharp,
			// 100% = fully rounded/pill), so it scales with the box automatically.
			radiusPx =
				bgBorderRadiusUnit === 'percent'
					? (bgBorderRadiusValue / 100) * (Math.min(rectW, rectH) / 2)
					: bgBorderRadiusValue;

			const bgStrokeAttr = bgBorderEnabled
				? `stroke="${bgBorderColor}" stroke-width="${bgBorderWidth}"`
				: 'stroke="none"';

			if (backgroundStyle === 'glass' && glassFrost > 0) {
				// Genuine frosted-glass: crop the region of the CURRENT image behind
				// the box, blur it, then lay it back down clipped to the (rounded)
				// box shape, with a tinted semi-transparent overlay on top. Frost
				// controls both the tint opacity and how heavy the blur is.
				const visLeft = Math.max(0, rectX);
				const visTop = Math.max(0, rectY);
				const visRight = Math.min(imgW, rectX + rectW);
				const visBottom = Math.min(imgH, rectY + rectH);
				const clampX = Math.round(visLeft);
				const clampY = Math.round(visTop);
				const clampW = Math.max(0, Math.round(visRight - visLeft));
				const clampH = Math.max(0, Math.round(visBottom - visTop));

				if (clampW > 0 && clampH > 0) {
					const blurSigma = Math.max(0.3, glassFrost * 15); // heavier frost = heavier blur
					const baseBuffer = await instance.clone().png().toBuffer();
					const blurredCrop = await sharp(baseBuffer)
						.extract({ left: clampX, top: clampY, width: clampW, height: clampH })
						.blur(blurSigma)
						.png()
						.toBuffer();
					const blurredB64 = blurredCrop.toString('base64');

					glassLayer = `
  <defs><clipPath id="glassClip"><rect x="${clampX}" y="${clampY}" width="${clampW}" height="${clampH}" rx="${radiusPx}" ry="${radiusPx}"/></clipPath></defs>
  <image x="${clampX}" y="${clampY}" width="${clampW}" height="${clampH}" href="data:image/png;base64,${blurredB64}" clip-path="url(#glassClip)"/>
  <rect x="${rectX}" y="${rectY}" width="${rectW}" height="${rectH}" rx="${radiusPx}" ry="${radiusPx}" fill="${bgColor}" fill-opacity="${glassFrost}" ${bgStrokeAttr}/>`;
				} else {
					// Box is entirely outside the canvas — nothing to blur, fall back
					// to a plain tinted rect so it doesn't just silently disappear.
					glassLayer = `<rect x="${rectX}" y="${rectY}" width="${rectW}" height="${rectH}" rx="${radiusPx}" ry="${radiusPx}" fill="${bgColor}" fill-opacity="${glassFrost}" ${bgStrokeAttr}/>`;
				}
			} else if (backgroundStyle === 'solid') {
				bgRect = `<rect x="${rectX}" y="${rectY}" width="${rectW}" height="${rectH}" rx="${radiusPx}" ry="${radiusPx}" fill="${bgColor}" ${bgStrokeAttr}/>`;
			}
			// backgroundStyle === 'glass' && glassFrost === 0 → nothing drawn at all,
			// box is genuinely invisible, matching "0 = fully transparent".
		}

		// Clip mode: hide any text overflowing past the box bounds — uses the
		// padded background rect if one exists, otherwise the raw text box.
		let clipDefs = '';
		let clipAttr = '';
		if (textOverflow === 'clip') {
			const clipX = bgEnabled ? rectX : boxLeft;
			const clipY = bgEnabled ? rectY : boxTop;
			const clipW = bgEnabled ? rectW : boxWidth;
			const clipH = bgEnabled ? rectH : boxHeight;
			const clipR = bgEnabled ? radiusPx : 0;
			clipDefs = `<clipPath id="textOverflowClip"><rect x="${clipX}" y="${clipY}" width="${clipW}" height="${clipH}" rx="${clipR}" ry="${clipR}"/></clipPath>`;
			clipAttr = 'clip-path="url(#textOverflowClip)"';
		}

		const svg = `<svg width="${imgW}" height="${imgH}" xmlns="http://www.w3.org/2000/svg">
  <defs>${shadowFilter}${clipDefs}</defs>
  ${bgRect}
  ${glassLayer}
  <text
    x="${textX}" y="${firstLineBaselineY}"
    font-family="Arial, Helvetica, sans-serif"
    font-size="${fontSize}"
    font-weight="${fontWeight}"
    font-style="${fontStyle}"
    fill="${fontColor}"
    fill-opacity="${textOpacity}"
    text-anchor="${svgTextAnchor}"
    ${decorationAttr}
    ${strokeAttr}
    ${filterAttr}
    ${clipAttr}
  >${tspans}</text>
</svg>`;

		return instance.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]);
	}

	if (operation === 'tint') {
		const col = hexToRgba((op.tintColor as string) ?? '#ff6b35');
		return instance.tint({ r: col.r, g: col.g, b: col.b });
	}

	if (operation === 'transparent') {
		// Flatten to ensure RGBA, then threshold pixels near the target colour
		const targetCol = hexToRgba((op.transparentColor as string) ?? '#ffffff');
		const tolerance = (op.tolerance as number) ?? 30;

		// We use sharp's raw pixel manipulation to set matching pixels to transparent
		const meta = await instance.metadata();
		const w = meta.width ?? 0;
		const h = meta.height ?? 0;

		const rawData = await instance.ensureAlpha().raw().toBuffer();
		const pixels = new Uint8Array(rawData);

		for (let j = 0; j < w * h; j++) {
			const idx = j * 4;
			const dr = Math.abs(pixels[idx] - targetCol.r);
			const dg = Math.abs(pixels[idx + 1] - targetCol.g);
			const db = Math.abs(pixels[idx + 2] - targetCol.b);
			if (dr <= tolerance && dg <= tolerance && db <= tolerance) {
				pixels[idx + 3] = 0;
			}
		}

		return sharp(Buffer.from(pixels), { raw: { width: w, height: h, channels: 4 } });
	}

	if (operation === 'watermark') {
		const wmProp = (op.watermarkProperty as string) ?? 'watermark';
		ctx.helpers.assertBinaryData(itemIndex, wmProp);
		const wmBuf = await ctx.helpers.getBinaryDataBuffer(itemIndex, wmProp);

		const meta = await instance.metadata();
		const imgW = meta.width ?? 800;
		const imgH = meta.height ?? 600;
		const scalePercent = (op.watermarkScale as number) ?? 20;
		const opacity = Math.min(1, Math.max(0, ((op.watermarkOpacity as number) ?? 50) / 100));
		const gravity = (op.watermarkGravity as string) ?? 'southeast';

		// Scale watermark
		const maxDim = Math.round(Math.max(imgW, imgH) * (scalePercent / 100));
		const wmResized = await sharp(wmBuf)
			.resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true })
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });

		// Apply opacity to alpha channel
		const rawPixels = new Uint8Array(wmResized.data);
		for (let j = 0; j < rawPixels.length / 4; j++) {
			rawPixels[j * 4 + 3] = Math.round(rawPixels[j * 4 + 3] * opacity);
		}

		const wmW = wmResized.info.width;
		const wmH = wmResized.info.height;
		const wmProcessed = sharp(Buffer.from(rawPixels), { raw: { width: wmW, height: wmH, channels: 4 } }).png();

		return instance.composite([{
			input: await wmProcessed.toBuffer(),
			gravity: gravity as sharp.Gravity,
			blend: 'over',
		}]);
	}

	// Unknown operation — return unchanged (pass-through)
	return instance;
}
