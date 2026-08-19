/**
 * Documents built from nothing, for tests that need a real one.
 *
 * A checked-in binary would say nothing about what it contains, and a test that
 * asserts a sentence came out of a document reads much better next to the line
 * that put the sentence in.
 */
export const FileFixtureUtils = {
	/** The smallest PDF that still holds a sentence. */
	buildPdf: ({ sentence }: { sentence: string }): Uint8Array<ArrayBuffer> => {
		const content = `BT /F1 24 Tf 72 700 Td (${sentence}) Tj ET`;
		const objects = [
			"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
			"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
			"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
			"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
			`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`,
		];

		let pdf = "%PDF-1.4\n";
		const offsets: number[] = [];
		for (const object of objects) {
			offsets.push(pdf.length);
			pdf += object;
		}

		const start = pdf.length;
		pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
		for (const offset of offsets)
			pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
		pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;

		return new Uint8Array(new TextEncoder().encode(pdf));
	},
} as const;
