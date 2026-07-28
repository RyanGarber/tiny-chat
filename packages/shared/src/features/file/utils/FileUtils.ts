import { FileTypeUtils } from "./FileTypeUtils.ts";

export interface Descendent<T> {
	children: Map<string, Descendent<T>>;
	node?: T;
}

export const FileUtils = {
	getBase64FromBytes: ({ data }: { data: Uint8Array | string }) => {
		if (typeof data !== "string") {
			const chunkSize = 65536;
			let binary = "";
			for (let i = 0; i < data.length; i += chunkSize) {
				const chunk = data.subarray(i, i + chunkSize);
				binary += String.fromCharCode(...chunk);
			}
			return btoa(binary);
		}
		return data;
	},

	getBufferFromBytes: ({ data }: { data: Uint8Array | string }) => {
		if (typeof data === "string") {
			const binary = atob(data);
			data = new Uint8Array(binary.length);
			for (let i = 0; i < binary.length; i++) {
				data[i] = binary.charCodeAt(i);
			}
		}
		return data;
	},

	getTextFromBytes: ({
		data,
		mime,
	}: {
		data: Uint8Array | string;
		mime?: string;
	}) => {
		data = FileUtils.getBufferFromBytes({ data });

		if (mime) {
			const charset = /;\s*charset\s*=\s*"?([^";]+)"?/i.exec(mime)?.[1]?.trim();
			if (charset) {
				try {
					return new TextDecoder(charset, { fatal: true }).decode(data.buffer);
				} catch {
					// ignore
				}
			}
		}

		const bom = FileTypeUtils.getBom({ data });
		if (bom) {
			return new TextDecoder(bom.encoding).decode(data.buffer.slice(bom.skip));
		}
		try {
			return new TextDecoder("utf-8", { fatal: true }).decode(data.buffer);
		} catch {
			// ignore
		}

		return null;
	},

	/**
	 * Build a hierarchical tree from a list of file-like objects.
	 */
	toTree: <T extends { path: string[] }>({ nodes }: { nodes: T[] }) => {
		const root: Descendent<T> = { children: new Map() };

		for (const node of nodes) {
			let descendent = root;
			for (let i = 0; i < node.path.length; i++) {
				const segment = node.path[i];
				if (!descendent.children.has(segment)) {
					descendent.children.set(segment, { children: new Map() });
				}
				descendent = descendent.children.get(segment) as Descendent<T>;
				if (i === node.path.length - 1) {
					descendent.node = node;
				}
			}
		}

		return root;
	},

	/**
	 * Build a flat map from a list of file-like objects.
	 */
	toMap: <T extends { path: string[] }>({ nodes }: { nodes: T[] }) => {
		const tree = FileUtils.toTree({ nodes });
		const flat = new Map<string, Descendent<T>>();
		const traverse = (
			[descendentName, descendent]: [string, Descendent<T>],
			prefix = "",
		) => {
			const path = `${prefix}${prefix.length && descendentName.length ? "/" : ""}${descendentName}`;
			if (descendentName.length) {
				flat.set(path, descendent);
			}
			for (const [childName, child] of descendent.children.entries()) {
				traverse([childName, child], path);
			}
		};
		traverse(["", tree]);
		return flat;
	},
} as const;
