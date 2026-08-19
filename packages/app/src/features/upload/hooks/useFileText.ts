import { FileExtractionService } from "@tiny-chat/core/src/features/file/services/FileExtractionService.ts";
import { FileUtils } from "@tiny-chat/core/src/features/file/utils/FileUtils.ts";
import { useEffect, useState } from "react";

export interface FileTextState {
	/** The file as text, or null while it is being read and if it cannot be. */
	text: string | null;
	loading: boolean;
	/**
	 * Set when the text was unpacked from a document rather than decoded from
	 * the file's own bytes, so it can be shown as the markdown it now is.
	 */
	extracted: boolean;
}

/**
 * A file as readable text.
 *
 * Most files only need decoding, which is immediate. A PDF, a Word document or
 * a spreadsheet has to be unpacked by a converter that is loaded on demand, so
 * this reports a loading state for those and nothing else — a preview of a
 * source file should not flash.
 */
export function useFileText({
	name,
	data,
	mime,
}: {
	name: string;
	/** Raw bytes, or the base64 the API hands back. */
	data: Uint8Array | string;
	mime: string;
}): FileTextState {
	const extracted = FileExtractionService.canExtract({ name, mime });
	const [document, setDocument] = useState<{ text: string | null } | null>(
		null,
	);

	useEffect(() => {
		if (!extracted) return;

		let cancelled = false;
		setDocument(null);

		void FileExtractionService.extract({
			data: FileUtils.getBufferFromBytes({ data }),
			name,
			mime,
		}).then((text) => {
			if (!cancelled) setDocument({ text });
		});

		return () => {
			cancelled = true;
		};
	}, [extracted, name, data, mime]);

	if (!extracted) {
		return {
			text: FileUtils.getTextFromBytes({ data, mime }),
			loading: false,
			extracted,
		};
	}

	return {
		text: document?.text ?? null,
		loading: document === null,
		extracted,
	};
}
