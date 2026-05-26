import { ICopyleaksAiResult } from './copyleaks-result.interface';

/**
 * Strategy interface for AI content detection.
 *
 * Any concrete provider (Copyleaks, GPTZero, etc.) must implement
 * this contract. Swapping providers requires only:
 *   1. A new class implementing ICopyleaksProvider
 *   2. Changing the binding in CopyleaksModule — CopyleaksService is untouched.
 */
export interface ICopyleaksProvider {
  /**
   * Check a single text for AI-generated content.
   * @param text The text to analyse.
   * @returns Detection result with score and classification.
   */
  checkAiContent(text: string): Promise<ICopyleaksAiResult>;
}
