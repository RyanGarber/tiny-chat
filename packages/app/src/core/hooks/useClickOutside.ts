import { useEffect, useRef, useState } from "react";

export const useClickOutside = ({
	isOpen,
	setIsOpen,
}: {
	isOpen?: boolean;
	setIsOpen?: (value: boolean) => void;
} = {}) => {
	const [uncontrolledIsOpen, uncontrolledSetIsOpen] = useState(false);

	isOpen ??= uncontrolledIsOpen;
	setIsOpen ??= uncontrolledSetIsOpen;

	const insideRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const path = event.composedPath();
			if (insideRef.current && !path.includes(insideRef.current)) {
				setIsOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	});

	return { insideRef, isOpen, setIsOpen };
};
