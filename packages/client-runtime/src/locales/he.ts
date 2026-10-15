import messages from "./he.json" with { type: "json" };

/** Interface copy keyed by the original English wording. */
export const HEBREW_UI_MESSAGES: Readonly<Record<string, string>> = messages;
