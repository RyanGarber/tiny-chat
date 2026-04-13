import { zGenerateOutput } from '@tiny-chat/core-backend/src/types.ts';

declare const __TAURI_DEV_HOST__: string | undefined;

function getBaseUrl() {
  return import.meta.env.DEV
    ? `http://${__TAURI_DEV_HOST__ ?? 'localhost'}:${import.meta.env.VITE_BACKEND_PORT}`
    : (import.meta.env.VITE_BACKEND_URL as string);
}

export async function* generate(
  path: string,
  input: Record<string, unknown>,
  signal?: AbortSignal,
) {
  const url = `${getBaseUrl()}${path}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
    },
    body: JSON.stringify(input),
    signal,
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop()!;

    for (const line of lines) {
      console.debug('Received:', line);
      if (line.startsWith('data: ')) {
        yield zGenerateOutput.parse(JSON.parse(line.slice(6)));
      }
      if (line.startsWith('error: ')) {
        throw new Error(line.slice(7));
      }
    }
  }
}
