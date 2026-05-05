// Model providers backed by the API key vault. The BE never imports any model
// SDK — `provider` is metadata used by the FE BFF to pick the right SDK on its
// side. Adding a new provider here is safe; consumers ignore values they don't
// recognise.
export enum AiProvider {
  GROQ = 'groq',
  GEMINI = 'gemini',
  OPENAI = 'openai',
}

export const AI_PROVIDERS: readonly AiProvider[] = [
  AiProvider.GROQ,
  AiProvider.GEMINI,
  AiProvider.OPENAI,
];
