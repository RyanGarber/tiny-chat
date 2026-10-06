import { HTMLAttributes } from "react";
//#region ../../core/dist/index.d.ts
/**
 * A built icon theme, ready to be used by a renderer.
 * @param theme Rebuilds (and caches) the full theme from its minified source.
 * @param cache A cache of loaded icon SVGs, keyed by icon id.
 * @param svg Loads the SVG for the given icon id.
 */
interface GeneratedFileIconTheme {
  theme: MinifiedFileIconTheme;
  cache: Map<string, Promise<string>>;
  svg(id: string): Promise<string>;
}
//#endregion
//#region src/theme.d.ts
/**
 * A minified icon reference: either a single default icon id, or a
 * `[defaultId, expandedId]` tuple of icon ids for folders that have one.
 */
type MinifiedIcon = number | [number, number];
/**
 * A minified, dictionary-compressed representation of a {@link FileIconTheme}
 * (excluding its icons), built to be as small as possible when serialized.
 * @param name The name of the icon theme.
 * @param dictionary The shared substring dictionary referenced by the keys below.
 * @param file Icon for generic files.
 * @param fileNames Icons by (dictionary-compressed) file name.
 * @param fileExtensions Icons by (dictionary-compressed) file extension.
 * @param folder Icon for generic folders.
 * @param folderNames Icons by (dictionary-compressed) folder name.
 * @param languages Icons by (dictionary-compressed) language.
 */
interface MinifiedFileIconTheme {
  name: string;
  dictionary: string[];
  file?: MinifiedIcon;
  fileNames?: Record<string, MinifiedIcon>;
  fileExtensions?: Record<string, MinifiedIcon>;
  folder?: MinifiedIcon;
  folderNames?: Record<string, MinifiedIcon>;
  languages?: Record<string, MinifiedIcon>;
}
//#endregion
//#region src/react.d.ts
interface FileIconProps {
  theme?: GeneratedFileIconTheme;
  path: string;
  language?: string;
  directory?: boolean;
  expanded?: boolean;
}
declare const FileIconTheme: import("react").Context<GeneratedFileIconTheme | null>;
declare function FileIcon({ theme, path, language, directory, expanded, ...props }: FileIconProps & HTMLAttributes<HTMLDivElement>): import("react").JSX.Element | null;
//#endregion
export { FileIcon, FileIconProps, FileIconTheme };
//# sourceMappingURL=index.d.ts.map