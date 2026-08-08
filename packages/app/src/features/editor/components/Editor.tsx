import {
	InputBase,
	InputWrapper,
	type InputWrapperProps,
	ScrollAreaAutosize,
} from "@mantine/core";
import { Tiptap } from "@tiptap/react";
import {
	type CSSProperties,
	memo,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";
import Capabilities from "#app/features/editor/components/Capabilities.tsx";
import LeftSection from "#app/features/editor/components/LeftSection.tsx";
import RightSection from "#app/features/editor/components/RightSection.tsx";
import { useEditor } from "#app/features/editor/hooks/useEditor.tsx";
import Uploads from "#app/features/upload/components/Uploads.tsx";

export const Editor = memo(
	({ disabled, ...props }: InputWrapperProps & { disabled: boolean }) => {
		const scrollRef = useRef<HTMLDivElement>(null);
		const leftSectionRef = useRef<HTMLDivElement>(null);
		const rightSectionRef = useRef<HTMLDivElement>(null);

		const { editor, isMultiline } = useEditor({
			ref: scrollRef,
			disabled: disabled,
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

		return (
			<>
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
						disabled={disabled}
						leftSection={
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
								<LeftSection isAny={disabled} />
							</div>
						}
						rightSection={
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
								<RightSection isAny={disabled} />
							</div>
						}
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
								cursor: disabled ? "not-allowed" : "text",
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
								<LeftSection isAny={disabled} />
							</div>
							<div
								style={{ display: "flex", alignItems: "center", gap: "5px" }}
							>
								<RightSection isAny={disabled} />
							</div>
						</div>
					</InputBase>
				</InputWrapper>
				<Uploads />
				<Capabilities />
			</>
		);
	},
);
