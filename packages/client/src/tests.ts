// biome-ignore-all lint/correctness/noChildrenProp: fixture
/// <reference types="../../../vitest.context.d.ts" />

import "temporal-polyfill/full/global";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { zEnv } from "@tiny-chat/core/src/core/types/env.ts";
import { createElement, type ReactNode } from "react";
import { inject } from "vitest";
import { type Client, ClientContext, createClient } from "./client.ts";

let client: Client;
let token: string | null | undefined;

export async function onBeforeAll({ env }: { env: zEnv }) {
	client = createClient({
		env,
		host: inject("serverUrl"),
		getToken: () => token,
		setToken: (value) => (token = value),
		getStorage: () => null,
		setStorage: () => void 0,
		queryClient: new QueryClient({
			defaultOptions: {
				queries: {
					retry: false,
					gcTime: 0,
				},
				mutations: {
					retry: false,
					gcTime: 0,
				},
			},
		}),
	});
}

export function create(children: ReactNode) {
	const root = createElement(QueryClientProvider, {
		client: client.queryClient,
		children: createElement(ClientContext, { value: client, children }),
	});

	return { client, root };
}

export async function onAfterAll() {
	client.queryClient.clear();
}
