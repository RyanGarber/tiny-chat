import { z } from 'zod';
import { zConfig } from '../types.ts';
import type { User } from '../server.ts';
import { chatProviders } from '../providers/chat/index.ts';

export async function embed(user: User, texts: string[]) {
  const config = getEmbedConfig(user);
  if (!config) return null;

  const provider = chatProviders.find((s) => s.name === config.provider);
  if (!provider) return null;

  return provider.embed(user, texts, config);
}

export function getEmbedConfig(user: User) {
  const config = zConfig.safeParse(user.settings?.embeddingConfig);
  if (!config.success) {
    return undefined;
  }
  return config.data;
}

export function combineVectorsWeighted(vectors: number[][], weights: number[]) {
  const dim = vectors[0].length;
  const combined: number[] = new Array(dim).fill(0);
  for (let i = 0; i < vectors.length; i++) {
    const w = weights[i] ?? 1 / vectors.length;
    for (let j = 0; j < dim; j++) {
      combined[j] += vectors[i][j] * w;
    }
  }
  return normalizeVector(combined);
}

export function normalizeVector(v: number[]): number[] {
  const magnitude = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
  if (magnitude === 0) return v;
  return v.map((x) => x / magnitude);
}

export function getCosineSimilarity(a: number[], b: number[]) {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export const SearchOptions = z.object({
  maxCount: z.number().optional(),
  minCount: z.number().optional(),
  diversityWeight: z.number().optional(),
});

export function getMostRelevant(
  subjectEmbedding: number[],
  candidates: { value: unknown; embedding: number[] }[],
  options: z.infer<typeof SearchOptions> = {},
) {
  if (!candidates.length) return [];

  const { maxCount = 10, minCount = 1, diversityWeight = 0.4 } = options;

  const scoredCandidates = candidates.map((c) => ({
    ...c,
    score: getCosineSimilarity(subjectEmbedding, c.embedding),
  }));

  const mean = scoredCandidates.reduce((s, c) => s + c.score, 0) / scoredCandidates.length;
  const variance =
    scoredCandidates.reduce((s, c) => s + (c.score - mean) ** 2, 0) / scoredCandidates.length;
  const standardDeviation = Math.sqrt(variance);

  const threshold = mean + standardDeviation / 2;

  let bestCandidates = scoredCandidates
    .filter((c) => c.score >= threshold)
    .sort((a, b) => b.score - a.score);

  if (bestCandidates.length < minCount) {
    // fallback
    bestCandidates = scoredCandidates.sort((a, b) => b.score - a.score).slice(0, minCount);
  }

  const finalCandidates: (typeof scoredCandidates)[number][] = [];

  while (finalCandidates.length < maxCount && bestCandidates.length) {
    let bestIndex = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < bestCandidates.length; i++) {
      const score = bestCandidates[i].score;

      const redundancy = finalCandidates.length
        ? Math.max(
            ...finalCandidates.map((s) =>
              getCosineSimilarity(bestCandidates[i].embedding, s.embedding),
            ),
          )
        : 0;

      const mmrScore = (1 - diversityWeight) * score - diversityWeight * redundancy;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIndex = i;
      }
    }

    finalCandidates.push(bestCandidates.splice(bestIndex, 1)[0]);
  }

  return finalCandidates;
}
