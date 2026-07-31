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
import { ToolUtils } from "@tiny-chat/core/src/features/tool/utils/ToolUtils.ts";
import { useChat } from "@tiny-chat/react/src/features/chat/hooks/useChat.ts";
import { Tiptap } from "@tiptap/react";
import {
	type CSSProperties,
	memo,
	useCallback,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { CapabilitySelect } from "#ui/features/config/components/CapabilitySelect.tsx";
import ModelSelect from "#ui/features/config/components/ModelSelect.tsx";
import { useConfig } from "#ui/features/config/hooks/useConfig.ts";
import { useTools } from "#ui/features/config/hooks/useTools.ts";
import Upload, {
	FileMenuItem,
	RepositoryMenuItem,
	ScreenshotMenuItem,
} from "#ui/features/file/components/Upload.tsx";
import { useSkills } from "#ui/features/file/hooks/useSkills.ts";
import { uploadMutationKey } from "#ui/features/file/hooks/useUploads.ts";
import { useInput } from "#ui/features/input/hooks/useInput.tsx";
import { useInputStore } from "#ui/features/input/stores/useInputStore.ts";
import { MessageHandlerService } from "#ui/features/message/services/MessageHandlerService.ts";
import { GLASS_STYLE, SHADOW } from "#ui/utils/style.ts";
import { StreamService } from "../../../../../react/src/features/chat/services/StreamService.ts";
import { useMessaging } from "../hooks/useMessaging";

export const ChatInput = memo(
	({ isAny, ...props }: InputWrapperProps & { isAny: boolean }) => {
		const { chat } = useChat();
		const { config, setConfig, modelArgs, setModelArg } = useConfig();

		const stream = StreamService.getChat(chat.data?.id ?? "");

		const isEmpty = useInputStore((s) => s.isEmpty);
		const isIncomplete = useInputStore((s) => s.isIncomplete);

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

		const { editor, isMultiline } = useInput({
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

		const [capabilitySelectOpen, setCapabilitySelectOpen] = useState(false);

		const onCapabilitySelectClose = useCallback(() => {
			setCapabilitySelectOpen(false);
		}, []);

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
					<Menu.Dropdown style={{ boxShadow: SHADOW }}>
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
						onClose={onCapabilitySelectClose}
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
						<PopoverDropdown maw={250} style={{ boxShadow: SHADOW }}>
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
										boxShadow: SHADOW,
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
								onClick={() => setCapabilitySelectOpen(true)}
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
															boxShadow: SHADOW,
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
							if (stream) void MessageHandlerService.abort(stream.id);
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
				onCapabilitySelectClose,
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
            box-shadow: ${SHADOW};
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
								...GLASS_STYLE,
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
