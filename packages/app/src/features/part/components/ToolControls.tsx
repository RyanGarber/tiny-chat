import {
	Box,
	Button,
	Grid,
	Group,
	Radio,
	Stack,
	Text,
	Textarea,
} from "@mantine/core";
import { useToolFeedback } from "@tiny-chat/client/features/part/hooks/useToolFeedback.ts";
import type { MessageState } from "@tiny-chat/core/features/data/types/message.ts";
import type { zToolCallPart } from "@tiny-chat/core/features/data/types/part.ts";
import type { ToolControls as ToolControlsType } from "@tiny-chat/core/features/tool/types/display.ts";

/** What the user answers a tool call with: its fields, then approve or continue. */
export default function ToolControls({
	message,
	part,
	controls,
	isFocused,
}: {
	message: MessageState;
	part: zToolCallPart;
	controls: ToolControlsType;
	/** Only the next call waiting on the user can be answered. */
	isFocused?: boolean;
}) {
	const { values, setValue, submit, locked, complete, sending } =
		useToolFeedback({ message, part, controls });

	const disabled = locked || !isFocused;

	return (
		<Stack gap="xs">
			{controls.fields.map((field) => (
				<Stack key={field.name} gap="xs">
					{field.options.length > 0 && (
						<Grid grow>
							{field.options.map((option) => (
								<Grid.Col key={option} span={4} align="stretch">
									<Radio.Card
										p="md"
										h="100%"
										checked={values[field.name] === option}
										disabled={disabled}
										onClick={() => setValue(field.name, option)}
									>
										<Group wrap="nowrap" align="flex-start" h="100%">
											<Radio.Indicator />
											<Box>
												<Text>{option}</Text>
											</Box>
										</Group>
									</Radio.Card>
								</Grid.Col>
							))}
						</Grid>
					)}
					{field.custom && (
						<Textarea
							autosize
							minRows={1}
							maxRows={10}
							placeholder={field.placeholder}
							value={values[field.name] ?? ""}
							disabled={disabled}
							onChange={(event) => setValue(field.name, event.target.value)}
						/>
					)}
				</Stack>
			))}
			<Group gap="xs" justify="flex-end">
				{controls.approval ? (
					<>
						<Button
							size="xs"
							variant="default"
							onClick={() => submit(false)}
							loading={sending === false}
							disabled={disabled}
						>
							Deny
						</Button>
						<Button
							size="xs"
							onClick={() => submit(true)}
							loading={sending === true}
							disabled={disabled || !complete}
						>
							Approve
						</Button>
					</>
				) : (
					<Button
						size="xs"
						onClick={() => submit()}
						loading={sending !== undefined}
						disabled={disabled || !complete}
					>
						Continue
					</Button>
				)}
			</Group>
		</Stack>
	);
}
