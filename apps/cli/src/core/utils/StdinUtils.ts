import { PassThrough } from "node:stream";
import { MouseUtils } from "./MouseUtils.ts";

/** The terminal's own input, before the mouse reports are taken out of it. */
let source: NodeJS.ReadStream | null = null;

/** The last of that input to arrive, which is the press being dispatched. */
let last = "";

/**
 * An arrow under a second escape, which is what a terminal sending Option as
 * Meta makes of a combination it has no mapping of its own for.
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: terminal hell
const ESCAPED_ARROW = /\x1b\x1b\[[A-D]/;

export const StdinUtils = {
	/**
	 * Splits mouse reports out of the terminal's input.
	 *
	 * Ink has no idea what a mouse report is, so it hands the escape sequence to
	 * input handlers as plain text, which a text field then types into its value
	 * and steps its cursor over — undoing whatever the click itself just did.
	 * Reading them here, one step ahead of Ink, keeps them out of its input
	 * entirely, and lets {@link useMouse} see the click before the keystrokes it
	 * arrived with are dispatched.
	 */
	filter: (input: NodeJS.ReadStream): NodeJS.ReadStream => {
		source = input;

		const output = new PassThrough({ encoding: "utf8" });

		input.on("data", (chunk: string | Buffer) => {
			last = chunk.toString();

			const text = MouseUtils.strip(last);
			if (text) output.write(text);
		});

		// Raw mode, the TTY flag and the reference count all belong to the real
		// handle, which is the one holding the terminal open.
		return Object.assign(output, {
			isTTY: input.isTTY,
			isRaw: input.isRaw,
			setRawMode: (mode: boolean) => {
				input.setRawMode(mode);
				return output as unknown as NodeJS.ReadStream;
			},
			ref: () => {
				input.ref();
				return output as unknown as NodeJS.ReadStream;
			},
			unref: () => {
				input.unref();
				return output as unknown as NodeJS.ReadStream;
			},
		}) as unknown as NodeJS.ReadStream;
	},

	/**
	 * The stream mouse reports are read from, once {@link StdinUtils.filter} has
	 * taken them out of the one Ink reads.
	 */
	source: () => source,

	/**
	 * Whether the press being dispatched arrived as an arrow under a second
	 * escape, `ESC ESC [ A` and its three siblings.
	 *
	 * Ink reads that as an arrow under Alt, which is also what a terminal that
	 * encodes its modifiers sends for Alt and an arrow — the same key with the
	 * same meaning. macOS Terminal is the odd one out: it has a mapping of its
	 * own for Option and an arrow, the Emacs `ESC b` and `ESC f`, and none at
	 * all for Option, Shift and an arrow — which is the press that falls through
	 * to the escape and the arrow underneath it. Telling the two shapes apart is
	 * the only way to know Shift was held there, since Terminal never says so.
	 */
	isEscapedArrow: () => ESCAPED_ARROW.test(last),
} as const;
