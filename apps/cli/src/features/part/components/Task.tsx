import { ThemeContext } from "@tiny-chat/client/src/core/components/ThemeContext.tsx";
import { useAnimation } from "ink";
import {
	createContext,
	type ReactNode,
	useContext,
	useMemo,
	useState,
} from "react";
import Box, { type BoxProps } from "../../../core/components/Box.tsx";
import Text from "../../../core/components/Text.tsx";
import { useMouseInput } from "../../../core/hooks/useMouseInput.ts";
import { type StatusPart, TaskUtils } from "../utils/TaskUtils.ts";

interface TaskContext {
	expanded: boolean;
	setExpanded?: (value: boolean) => void;
	taskProps?: BoxProps;
	detailsProps?: BoxProps;
}

const TaskContext = createContext<TaskContext>({ expanded: false });

function Task({
	children,
	...props
}: BoxProps & {
	children: ReactNode;
}) {
	const context = useContext(TaskContext);

	const [expanded, setExpanded] = useState(false);

	const mergedContext = useMemo<TaskContext>(
		() => ({ ...context, expanded, setExpanded }),
		[context, expanded],
	);

	return (
		<TaskContext value={mergedContext}>
			<Box flexDirection="column" paddingX={1} {...props}>
				{children}
			</Box>
		</TaskContext>
	);
}

namespace Task {
	export function Group({
		children,
		taskProps,
		detailsProps,
		...props
	}: BoxProps & {
		children: ReactNode;
		taskProps?: BoxProps;
		detailsProps?: BoxProps;
	}) {
		const context = useMemo(
			(): TaskContext => ({ taskProps, detailsProps, expanded: false }),
			[taskProps, detailsProps],
		);

		return (
			<TaskContext value={context}>
				<Box flexDirection="column" gap={1} {...props}>
					{children}
				</Box>
			</TaskContext>
		);
	}

	export function Status({
		emoji,
		status,
		parts,
	}: {
		emoji?: string;
		status: "pending" | "success" | "error";
		parts: StatusPart[];
	}) {
		const { colorScheme } = useContext(ThemeContext);

		const { expanded, setExpanded } = useContext(TaskContext);
		if (!setExpanded) throw new Error("missing task context");

		const [hovered, setHovered] = useState(false);

		const { mouseRef } = useMouseInput({
			onClick: ({ event }) => {
				if (event.type === "down" && event.button === "left") {
					setExpanded(!expanded);
				}
			},
			onHoverStart: () => {
				setHovered(true);
			},
			onHoverEnd: () => {
				setHovered(false);
			},
			isActive: true,
		});

		const shimmer = useAnimation({ interval: 200 });
		const offset = useMemo(() => Math.random() * 1000, []);

		const current = status === "pending" ? shimmer : null;

		const text = useMemo(() => {
			if (status === "error") {
				return TaskUtils.plain({
					parts,
					style: (style) => (hovered ? style.red.dim : style.red),
					join: " ",
				});
			}
			if (current) {
				return TaskUtils.shimmer({
					parts,
					style: (style) => (hovered ? style.dim : style),
					time: current.time,
					offset,
				});
			}
			return TaskUtils.plain({
				parts,
				style: (style) =>
					hovered
						? style.hex(colorScheme.textSubtle).dim
						: style.hex(colorScheme.textSubtle),
				join: " ",
			});
		}, [hovered, offset, current, status, parts, colorScheme.textSubtle]);

		return (
			<Box ref={mouseRef}>
				<Text color="textSubtle">{emoji ?? " "} </Text>
				<Text>{text}</Text>
			</Box>
		);
	}

	export function Details({
		children,
		collapse = true,
	}: {
		children: ReactNode;
		collapse?: boolean;
	}) {
		const { detailsProps, expanded } = useContext(TaskContext);

		if (collapse && !expanded) {
			return null;
		}

		return (
			<Box flexDirection="column" paddingLeft={2} {...detailsProps}>
				{children}
			</Box>
		);
	}
}

export default Task;
