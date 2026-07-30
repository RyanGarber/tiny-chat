export const _RRule = await import("rrule");
// biome-ignore lint/suspicious/noTsIgnore: false negative
// @ts-ignore
export const RRule = _RRule.default?.RRule ?? _RRule.RRule;

const _fm = await import("front-matter");
// biome-ignore lint/suspicious/noTsIgnore: false negative
// @ts-ignore
export const fm = _fm.default?.default ?? _fm.default;
