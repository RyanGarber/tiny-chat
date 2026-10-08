import { ActionIcon, Tooltip } from "@mantine/core";
import { FloppyDiskIcon } from "@phosphor-icons/react";

/** Saves a field's unsaved edit, shown only while there is one. */
export default function SaveButton({
	dirty,
	loading,
	disabled,
	label = "Save",
	onClick,
}: {
	dirty: boolean;
	loading?: boolean;
	disabled?: boolean;
	label?: string;
	onClick: () => void;
}) {
	if (!dirty && !loading) return null;
	return (
		<Tooltip label={label}>
			<ActionIcon
				variant="subtle"
				aria-label={label}
				loading={loading}
				disabled={disabled}
				onClick={onClick}
			>
				<FloppyDiskIcon size={20} />
			</ActionIcon>
		</Tooltip>
	);
}
