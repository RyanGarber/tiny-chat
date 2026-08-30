import { createContext, useContext, useEffect, useState } from "react";
import { jsx } from "react/jsx-runtime";
//#region ../../core/dist/index.js
/**
* The first code point used to reference entries of a
* {@link MinifiedFileIconTheme.dictionary}. Chosen from the Private Use
* Area, so it never collides with a real character in a file/folder name.
*/
const DICTIONARY_BASE = 57344;
/**
* Expands a dictionary-compressed string back to its original value, by
* replacing every dictionary reference with the substring it stands for.
*/
function expand(dictionary, value) {
	let result = "";
	for (const char of value) {
		const index = (char.codePointAt(0) ?? 0) - DICTIONARY_BASE;
		result += index >= 0 && index < dictionary.length ? dictionary[index] : char;
	}
	return result;
}
function expandIcon(icon) {
	if (icon === void 0) return void 0;
	if (typeof icon === "number") return { default: icon };
	const [defaultId, expandedId] = icon;
	return {
		default: defaultId,
		expanded: expandedId
	};
}
function expandMap(dictionary, map) {
	if (!map) return void 0;
	return Object.fromEntries(Object.entries(map).map(([key, icon]) => [expand(dictionary, key), expandIcon(icon)]));
}
const cache = /* @__PURE__ */ new WeakMap();
/**
* Rebuilds a full {@link FileIconTheme} (excluding its icons) from its
* minified, dictionary-compressed representation.
*/
function expandTheme(minified) {
	const cached = cache.get(minified);
	if (cached) return cached;
	const { name, dictionary } = minified;
	const uncached = {
		name,
		file: expandIcon(minified.file),
		fileNames: expandMap(dictionary, minified.fileNames),
		fileExtensions: expandMap(dictionary, minified.fileExtensions),
		folder: expandIcon(minified.folder),
		folderNames: expandMap(dictionary, minified.folderNames),
		languages: expandMap(dictionary, minified.languages)
	};
	cache.set(minified, uncached);
	return uncached;
}
function getFileIcon({ theme: generated, path, language, directory, expanded }) {
	const name = path.split(/[/\\]/).filter(Boolean).pop();
	if (!name) return null;
	const theme = expandTheme(generated.theme);
	let fileIcon;
	fileIcon = theme.fileNames?.[name];
	if (fileIcon) return fileIcon.default;
	const parts = name.split(".");
	for (let i = 1; i < parts.length; i++) {
		const ext = parts.slice(i).join(".");
		fileIcon = theme.fileExtensions?.[ext];
		if (fileIcon) return fileIcon.default;
	}
	if (language) {
		fileIcon = theme.languages?.[language];
		if (fileIcon) return fileIcon.default;
	}
	let folderIcon;
	folderIcon = theme.folderNames?.[name];
	if (folderIcon) {
		if (expanded && folderIcon.expanded) return folderIcon.expanded;
		return folderIcon.default;
	}
	const isDirectoryLike = path.endsWith("/") || path.endsWith("\\") || !name.includes(".");
	if (directory || directory === void 0 && isDirectoryLike) {
		if (expanded && theme.folder?.expanded) return theme.folder.expanded;
		return theme.folder?.default ?? null;
	}
	if (theme.file) return theme.file.default;
	return null;
}
//#endregion
//#region src/react.tsx
const FileIconTheme = createContext(null);
function FileIcon({ theme, path, language, directory, expanded, ...props }) {
	const contextTheme = useContext(FileIconTheme);
	if (!theme) {
		if (!contextTheme) throw new Error("Theme not passed or found in context");
		theme = contextTheme;
	}
	const icon = getFileIcon({
		theme,
		path,
		language,
		directory,
		expanded
	});
	const [iconSvg, setIconSvg] = useState(null);
	useEffect(() => {
		if (!icon) return;
		theme.svg(icon).then((svg) => setIconSvg(svg));
	}, [icon, theme]);
	if (!iconSvg) return null;
	return /* @__PURE__ */ jsx("span", {
		...props,
		dangerouslySetInnerHTML: { __html: iconSvg }
	});
}
//#endregion
export { FileIcon, FileIconTheme };

//# sourceMappingURL=index.js.map