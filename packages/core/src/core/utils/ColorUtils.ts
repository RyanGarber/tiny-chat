interface Rgba {
	r: number;
	g: number;
	b: number;
	a?: number; // 0–1
}

type Color = string | Rgba;

export const ColorUtils = {
	/**
	 * Parses an {r,g,b,a} object, or any r, g, or b value into hex.
	 */
	toHex: (value: Rgba | number): string => {
		if (typeof value === "object") {
			return `${ColorUtils.toHex(value.r)}${ColorUtils.toHex(value.g)}${ColorUtils.toHex(value.b)}${value.a ? `${ColorUtils.toHex(value.a * 255)}` : ""}`;
		}
		return ColorUtils.clamp255(value).toString(16).padStart(2, "0");
	},

	/**
	 * Parses a hex string (#RGB, #RGBA, #RRGGBB, #RRGGBBAA),
	 * an rgb()/rgba() CSS string, or an {r,g,b,a} object into RGBA.
	 */
	toRgba: (value: Color): Rgba & { a: number } => {
		if (typeof value === "object") {
			return {
				r: ColorUtils.clamp255(value.r),
				g: ColorUtils.clamp255(value.g),
				b: ColorUtils.clamp255(value.b),
				a: value.a === undefined ? 1 : ColorUtils.clamp01(value.a),
			};
		}

		value = value.trim();

		// rgb()/rgba() string
		const rgbMatch = value.match(
			/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i,
		);
		if (rgbMatch) {
			return {
				r: ColorUtils.clamp255(parseFloat(rgbMatch[1])),
				g: ColorUtils.clamp255(parseFloat(rgbMatch[2])),
				b: ColorUtils.clamp255(parseFloat(rgbMatch[3])),
				a:
					rgbMatch[4] === undefined
						? 1
						: ColorUtils.clamp01(parseFloat(rgbMatch[4])),
			};
		}

		if (value === "transparent") value = "#80808080";

		// hex string
		if (value.startsWith("#")) {
			value = value.split(";")[0];

			let hex = value.slice(1);

			// expand shorthand #RGB or #RGBA -> #RRGGBB / #RRGGBBAA
			if (hex.length === 3 || hex.length === 4) {
				hex = hex
					.split("")
					.map((c) => c + c)
					.join("");
			}

			if (hex.length !== 6 && hex.length !== 8) {
				throw new Error(`Invalid hex color: ${value}`);
			}

			const r = parseInt(hex.slice(0, 2), 16);
			const g = parseInt(hex.slice(2, 4), 16);
			const b = parseInt(hex.slice(4, 6), 16);
			const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;

			return { r, g, b, a };
		}

		throw new Error(`Unrecognized color format: ${value}`);
	},

	/**
	 * Blends two colors using alpha compositing ("source over" — b is placed on top of a).
	 * Accepts hex, rgb()/rgba() strings, or {r,g,b,a} objects.
	 * Returns a hex string (#RRGGBB, or #RRGGBBAA if the resulting alpha < 1).
	 */
	blend: (colorA: Color, colorB: Color): string => {
		const a = ColorUtils.toRgba(colorA);
		const b = ColorUtils.toRgba(colorB);

		const outA = b.a + a.a * (1 - b.a);

		if (outA === 0) {
			return "#00000000";
		}

		const r = (b.r * b.a + a.r * a.a * (1 - b.a)) / outA;
		const g = (b.g * b.a + a.g * a.a * (1 - b.a)) / outA;
		const bl = (b.b * b.a + a.b * a.a * (1 - b.a)) / outA;

		const hex = `#${ColorUtils.toHex(r)}${ColorUtils.toHex(g)}${ColorUtils.toHex(bl)}`;

		return outA < 1 ? hex + ColorUtils.toHex(outA * 255) : hex;
	},

	/**
	 * Linearly interpolates between two colors (including alpha).
	 * Accepts hex, rgb()/rgba() strings, or {r,g,b,a} objects.
	 * Returns a hex string (#RRGGBB, or #RRGGBBAA if the resulting alpha < 1).
	 */
	lerp: (colorA: Color, colorB: Color, t: number): string => {
		const a = ColorUtils.toRgba(colorA);
		const b = ColorUtils.toRgba(colorB);
		const tt = ColorUtils.clamp01(t);

		const r = a.r + (b.r - a.r) * tt;
		const g = a.g + (b.g - a.g) * tt;
		const bl = a.b + (b.b - a.b) * tt;
		const al = a.a + (b.a - a.a) * tt;

		const hex = `#${ColorUtils.toHex(r)}${ColorUtils.toHex(g)}${ColorUtils.toHex(bl)}`;

		return al < 1 ? hex + ColorUtils.toHex(al * 255) : hex;
	},

	clamp01: (value: number) => {
		return Math.min(1, Math.max(0, value));
	},

	clamp255: (value: number) => {
		return Math.min(255, Math.max(0, Math.round(value)));
	},
} as const;
