// Bun entrypoint for the highlight worker, built next to `index.ts` (see
// `scripts/compile.ts`) so `client.ts` can find it beside the bundle.
import "@tiny-chat/core/core/services/HighlightWorker.ts";
