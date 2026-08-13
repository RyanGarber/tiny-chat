import { getSingleElementChild, Popover, useDelayedHover } from "@mantine/core";
import {
	cloneElement,
	createContext,
	type HTMLAttributes,
	type ReactElement,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";

interface HoveredState {
	target: boolean;
	dropdown: boolean;
}

interface PopupContext {
	toggle: () => void;
	setHoveredState: (context: Partial<HoveredState>) => void;
}

const PopupContext = createContext<PopupContext | null>(null);

function Popup({
	children,
	...props
}: Popover.Props & { children: ReactNode }) {
	const [opened, setOpened] = useState(false);

	const [hovered, setHovered] = useState<HoveredState>({
		target: false,
		dropdown: false,
	});
	const setHoveredState = useCallback((values: Partial<HoveredState>) => {
		setHovered((prev) => ({ ...prev, ...values }));
	}, []);

	const context: PopupContext = useMemo(
		() => ({
			setHoveredState,
			toggle: () => {
				setOpened(!opened);
			},
		}),
		[setHoveredState, opened],
	);

	return (
		<PopupContext value={context}>
			<Popover
				opened={opened || hovered.dropdown || hovered.target}
				onChange={setOpened}
				{...props}
			>
				{children}
			</Popover>
		</PopupContext>
	);
}

namespace Popup {
	const usePopup = ({
		children,
		type,
	}: {
		children: ReactNode;
		type: keyof HoveredState;
	}) => {
		const context = useContext(PopupContext);

		const child = getSingleElementChild(children);
		if (!child) throw new Error("invalid popup child");

		const element = child as ReactElement<HTMLAttributes<HTMLElement>>;

		const { openDropdown, closeDropdown } = useDelayedHover({
			open: () => context?.setHoveredState({ [type]: true }),
			close: () => context?.setHoveredState({ [type]: false }),
			openDelay: 0,
			closeDelay: 750,
		});

		return {
			child: cloneElement(element, {
				...element.props,
				style: {
					cursor: type === "target" ? "pointer" : undefined,
					...element.props.style,
				},
				onClick: type === "target" ? context?.toggle : undefined,
				onMouseEnter: () => openDropdown(),
				onMouseLeave: () => closeDropdown(),
			}),
		};
	};

	export function Target({ children, ...props }: Popover.Target.Props) {
		const { child } = usePopup({ children, type: "target" });

		return <Popover.Target {...props}>{child}</Popover.Target>;
	}

	export function Dropdown({ children, ...props }: Popover.Dropdown.Props) {
		const { child } = usePopup({ children, type: "dropdown" });

		return <Popover.Dropdown {...props}>{child}</Popover.Dropdown>;
	}
}

export default Popup;
