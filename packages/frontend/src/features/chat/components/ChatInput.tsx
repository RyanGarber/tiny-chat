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
import { useTauri } from "#frontend/core/hooks/useTauri.ts";
import { useChat } from "#frontend/features/chat/hooks/useChat.ts";
import { useInput } from "#frontend/features/chat/hooks/useInput.tsx";
import { useInputStore } from "#frontend/features/chat/stores/useInputStore.ts";
import { CapabilitySelect } from "#frontend/features/config/components/CapabilitySelect.tsx";
import ModelSelect from "#frontend/features/config/components/ModelSelect.tsx";
import { useConfig } from "#frontend/features/config/hooks/useConfig.ts";
import { useProviders } from "#frontend/features/config/hooks/useProviders.ts";
import { useTools } from "#frontend/features/config/hooks/useTools.ts";
import { GenerateService } from "#frontend/features/message/services/GenerateService.ts";
import { StreamService } from "#frontend/features/message/services/StreamService.ts";
import Upload, {
	FileMenuItem,
	RepositoryMenuItem,
	ScreenshotMenuItem,
} from "#frontend/features/uploads/components/Upload.tsx";
import { useSkills } from "#frontend/features/uploads/hooks/useSkills.ts";
import { uploadMutationKey } from "#frontend/features/uploads/hooks/useUploads.ts";
import { auth } from "#frontend/utils/api.ts";
import { GLASS_STYLE, SHADOW } from "#frontend/utils/theme.ts";
import { precheckAllToolRequirements } from "#shared/utils";
import { useMessaging } from "../hooks/useMessaging";
import { useChatStore } from "../stores/useChatStore";

export const ChatInput = memo(
	({ isAny, ...props }: InputWrapperProps & { isAny: boolean }) => {
		const session = auth.useSession();
		const { chat } = useChat();
		const { config, setConfig } = useConfig();

		const stream = StreamService.getChat(chat.data?.id ?? "");

		const createIncognito = useChatStore((s) => s.createIncognito);
		const isEmpty = useInputStore((s) => s.isEmpty);

		const { isTauriDesktop } = useTauri();
		const { providers } = useProviders();
		const { sendMessage } = useMessaging();
		const { toolGroups } = useTools();

		const { skills } = useSkills();
		const enabledSkills = useMemo(
			() =>
				skills
					.filter((s) => config.skills?.includes(s.name))
					.map((s) => s.name),
			[skills, config.skills],
		);

		const enabledTools = useMemo(
			() =>
				precheckAllToolRequirements(
					toolGroups,
					session.data?.user,
					chat.data,
					createIncognito,
					true,
					isTauriDesktop.data,
					providers.data,
					skills,
				)
					.filter((g) => config.toolGroups?.includes(g.name))
					.flatMap((g) => g.tools),
			[
				toolGroups,
				config.toolGroups,
				session.data?.user,
				chat.data,
				createIncognito,
				isTauriDesktop.data,
				providers.data,
				skills,
			],
		);

		const [uploadOpen, setUploadOpen] = useState(false);
		const [uploadTab, setUploadTab] = useState<"file" | "repo">("file");
		const scrollRef = useRef<HTMLDivElement>(null);
		const leftSectionRef = useRef<HTMLDivElement>(null);
		const rightSectionRef = useRef<HTMLDivElement>(null);

		const { editor, isMultiline } = useInput({ ref: scrollRef });

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

		const args = useMemo(() => {
			return (
				providers.data?.chat
					.find((s) => s.name === config.provider)
					?.models.find((m) => m.name === config.model)?.args ?? []
			);
		}, [config.provider, config.model, providers.data]);

		const setArg = useCallback(
			(name: string, value: unknown) => {
				if (!config) return;
				const newConfig = {
					...config,
					args: { ...config.args, [name]: value },
				};
				setConfig(newConfig);
			},
			[config, setConfig],
		);

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
								feature="generate"
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
								{args?.map((arg) => (
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
													onChange={(value) => setArg(arg.name, value)}
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
													step={arg.step}
													value={
														(
															config.args as Record<string, number> | undefined
														)?.[arg.name] ?? arg.default
													}
													onChange={(value) => setArg(arg.name, value)}
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
							if (stream) void GenerateService.abort(stream.id);
							else sendMessage.mutate();
						}}
						loading={sendMessage.isPending}
						disabled={
							(isEmpty || isAny) &&
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
				args,
				setArg,
				setConfig,
				stream,
				isEmpty,
				sendMessage,
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
							onClick={() => editor.commands.focus()}
						>
							<Tiptap editor={editor}>
								<Tiptap.Content />
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
