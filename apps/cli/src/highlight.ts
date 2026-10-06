// Bun entrypoint for the highlight worker, built next to `index.ts` (see
// `scripts/compile.ts`) so `client.ts` can find it beside the bundle.
import "#core/core/services/HighlightWorker.ts";
