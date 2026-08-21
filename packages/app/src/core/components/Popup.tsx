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
	isOpen: boolean;
	setIsOpen: (value: boolean) => void;
	toggle: () => void;
	setHoveredState: (context: Partial<HoveredState>) => void;
}

const PopupContext = createContext<PopupContext | null>(null);

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

function Popup({
	children,
	...props
}: Popover.Props & {
	children: ReactNode;
}) {
	const [isOpen, setIsOpen] = useState(false);

	const [hovered, setHovered] = useState<HoveredState>({
		target: false,
		dropdown: false,
	});
	const setHoveredState = useCallback((values: Partial<HoveredState>) => {
		setHovered((prev) => ({ ...prev, ...values }));
	}, []);

	const context: PopupContext = useMemo(
		() => ({
			isOpen,
			setIsOpen,
			toggle: () => {
				setIsOpen(!isOpen);
			},
			setHoveredState,
		}),
		[setHoveredState, isOpen],
	);

	return (
		<PopupContext value={context}>
			<Popover
				opened={isOpen || hovered.dropdown || hovered.target}
				onChange={setIsOpen}
				{...props}
			>
				{children}
			</Popover>
		</PopupContext>
	);
}

namespace Popup {
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
