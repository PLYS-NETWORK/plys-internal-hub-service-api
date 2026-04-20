/**
 * Result of an AI content detection check for a single text input.
 */
export interface ICopyleaksAiResult {
  /** AI probability score from 0 to 100. */
  readonly aiScore: number;
  /** Whether the text is classified as AI-generated (score > threshold). */
  readonly isAiGenerated: boolean;
}

/**
 * Aggregated result across multiple text inputs.
 */
export interface ICopyleaksAggregateResult {
  /** Highest AI score across all checked texts. */
  readonly maxAiScore: number;
  /** Whether any text exceeded the AI threshold. */
  readonly hasAiContent: boolean;
  /** Per-text breakdown. */
  readonly results: ICopyleaksAiResult[];
}
