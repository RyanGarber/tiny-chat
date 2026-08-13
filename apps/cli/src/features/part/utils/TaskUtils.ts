import { ColorUtils } from "@tiny-chat/core/src/core/utils/ColorUtils.ts";
import chalk, { type ChalkInstance } from "chalk";

const SHIMMER_BASE = "#666666";
const SHIMMER_HIGHLIGHT = "#ffffff";
const SHIMMER_BAND_WIDTH = 6;
const SHIMMER_SPEED = 1;

export type StatusPart = { text: string; style?: ChalkInstance };

export const TaskUtils = {
	smoothstep: (t: number) => {
		return t * t * (3 - 2 * t);
	},

	style: (
		parts: StatusPart[],
		apply?: (style: ChalkInstance) => ChalkInstance,
	): (StatusPart & { style: ChalkInstance })[] => {
		return parts.map((part) => {
			const style = part.style ?? chalk;
			return {
				...part,
				style: apply?.(style) ?? style,
			};
		});
	},

	plain: ({
		parts,
		style,
		join = "",
	}: {
		parts: StatusPart[];
		style?: (style: ChalkInstance) => ChalkInstance;
		join?: string;
	}): string => {
		return TaskUtils.style(parts, style)
			.map(({ text, style }) => style(text))
			.join(join);
	},

	shimmer: ({
		parts,
		style,
		time,
		offset = 0,
	}: {
		parts: StatusPart[];
		style?: (style: ChalkInstance) => ChalkInstance;
		time: number;
		offset?: number;
	}): string => {
		const characters = parts.flatMap((part, partIndex) =>
			part.text
				.split("")
				.map((character, characterIndex): StatusPart & { join: boolean } => ({
					text: character,
					style: style?.(part.style ?? chalk),
					join: partIndex > 0 && characterIndex === 0,
				})),
		);
		const period = characters.length + SHIMMER_BAND_WIDTH * 2;
		const speed = (period / 2) * SHIMMER_SPEED;
		const distance = (time / 1000) * speed + offset;
		const center = (distance % period) - SHIMMER_BAND_WIDTH;

		return characters
			.flatMap((part, i) => {
				const delta = Math.abs(i - center);
				const falloff = TaskUtils.smoothstep(
					Math.max(0, 1 - delta / SHIMMER_BAND_WIDTH),
				);

				return (
					(part.join
						? TaskUtils.plain({ parts: [{ ...part, text: " " }] })
						: "") +
					TaskUtils.plain({
						parts: [part],
						style: (style) =>
							style.hex(
								ColorUtils.lerp(SHIMMER_BASE, SHIMMER_HIGHLIGHT, falloff),
							),
					})
				);
			})
			.join("");
	},
} as const;
