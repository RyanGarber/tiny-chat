import "temporal-polyfill/full/global";

const TEMPORAL_CTORS = {
	"Temporal.PlainDateTime": Temporal.PlainDateTime,
	"Temporal.PlainDate": Temporal.PlainDate,
	"Temporal.PlainTime": Temporal.PlainTime,
	"Temporal.Instant": Temporal.Instant,
	"Temporal.ZonedDateTime": Temporal.ZonedDateTime,
	"Temporal.Duration": Temporal.Duration,
} as const;

type TemporalTag = keyof typeof TEMPORAL_CTORS;

interface TemporalMarker {
	__temporal: TemporalTag;
	iso: string;
}

function temporalTagOf(value: unknown): TemporalTag | undefined {
	if (typeof value !== "object" || value === null) return undefined;
	const tag = (value as { [Symbol.toStringTag]?: string })[Symbol.toStringTag];
	return tag !== undefined && tag in TEMPORAL_CTORS
		? (tag as TemporalTag)
		: undefined;
}

function isTemporalMarker(value: unknown): value is TemporalMarker {
	return (
		typeof value === "object" &&
		value !== null &&
		"__temporal" in value &&
		(value as { __temporal: never }).__temporal in TEMPORAL_CTORS
	);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return (
		typeof value === "object" && value !== null && value.constructor === Object
	);
}

function mapDeep(value: unknown, transform: (v: unknown) => unknown): unknown {
	const transformed = transform(value);
	if (transformed !== value) return transformed;
	if (Array.isArray(value)) return value.map((v) => mapDeep(v, transform));
	if (isPlainObject(value)) {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value)) out[k] = mapDeep(v, transform);
		return out;
	}
	return value;
}

export const TypeUtils = {
	/**
	 * Structured clone that round-trips parts not natively supported by JavaScript.
	 */
	deepClone: <T>(value: T): T => {
		const marked = mapDeep(value, (v) => {
			const tag = temporalTagOf(v);
			return tag
				? ({
						__temporal: tag,
						iso: (v as { toString(): string }).toString(),
					} satisfies TemporalMarker)
				: v;
		});

		const cloned = structuredClone(marked);

		return mapDeep(cloned, (v) =>
			isTemporalMarker(v) ? TEMPORAL_CTORS[v.__temporal].from(v.iso) : v,
		) as T;
	},
} as const;
