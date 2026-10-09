import { ActionIcon, Group, Paper, Text, TextInput } from "@mantine/core";
import { CaretDownIcon, CaretUpIcon, XIcon } from "@phosphor-icons/react";
import { type RefObject, useEffect, useEffectEvent, useRef } from "react";
import { useFindInElement } from "#gui/features/find/hooks/useFindInElement.ts";
import "#gui/features/find/styles/find.css";

const isFindKey = (event: KeyboardEvent) =>
	(event.metaKey || event.ctrlKey) &&
	!event.altKey &&
	event.key.toLowerCase() === "f";

const isStepKey = (event: KeyboardEvent) =>
	(event.metaKey || event.ctrlKey) &&
	!event.altKey &&
	event.key.toLowerCase() === "g";

/**
 * A find bar for whatever `targetRef` points at, opened with Ctrl/Cmd+F while
 * the focus is inside it, and drawn in its top right corner — so the target
 * has to be positioned (`position: relative` or the like) and hold this.
 *
 * Bars nest: the innermost target holding the focus takes the key. With
 * `global`, this bar also takes it while nothing has the focus, which is what
 * a bar over the whole window wants.
 */
export default function Find({
	targetRef,
	global = false,
	disabled = false,
}: {
	targetRef: RefObject<HTMLElement | null>;
	global?: boolean;
	/** Leaves the key to the browser and anything else listening for it. */
	disabled?: boolean;
}) {
	const barRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	/** What had the focus before the bar took it, to hand it back on close. */
	const returnRef = useRef<HTMLElement | null>(null);

	const find = useFindInElement({ targetRef, ignoreRef: barRef });
	const { isOpen } = find;

	// The input focuses itself as the bar opens, and selects its query whenever
	// it is focused, ready to be typed over.
	const focus = () => {
		inputRef.current?.focus();
		inputRef.current?.select();
	};

	const close = () => {
		find.close();
		returnRef.current?.focus();
		returnRef.current = null;
	};

	const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
		if (event.defaultPrevented) return;
		if (isFindKey(event)) {
			event.preventDefault();
			if (!isOpen) {
				const active = document.activeElement;
				returnRef.current =
					active instanceof HTMLElement && active !== document.body
						? active
						: null;
				find.open();
			} else focus();
		} else if (isOpen && isStepKey(event)) {
			event.preventDefault();
			if (event.shiftKey) find.previous();
			else find.next();
		}
	});

	useEffect(() => {
		const target = targetRef.current;
		if (disabled || !target) return;
		const listener = (event: KeyboardEvent) => onKeyDown(event);
		// Only keys pressed with nothing focused reach the document unseen by any
		// target; everything else bubbles through the innermost bar first.
		const globalListener = (event: KeyboardEvent) => {
			if (event.target === document.body) onKeyDown(event);
		};
		target.addEventListener("keydown", listener);
		if (global) document.addEventListener("keydown", globalListener);
		return () => {
			target.removeEventListener("keydown", listener);
			document.removeEventListener("keydown", globalListener);
		};
	}, [targetRef, global, disabled]);

	if (!isOpen) return null;

	return (
		<Paper
			ref={barRef}
			pos="absolute"
			top="calc(var(--mantine-spacing-xs) + env(safe-area-inset-top, 0px))"
			right="calc(var(--mantine-spacing-xs) + env(safe-area-inset-right, 0px))"
			w={300}
			maw="calc(100vw - 2 * var(--mantine-spacing-xs))"
			p={4}
			shadow="md"
			withBorder
			style={{ zIndex: "var(--mantine-z-index-max)" }}
			role="search"
		>
			<Group gap={4} wrap="nowrap">
				<TextInput
					ref={inputRef}
					size="xs"
					variant="unstyled"
					px="xs"
					flex={1}
					miw={0}
					placeholder="Find"
					aria-label="Find"
					autoFocus
					onFocus={(event) => event.currentTarget.select()}
					value={find.query}
					onChange={(event) => find.setQuery(event.currentTarget.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							if (event.shiftKey) find.previous();
							else find.next();
						} else if (event.key === "Escape") {
							event.preventDefault();
							close();
						}
					}}
				/>
				{/* Only as wide as the count, the input taking whatever it leaves. */}
				<Text
					size="xs"
					c="dimmed"
					style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}
					aria-live="polite"
				>
					{find.label}
				</Text>
				<ActionIcon
					variant="subtle"
					color="gray"
					aria-label="Previous match"
					disabled={!find.matches.length}
					onClick={find.previous}
				>
					<CaretUpIcon size={16} />
				</ActionIcon>
				<ActionIcon
					variant="subtle"
					color="gray"
					aria-label="Next match"
					disabled={!find.matches.length}
					onClick={find.next}
				>
					<CaretDownIcon size={16} />
				</ActionIcon>
				<ActionIcon
					variant="subtle"
					color="gray"
					aria-label="Close"
					onClick={close}
				>
					<XIcon size={16} />
				</ActionIcon>
			</Group>
		</Paper>
	);
}
