import messages from "./ar.json" with { type: "json" };

/** Interface copy keyed by the original English wording. */
export const ARABIC_UI_MESSAGES: Readonly<Record<string, string>> = messages;
