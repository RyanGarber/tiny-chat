import { Group, Loader } from "@mantine/core";
import type { Ref } from "react";

export default function Sentinel({
	isFetching,
	ref,
}: {
	isFetching: boolean;
	ref?: Ref<HTMLDivElement>;
}) {
	return (
		<Group
			justify="center"
			align="center"
			w="100%"
			opacity={isFetching ? 1 : 0}
			ref={ref}
		>
			<Loader size="xs" m="md" />
		</Group>
	);
}
