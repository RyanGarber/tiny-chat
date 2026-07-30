import type { SpinnerName } from "cli-spinners";
import { Box, Text, useAnimation } from "ink";
import Spinner from "ink-spinner";
import { useStatusStore } from "../stores/useStatusStore.ts";

const SPINNERS: SpinnerName[] = [
	/*"flip",
	"arc",
	"balloon",
	"dots",
	"circle",
	"triangle",*/
	"bluePulse",
];

export default function Status() {
	const statuses = useStatusStore((state) => state.statuses);

	const spinner = useAnimation({
		interval: 2000,
	});

	return (
		<>
			{statuses.map((status, index) => (
				<Box key={status.id}>
					<Spinner type={SPINNERS[(spinner.frame + index) % SPINNERS.length]} />
					<Text>{status.text ?? "Working..."}</Text>
				</Box>
			))}
		</>
	);
}
