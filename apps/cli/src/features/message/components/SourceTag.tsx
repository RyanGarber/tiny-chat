import { useMessageStore } from "@tiny-chat/client/features/message/stores/useMessageStore.ts";
import { SourceUtils } from "@tiny-chat/core/features/data/utils/SourceUtils.ts";
import type { ReactNode } from "react";
import { Citation } from "./Citation.tsx";

/** Inline source references, optionally attached to the text they cite. */
export default function SourceTag({
	sources: sourceKeys,
	children,
	cited = children,
}: {
	sources: string;
	children?: ReactNode;
	cited?: ReactNode;
}) {
	// Only source tags need to rerender when the chat's sources change.
	const sources = useMessageStore((state) => state.sources);
	const keys = SourceUtils.matchKeys({ sources, keys: sourceKeys });

	return (
		<>
			{children}
			{keys.map((key) => (
				<Citation key={key} sourceKey={key} sources={sources} cited={cited} />
			))}
		</>
	);
}
