import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { GitHubAccountService } from "../../user/services/GitHubAccountService.ts";
import { GitHubApiService } from "./GitHubApiService.ts";

const user = { id: "test-user" } as zUser;

describe("GitHubApiService", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("prefers a linked-account token", async () => {
		vi.spyOn(GitHubAccountService, "getToken").mockResolvedValue("secret");
		const fetch = vi.fn(
			async (_input: string | URL | Request, _init?: RequestInit) =>
				Response.json({ full_name: "acme/tool" }),
		);
		vi.stubGlobal("fetch", fetch);

		await GitHubApiService.request({
			user,
			path: "/repos/acme/tool",
		});

		expect(fetch).toHaveBeenCalledOnce();
		expect(fetch.mock.calls[0]?.[1]?.headers).toMatchObject({
			Authorization: "Bearer secret",
		});
	});

	it("uses an anonymous request when no account is linked", async () => {
		vi.spyOn(GitHubAccountService, "getToken").mockResolvedValue(undefined);
		const fetch = vi.fn(
			async (_input: string | URL | Request, _init?: RequestInit) =>
				Response.json({ full_name: "acme/tool" }),
		);
		vi.stubGlobal("fetch", fetch);

		await GitHubApiService.request({
			user,
			path: "/repos/acme/tool",
		});

		expect(fetch.mock.calls[0]?.[1]?.headers).not.toHaveProperty(
			"Authorization",
		);
	});

	it("retries anonymously when a linked token is rejected", async () => {
		vi.spyOn(GitHubAccountService, "getToken").mockResolvedValue("stale");
		const fetch = vi
			.fn(async (_input: string | URL | Request, _init?: RequestInit) =>
				Response.json({ full_name: "unused" }),
			)
			.mockResolvedValueOnce(
				Response.json({ message: "Bad credentials" }, { status: 401 }),
			)
			.mockResolvedValueOnce(Response.json({ full_name: "acme/tool" }));
		vi.stubGlobal("fetch", fetch);

		await GitHubApiService.request({
			user,
			path: "/repos/acme/tool",
		});

		expect(fetch).toHaveBeenCalledTimes(2);
		expect(fetch.mock.calls[1]?.[1]?.headers).not.toHaveProperty(
			"Authorization",
		);
	});

	it("cannot escape the repository resource boundary", async () => {
		const fetch = vi.fn();
		vi.stubGlobal("fetch", fetch);

		await expect(
			GitHubApiService.request({
				user,
				path: "/repos/acme/tool/../../user",
				preferLinkedAccount: false,
			}),
		).rejects.toThrow(/limited to repository resources/);
		expect(fetch).not.toHaveBeenCalled();
	});
});
