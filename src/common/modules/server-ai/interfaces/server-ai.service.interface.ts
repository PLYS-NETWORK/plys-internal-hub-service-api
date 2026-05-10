import { AiAssistantType } from '@database/enums';

export interface IServerAiService {
  /**
   * Executes a server-side chat completion using the active AI provider key
   * for the given assistantType. The provider and model are read from the
   * `ai_provider_api_key` table — switch models in the admin UI without
   * touching code.
   *
   * @param assistantType - Which assistant key to use (INTERVIEW or EVALUATE_ANSWER).
   * @param systemPrompt - System instruction for the AI assistant.
   * @param userPrompt - The user turn message.
   * @returns The raw text response from the AI provider.
   * @throws InternalServerErrorException if no active key is configured for the given type.
   * @throws InternalServerErrorException if the AI provider API call fails.
   */
  complete(
    assistantType: AiAssistantType,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string>;
}
