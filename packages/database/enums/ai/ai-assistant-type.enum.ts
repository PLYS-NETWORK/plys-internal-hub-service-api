// Which assistant feature an AI provider key powers. The active-key partition
// in `ai_provider_api_key` is keyed on this column — exactly one row per
// assistant type may be active at a time, regardless of which provider it
// targets. The FE BFF passes this on every `GET /ai-provider-keys/active`
// call to fetch the right key for the feature making the request.
export enum AiAssistantType {
  CHAT_BOX = 'chat_box',
  INTERVIEW = 'interview',
  EVALUATE_ANSWER = 'evaluate_answer',
}

export const AI_ASSISTANT_TYPES: readonly AiAssistantType[] = [
  AiAssistantType.CHAT_BOX,
  AiAssistantType.INTERVIEW,
  AiAssistantType.EVALUATE_ANSWER,
];
