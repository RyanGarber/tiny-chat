import { testUser } from "../../../tests.ts";
import { EmbeddingService } from "../../embedding/services/EmbeddingService.ts";
import { MemorySearchService } from "./MemorySearchService.ts";
import { MemoryService } from "./MemoryService.ts";

const user = testUser();
const other = testUser();
const defaults = {
	category: "PROJECTS" as const,
	stability: "LONG_TERM" as const,
	confidence: 0.9,
	evidence: [],
};

describe("MemorySearchService", () => {
	it("searches fact and evidence with typo tolerance and isolates users", async () => {
		const fact = await MemoryService.createMemory({
			user,
			...defaults,
			fact: "chrysanthemum cultivation",
		});
		const evidence = await MemoryService.createMemory({
			user,
			...defaults,
			fact: "The garden needs attention",
			evidence: ["chrysanthemum watering"],
		});
		await MemoryService.createMemory({
			user: other,
			...defaults,
			fact: "chrysanthemum cultivation",
		});
		const exact = await MemorySearchService.searchMemories({
			user,
			searchText: "chrysanthemum",
		});
		expect(new Set(exact.map((row) => row.id))).toEqual(
			new Set([fact.id, evidence.id]),
		);
		const repeated = await MemorySearchService.searchMemories({
			user,
			searchText: "Chrysanthemum ".repeat(3000),
		});
		expect(repeated.map((row) => row.id)).toEqual(exact.map((row) => row.id));
		const fuzzy = await MemorySearchService.searchMemories({
			user,
			searchText: "chrysanthemun",
		});
		expect(new Set(fuzzy.map((row) => row.id))).toEqual(
			new Set([fact.id, evidence.id]),
		);
		expect(
			await MemorySearchService.searchMemories({
				user,
				searchText: "chrysanthemum",
				minConfidence: 1,
			}),
		).toEqual([]);
	});
	it("retrieves semantic-only matches and tolerates mixed dimensions and invalid vectors", async () => {
		const memory = await MemoryService.createMemory({
			user,
			...defaults,
			fact: "A submarine expedition",
		});
		await EmbeddingService.setEmbeddings({
			user,
			embeddings: [{ type: "memory", id: memory.id, embedding: [1, 0, 0] }],
		});
		expect(
			(
				await MemorySearchService.searchMemories({
					user,
					searchText: "unrelatedtoken",
					searchEmbedding: [1, 0, 0],
				})
			).map((row) => row.id),
		).toContain(memory.id);
		for (const searchEmbedding of [[1, 0], [0, 0, 0], [], [Number.NaN]]) {
			expect(
				(
					await MemorySearchService.searchMemories({
						user,
						searchText: "submarine",
						searchEmbedding,
					})
				).map((row) => row.id),
			).toContain(memory.id);
		}
		expect(
			await MemorySearchService.searchMemories({ user, searchText: "   " }),
		).toEqual([]);
		expect(
			await MemorySearchService.searchMemories({
				user,
				searchText: "submarine",
				tokens: 0,
			}),
		).toEqual([]);
	});
});
