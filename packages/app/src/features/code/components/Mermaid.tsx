import HighlightBody from "#app/features/code/components/HighlightBody.tsx";
import MermaidContent from "#app/features/code/components/MermaidContent.tsx";

export default function Mermaid({
	code,
	streaming,
}: {
	code: string;
	streaming?: boolean;
}) {
	return (
		<HighlightBody chart={code} streaming={streaming}>
			<div className="rounded-md border border-(--mantine-color-default-border) p-4 text-sm">
				<MermaidContent chart={code} />
			</div>
		</HighlightBody>
	);
}
