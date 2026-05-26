export interface IServerAiProvider {
  /**
   * Sends a single chat completion request to the provider.
   * @param model - Provider-specific model identifier.
   * @param apiKey - Decrypted plaintext API key.
   * @param systemPrompt - System-level instruction for the assistant.
   * @param userPrompt - The user turn content.
   * @returns The assistant's text response.
   * @throws InternalServerErrorException if the provider call fails.
   */
  complete(
    model: string,
    apiKey: string,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string>;
}
