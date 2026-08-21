/**
 * The kinds of run a plain text buffer only ever handles whole. Each one is
 * also the label the run is painted under.
 */
export type AtomKind = "command" | "attachment" | "paste";

/**
 * A run of a plain text buffer that stands in for something longer.
 *
 * Commands, attachments and long pastes all travel with a message as Markdown
 * directives — which are far too long to type against. The buffer holds
 * {@link Atom.text} in its place, and the Markdown is written back in at
 * serialization.
 */
export interface Atom {
	kind: AtomKind;
	/** What stands in the buffer, which is also what identifies the atom. */
	text: string;
	/** The Markdown the atom is written back out as. */
	markdown: string;
}

/**
 * The forms an atom will take in the buffer, shortest first. Index 0 is the
 * one it is given; the rest are only reached when a shorter form is already
 * taken by an atom standing for something else.
 */
export type AtomText = (index: number) => string;

/** An atom found in a buffer, as the range it takes up. */
export interface AtomToken extends Atom {
	start: number;
	end: number;
}
