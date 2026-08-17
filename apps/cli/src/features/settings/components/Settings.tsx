import type {
	CompletionGroup,
	CompletionItem,
} from "@tiny-chat/client/src/features/editor/types/completion.ts";
import { useThemes } from "@tiny-chat/client/src/features/settings/hooks/useThemes.ts";
import { ThemeUtils } from "@tiny-chat/core/src/core/utils/ThemeUtils.ts";
import chalk from "chalk";
import { useMemo, useRef } from "react";
import Text from "../../../core/components/Text.tsx";
import { usePage } from "../../../core/hooks/usePage.ts";
import { useWorkingStatus } from "../../../core/hooks/useWorkingStatus.ts";
import Completions from "../../editor/components/Completions.tsx";
import Textarea from "../../editor/components/Textarea.tsx";

interface SettingsGroup extends CompletionGroup<SettingsItem<any>> {}
interface SettingsItem<T extends readonly string[] | string[]>
	extends CompletionItem {
	choices?: T;
	current: T[number];
	set: (value: T[number]) => void;
}

export const _debug = false;

export default function Settings() {
	const { theme, setTheme, codeTheme, setCodeTheme } = useThemes();
	useWorkingStatus(setTheme, setCodeTheme);

	usePage();

	const groups = useMemo<SettingsGroup[]>(() => {
		return [
			{
				name: "cli",
				items: [
					{
						name: "theme",
						value: "theme",
						choices: ThemeUtils.themes,
						current: theme,
						set: (theme) => setTheme.mutate({ theme }),
					} satisfies SettingsItem<typeof ThemeUtils.themes>,
					{
						name: "code-theme",
						value: "code-theme",
						choices: ThemeUtils.codeThemesByTheme(theme),
						current: codeTheme,
						set: (codeTheme) => setCodeTheme.mutate({ codeTheme }),
					} satisfies SettingsItem<(typeof ThemeUtils.codeThemes)[number][]>,
				],
			},
		];
	}, [theme, setTheme, codeTheme, setCodeTheme]);

	const itemRef = useRef<SettingsItem<any>>(null);

	return (
		<Completions<SettingsGroup, SettingsItem<any>>
			groups={groups}
			itemRef={itemRef}
			itemProps={{
				flexGrow: 1,
				flexShrink: 1,
				maxWidth: 50,
				justifyContent: "space-between",
			}}
			onInput={({ item, key }) => {
				if (!item) return;
				if (item.choices) {
					const currentIndex = item.choices.indexOf(item.current);
					if (key.leftArrow) {
						if (currentIndex > 0) {
							item.set(item.choices[currentIndex - 1]);
						}
						return true;
					} else if (key.rightArrow) {
						if (currentIndex < item.choices.length - 1) {
							item.set(item.choices[currentIndex + 1]);
						}
						return true;
					}
				}
			}}
			renderItem={({ item, selected }) => {
				if (item.choices) {
					return (
						<>
							<Text>{item.name}</Text>
							<Text color="text">
								{item.choices.indexOf(item.current) === 0
									? chalk.dim(`< `)
									: `< `}
								{item.current}
								{item.choices.indexOf(item.current) === item.choices.length - 1
									? chalk.dim(` >`)
									: ` >`}
							</Text>
						</>
					);
				} else {
					return (
						<>
							<Text>{item.name}</Text>
							<Textarea
								focus={selected}
								value={item.current}
								onChange={() => {}}
							/>
						</>
					);
				}
			}}
			actions={[
				"back",
				...(itemRef.current?.choices ? [{ key: "←→", name: "pick" }] : []),
			]}
		/>
	);
}
