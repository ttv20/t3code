import messages from "./fa.json" with { type: "json" };

/** Interface copy keyed by the original English wording. */
export const PERSIAN_UI_MESSAGES: Readonly<Record<string, string>> = messages;
