import { useCallback, useState } from "react";

/**
 * Open while `active`, closed once it settles — unless the user has opened or
 * closed it themselves, which then holds. `auto` is true while it is open only
 * because it is active, so the content can be held to a height that follows
 * its newest lines.
 */
export const useAutoExpand = (active: boolean) => {
	const [override, setOverride] = useState<boolean>();

	const expanded = override ?? active;
	const auto = override === undefined && active;

	const toggle = useCallback(() => {
		setOverride(!expanded);
	}, [expanded]);

	return { expanded, auto, toggle };
};
