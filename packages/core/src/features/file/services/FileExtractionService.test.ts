import { describe, expect, it } from "vitest";
import { FileFixtureUtils } from "../utils/FileFixtureUtils.ts";
import { FileExtractionService } from "./FileExtractionService.ts";

describe("FileExtractionService", () => {
	describe("getFormat", () => {
		it("recognises the formats it can unpack", () => {
			expect(FileExtractionService.getFormat({ name: "handbook.pdf" })).toBe(
				"pdf",
			);
			expect(FileExtractionService.getFormat({ name: "Notes.DOCX" })).toBe(
				"docx",
			);
			expect(
				FileExtractionService.getFormat({ path: "/mnt/uploads/x/budget.xlsx" }),
			).toBe("xlsx");
			expect(
				FileExtractionService.getFormat({ path: ["docs", "budget.xlsx"] }),
			).toBe("xlsx");
		});

		it("leaves everything else alone", () => {
			expect(FileExtractionService.getFormat({ name: "app.ts" })).toBeNull();
			expect(FileExtractionService.getFormat({ name: "logo.png" })).toBeNull();
			// No converter for these, so they stay bytes and are judged as such.
			expect(FileExtractionService.getFormat({ name: "deck.pptx" })).toBeNull();
			expect(FileExtractionService.getFormat({ name: "old.doc" })).toBeNull();
		});

		it("falls back to the mime type when the name says nothing", () => {
			expect(
				FileExtractionService.getFormat({
					name: "download",
					mime: "application/pdf",
				}),
			).toBe("pdf");
		});

		// A mime type is often guessed from the same bytes we are about to open,
		// and its extension must never outrank the name the file was given.
		it("does not read a fallback mime type as a format", () => {
			expect(
				FileExtractionService.getFormat({
					name: "notes.txt",
					mime: "application/octet-stream",
				}),
			).toBeNull();
		});
	});

	describe("extract", () => {
		it("reads the words out of a pdf", async () => {
			await expect(
				FileExtractionService.extract({
					data: FileFixtureUtils.buildPdf({
						sentence: "Termination clause: 30 days.",
					}),
					name: "contract.pdf",
				}),
			).resolves.toContain("Termination clause: 30 days.");
		});

		it("returns null for a document it cannot open", async () => {
			expect(
				await FileExtractionService.extract({
					data: new Uint8Array([37, 80, 68, 70, 0, 1, 2]),
					name: "broken.pdf",
				}),
			).toBeNull();
		});

		it("returns null for a file that is not a document at all", async () => {
			expect(
				await FileExtractionService.extract({
					data: new TextEncoder().encode("const x = 1;"),
					name: "app.ts",
				}),
			).toBeNull();
		});

		it("leaves a document too large to be worth opening", async () => {
			expect(
				await FileExtractionService.extract({
					data: new Uint8Array(FileExtractionService.maxBytes + 1),
					name: "huge.pdf",
				}),
			).toBeNull();
		});
	});
});
