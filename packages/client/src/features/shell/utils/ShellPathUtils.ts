/**
 * `\\wsl.localhost\<distro>\…`, `\\wsl$\<distro>\…`, either with forward
 * slashes, or the verbatim `\\?\UNC\wsl.localhost\…` Windows canonicalizes to.
 */
const WSL_REGEX =
	/^(?:\\\\\?\\UNC\\|[\\/]{2})(wsl\.localhost|wsl\$)[\\/]([^\\/]+)([\\/].*)?$/i;

/** `C:`, `C:\…` or `C:/…`. */
const DRIVE_REGEX = /^([A-Za-z]):(?:[\\/](.*))?$/;

const toForward = (path: string) => path.replace(/\\/g, "/");
const toBackward = (path: string) => path.replace(/\//g, "\\");

/** A drive path's letter and the rest of it, with forward slashes. */
const parseDrive = (path: string) => {
	const match = DRIVE_REGEX.exec(path);
	if (!match) return null;
	const [, letter, rest = ""] = match;
	return { letter: letter.toLowerCase(), rest: toForward(rest) };
};

/** `/<prefix>/<letter>/…` back to `<LETTER>:\…`, if that is what `path` is. */
const fromPrefixedDrive = (path: string, prefix: string) => {
	const match = new RegExp(`^${prefix}/([A-Za-z])(?:/(.*))?$`).exec(path);
	if (!match) return null;
	const [, letter, rest = ""] = match;
	return `${letter.toUpperCase()}:\\${toBackward(rest)}`;
};

export type WslPath = {
	/** `wsl.localhost` or `wsl$`, kept as the user spelled it. */
	host: string;
	distro: string;
	/** The path inside the distro: `/home/me`. */
	linux: string;
};

/**
 * Paths between the Windows host and the shells that spell them their own
 * way: WSL (`/home/me` for `\\wsl.localhost\Ubuntu\home\me`, `/mnt/c/x` for
 * `C:\x`) and Git Bash (`/c/x` for `C:\x`). Anything a shell cannot name is
 * passed through as it is.
 */
export const ShellPathUtils = {
	/** The distro and Linux path a WSL network path names, if it is one. */
	parseWsl: (path: string): WslPath | null => {
		const match = WSL_REGEX.exec(path);
		if (!match) return null;
		const [, host, distro, rest = ""] = match;
		return {
			host: host.toLowerCase(),
			distro,
			linux: toForward(rest).replace(/\/+$/, "") || "/",
		};
	},

	/** A path inside `distro` as Windows reaches it. */
	fromWsl: ({
		path,
		distro,
		host = "wsl.localhost",
	}: {
		path: string;
		distro: string;
		host?: string;
	}) => {
		if (!path.startsWith("/") || path.startsWith("//")) return path;
		// Windows' own drives are faster read directly than through WSL.
		const drive = fromPrefixedDrive(path, "/mnt");
		if (drive) return drive;
		return `\\\\${host}\\${distro}${toBackward(path)}`;
	},

	/** A Windows path as `distro` reaches it. */
	toWsl: ({ path, distro }: { path: string; distro: string }) => {
		const wsl = ShellPathUtils.parseWsl(path);
		if (wsl) {
			return wsl.distro.toLowerCase() === distro.toLowerCase()
				? wsl.linux
				: path;
		}
		const drive = parseDrive(path);
		if (drive) return `/mnt/${drive.letter}/${drive.rest}`.replace(/\/$/, "");
		return path;
	},

	/** A Git Bash path as Windows reaches it: `/c/x` is `C:\x`. */
	fromMsys: (path: string) => fromPrefixedDrive(path, "") ?? path,

	/** A Windows path as Git Bash reaches it: `C:\x` is `/c/x`. */
	toMsys: (path: string) => {
		const drive = parseDrive(path);
		if (drive) return `/${drive.letter}/${drive.rest}`.replace(/\/$/, "");
		if (/^\\\\[^?]/.test(path)) return toForward(path);
		return path;
	},
} as const;
