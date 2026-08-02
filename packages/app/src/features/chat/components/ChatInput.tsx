import { Icon } from "@iconify/react";
import {
	ActionIcon,
	Box,
	Button,
	InputBase,
	InputWrapper,
	type InputWrapperProps,
	Menu,
	Popover,
	PopoverDropdown,
	PopoverTarget,
	ScrollAreaAutosize,
	Select,
	Slider,
	Stack,
	Text,
} from "@mantine/core";
import { useIsMutating } from "@tanstack/react-query";
import { useConfig } from "@tiny-chat/client/src/features/agent/hooks/useConfig.ts";
import { useTools } from "@tiny-chat/client/src/features/agent/hooks/useTools.ts";
import { AgentMessageService } from "@tiny-chat/client/src/features/agent/services/AgentMessageService.ts";
import { useChat } from "@tiny-chat/client/src/features/chat/hooks/useChat.ts";
import { useMessaging } from "@tiny-chat/client/src/features/chat/hooks/useMessaging.ts";
import { StreamService } from "@tiny-chat/client/src/features/chat/services/StreamService.ts";
import { ToolUtils } from "@tiny-chat/core/src/features/tool/utils/ToolUtils.ts";
import { Tiptap } from "@tiptap/react";
import {
	type CSSProperties,
	memo,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useSkills } from "#client/src/features/agent/hooks/useSkills.ts";
import { client } from "#ui/client.ts";
import { StyleUtils } from "#ui/core/utils/StyleUtils.ts";
import { CapabilitySelect } from "#ui/features/agent/components/CapabilitySelect.tsx";
import ModelSelect from "#ui/features/agent/components/ModelSelect.tsx";
import { useCapabilitySelectStore } from "#ui/features/agent/stores/useCapabilitySelectStore.ts";
import { useEditor } from "#ui/features/editor/hooks/useEditor.tsx";
import { useEditorStore } from "#ui/features/editor/stores/useEditorStore.ts";
import Upload, {
	FileMenuItem,
	RepositoryMenuItem,
	ScreenshotMenuItem,
} from "#ui/features/upload/components/Upload.tsx";
import { uploadMutationKey } from "#ui/features/upload/hooks/useUploads.ts";

export const ChatInput = memo(
	({ isAny, ...props }: InputWrapperProps & { isAny: boolean }) => {
		const { chat } = useChat();
		const { config, setConfig, modelArgs, setModelArg } = useConfig();

		const stream = StreamService.getChat(chat.data?.id ?? "");

		const isEmpty = useEditorStore((s) => s.isEmpty);
		const isIncomplete = useEditorStore((s) => s.isIncomplete);

		const { sendMessage } = useMessaging();
		const { toolsets } = useTools();

		const { skills } = useSkills();
		const enabledSkills = useMemo(
			() =>
				skills
					.filter((s) => config.skills?.includes(s.path))
					.map((s) => s.name),
			[skills, config.skills],
		);

		const enabledTools = useMemo(
			() => ToolUtils.checkAll({ toolsets, config }).tools,
			[toolsets, config],
		);

		const [uploadOpen, setUploadOpen] = useState(false);
		const [uploadTab, setUploadTab] = useState<"file" | "repo">("file");
		const scrollRef = useRef<HTMLDivElement>(null);
		const leftSectionRef = useRef<HTMLDivElement>(null);
		const rightSectionRef = useRef<HTMLDivElement>(null);

		const { editor, isMultiline } = useEditor({
			ref: scrollRef,
			disabled: isAny,
		});

		const [sectionWidths, setSectionWidths] = useState({ left: 42, right: 42 });
		useLayoutEffect(() => {
			const updateWidths = () => {
				const leftWidth = leftSectionRef.current?.offsetWidth ?? 42;
				const rightWidth = rightSectionRef.current?.offsetWidth ?? 42;
				setSectionWidths({ left: leftWidth, right: rightWidth });
			};

			updateWidths();
			const observer = new ResizeObserver(updateWidths);

			if (leftSectionRef.current) observer.observe(leftSectionRef.current);
			if (rightSectionRef.current) observer.observe(rightSectionRef.current);

			return () => observer.disconnect();
		}, []);

		const isUploading = useIsMutating({ mutationKey: uploadMutationKey }) > 0;

		const capabilitySelectOpen = useCapabilitySelectStore((s) => s.opened);
		const capabilitySelectTab = useCapabilitySelectStore((s) => s.tab);
		const openCapabilitySelect = useCapabilitySelectStore((s) => s.open);
		const closeCapabilitySelect = useCapabilitySelectStore((s) => s.close);

		const leftActionContent = useMemo(
			() => (
				<Menu position="top-start" transitionProps={{ transition: "fade-up" }}>
					<Menu.Target>
						<ActionIcon
							variant="subtle"
							color="var(--mantine-color-text)"
							radius={20}
							size={40}
							disabled={isAny}
							loading={isUploading}
						>
							<Icon icon="lucide:paperclip" height={18} />
						</ActionIcon>
					</Menu.Target>
					<Menu.Dropdown style={{ boxShadow: StyleUtils.shadow }}>
						<FileMenuItem
							onClick={() => {
								setUploadTab("file");
								setUploadOpen(true);
							}}
							disabled={isAny}
						/>
						<RepositoryMenuItem
							onClick={() => {
								setUploadTab("repo");
								setUploadOpen(true);
							}}
							disabled={isAny}
						/>
						<ScreenshotMenuItem disabled={isAny} />
					</Menu.Dropdown>
				</Menu>
			),
			[isAny, isUploading],
		);

		const rightActionContent = useMemo(
			() => (
				<>
					<CapabilitySelect
						opened={capabilitySelectOpen}
						onClose={closeCapabilitySelect}
						defaultTab={capabilitySelectTab}
					/>
					<Popover position="top" transitionProps={{ transition: "fade-up" }}>
						<PopoverTarget>
							<Button
								fw="normal"
								variant="subtle"
								color="var(--mantine-color-text)"
								maw="25vw"
								radius={20}
								h={40}
								px={15}
								disabled={isAny}
							>
								{config.model}
							</Button>
						</PopoverTarget>
						<PopoverDropdown maw={250} style={{ boxShadow: StyleUtils.shadow }}>
							<ModelSelect
								flex={1}
								variant="subtle"
								comboboxProps={{
									withinPortal: false,
									transitionProps: { transition: "fade-up" },
									offset: 0,
								}}
								styles={{
									dropdown: {
										boxShadow: StyleUtils.shadow,
									},
								}}
								configValue={config}
								onConfigChange={(value) => value && setConfig(value)}
								feature="language"
								disabled={isAny}
							/>
							<Button
								fullWidth
								variant="transparent"
								c="dimmed"
								size="xs"
								onClick={() => openCapabilitySelect()}
							>
								{enabledTools.length} TOOL{enabledTools.length !== 1 ? "S" : ""}{" "}
								&middot; {enabledSkills.length} SKILL
								{enabledSkills.length !== 1 ? "S" : ""}
							</Button>
							<Stack gap="xs" mt={5}>
								{modelArgs?.map((arg) => (
									<Box key={arg.name}>
										{arg.type === "list" && (
											<>
												<Text size="xs" mb={2}>
													{arg.name}
												</Text>
												<Select
													key={arg.name}
													data={arg.values}
													size="xs"
													value={
														(
															config.args as Record<string, string> | undefined
														)?.[arg.name] ?? arg.default
													}
													variant="unstyled"
													styles={{
														input: {
															padding: "0 10px",
														},
														dropdown: {
															boxShadow: StyleUtils.shadow,
														},
													}}
													comboboxProps={{
														withinPortal: false,
														offset: 0,
														transitionProps: { transition: "fade-up" },
													}}
													onChange={(value) => setModelArg(arg.name, value)}
													disabled={isAny}
												/>
											</>
										)}
										{arg.type === "range" && (
											<>
												<Text size="xs" mb={2}>
													{arg.name}
												</Text>
												<Slider
													min={arg.min}
													max={arg.max}
													step={(arg.max - arg.min) / 50}
													value={
														(
															config.args as Record<string, number> | undefined
														)?.[arg.name] ?? arg.default
													}
													onChange={(value) => setModelArg(arg.name, value)}
													disabled={isAny}
												/>
											</>
										)}
									</Box>
								))}
							</Stack>
						</PopoverDropdown>
					</Popover>
					<ActionIcon
						variant="filled"
						size={40}
						radius={20}
						onClick={() => {
							if (stream)
								void AgentMessageService.abort({ client, id: stream.id });
							else sendMessage.mutate();
						}}
						loading={sendMessage.isPending}
						disabled={
							(isEmpty || isIncomplete || isAny) &&
							(stream === undefined || stream.abort.signal.aborted)
						}
					>
						{stream ? (
							<Icon icon="lucide:square" height={18} />
						) : (
							<Icon icon="lucide:send" height={18} />
						)}
					</ActionIcon>
				</>
			),
			[
				capabilitySelectOpen,
				capabilitySelectTab,
				closeCapabilitySelect,
				openCapabilitySelect,
				isAny,
				config,
				enabledTools.length,
				enabledSkills.length,
				setConfig,
				stream,
				isEmpty,
				sendMessage,
				modelArgs?.map,
				setModelArg,
				isIncomplete,
			],
		);

		const leftActions = (
			<div
				ref={leftSectionRef}
				style={{
					display: "flex",
					alignItems: "center",
					opacity: isMultiline ? 0 : 1,
					pointerEvents: isMultiline ? "none" : "auto",
					transition: "opacity 200ms ease",
				}}
			>
				{leftActionContent}
			</div>
		);

		const rightActions = (
			<div
				ref={rightSectionRef}
				style={{
					display: "flex",
					alignItems: "center",
					gap: "5px",
					opacity: isMultiline ? 0 : 1,
					pointerEvents: isMultiline ? "none" : "auto",
					transition: "opacity 200ms ease",
				}}
			>
				{rightActionContent}
			</div>
		);

		return (
			<>
				<Upload
					opened={uploadOpen}
					onClose={() => setUploadOpen(false)}
					tab={uploadTab}
					onTabChange={setUploadTab}
				/>
				<InputWrapper {...props}>
					<style>
						{`
          .chat-input {
            position: relative;
          }
          .chat-input::after {
            position: absolute;
            content: "";
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            box-shadow: ${StyleUtils.shadow};
            border-radius: ${(props.style as CSSProperties)?.borderRadius ?? 0}px;
            z-index: 10000;
            pointer-events: none;
          }
        `}
					</style>
					<InputBase
						className="chat-input"
						component="div"
						multiline
						pointer
						disabled={isAny}
						leftSection={leftActions}
						rightSection={rightActions}
						style={{
							"--input-left-section-width": "auto",
							"--input-right-section-width": "auto",
						}}
						radius={(props.style as CSSProperties)?.borderRadius ?? 0}
						styles={{
							input: {
								padding: 5,
								wordBreak: "break-word",
								...StyleUtils.glass,
							},
							section: {
								display: "flex",
								alignItems: "center",
								margin: "5px",
								pointerEvents: "none",
							},
						}}
						onClick={() => editor.commands.focus()}
					>
						<ScrollAreaAutosize
							ref={scrollRef}
							type="auto"
							mah="75vh"
							style={{
								paddingLeft: (!isMultiline ? sectionWidths.left : 0) + 10,
								paddingRight: (!isMultiline ? sectionWidths.right : 0) + 10,
								paddingTop: 5,
								paddingBottom: 5,
								minHeight: "var(--input-height)",
								cursor: isAny ? "not-allowed" : "text",
								transition: "padding-left 200ms ease, padding-right 200ms ease",
							}}
						>
							<Tiptap editor={editor}>
								<Tiptap.Content
									autoCapitalize="on"
									autoComplete="off"
									autoCorrect="off"
									spellCheck={false}
								/>
							</Tiptap>
						</ScrollAreaAutosize>
						<div
							style={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								maxHeight: isMultiline ? 50 : 0,
								opacity: isMultiline ? 1 : 0,
								overflow: "hidden",
								pointerEvents: isMultiline ? "auto" : "none",
								transition:
									"max-height 200ms ease, opacity 200ms ease, padding-bottom 200ms ease",
							}}
						>
							<div style={{ display: "flex", alignItems: "center" }}>
								{leftActionContent}
							</div>
							<div
								style={{ display: "flex", alignItems: "center", gap: "5px" }}
							>
								{rightActionContent}
							</div>
						</div>
					</InputBase>
				</InputWrapper>
			</>
		);
	},
);
