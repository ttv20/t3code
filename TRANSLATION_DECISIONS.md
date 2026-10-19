# Translation decisions

This file records the translation and bidirectional-text choices for the RTL fork.
[PATCH.md](PATCH.md#interface-translation-and-direction) describes the resulting behavior.

## Translate interface copy, preserve content

Translate labels, actions, explanations, confirmations, notifications, and dates created by T3 Code.
Keep conversation text, provider output, project and thread titles, branch and terminal names,
paths, URLs, commands, model identifiers, and license text in their original form. A value that
happens to match an English interface label must still retain its original value.

For dynamic text, translate the complete template and then insert its values. For example,
translate `Delete thread "{0}"?` and supply the original thread title as `{0}`. Translating the
assembled string would miss the catalog entry or accidentally translate a user-supplied name.
Translate app-owned singular and plural nouns before inserting them into a template.

Use the same terminology for an action in chat, Settings, the command palette, sidebar menus,
and confirmations. Preserve the distinction between settling, archiving, and deleting a thread.
Reuse established translations such as `מסוף` for the singular terminal label.

## Shared catalogs and fallback

English source messages are the catalog keys and the fallback when a translation is missing.
Web, desktop, and native mobile use the shared [translation runtime](packages/client-runtime/src/i18n.ts).
Keep translation in the client so a remote environment does not impose its language on other clients.

English, Hebrew, Arabic, Persian, and system-language selection are supported. System-language
selection falls back to English when no supported language matches. Arabic and Persian include
machine-assisted translations with terminology corrections; their presence does not imply native-speaker review.

## Language and layout direction are separate

Save language and direction per client. Automatic layout direction is RTL for Hebrew, Arabic,
and Persian, and LTR for English. An explicit direction preference changes layout independently
of translation. Message direction follows the message's text independently of interface language.

Use RTL for a message when at least 30% of its visible letters are RTL, ignoring code and
hidden link destinations. During streaming, keep the current direction near the threshold;
use the exact threshold when complete. In web and desktop Markdown, a paragraph or source
line starting with an RTL letter also aligns right even below the message threshold.

Mirror surrounding controls and spacing while preserving the LTR order of technical content.
Isolate filename segments and paths, including empty-field path placeholders. Use bidi isolation
for embedded names so their punctuation does not reorder neighboring translated text. Input
adornments follow interface direction even when the input text chooses a different direction.

Web and desktop share the web layout. Native mobile shares catalogs and helpers but has its own
layout and rendering, so a web correction alone does not establish native mobile coverage.

## Sentence boundaries in mixed RTL prose

In prose with at least 30% RTL letters, or starting with an RTL letter, separate adjacent Latin words or
numbers across `.`, `:`, `?`, `!`, or an ellipsis when whitespace follows the separator. Insert
one RLM, `U+200F`, after the whitespace and before the next segment, including its opening quote
or parenthesis. This keeps the two fragments from joining into one LTR run.

The rule covers Latin-to-Latin, Latin-to-number, number-to-Latin, and number-to-number boundaries.
For example, `ending. and` becomes `ending. <RLM>and`, and `123: 456` becomes `123: <RLM>456`
inside RTL prose. `<RLM>` here denotes the invisible character, not literal displayed text.

Apply the correction during display, including timeline previews, without rewriting stored
messages. Preserve emphasis and link labels, leave code and link destinations untouched, and
do not duplicate an existing mark. Keep the rule shared between web and native Markdown renderers
through the [sentence-boundary helper](packages/client-runtime/src/markdownRtl.ts).

## Dates and scheduling

Use the interface locale for dates, weekdays, and relative time rather than concatenating
English fragments such as `ago`. Keep scheduling dates Gregorian in every language, including
Persian, so the selected date and the server's stored day agree. Preserve the user's time-format
preference when formatting snooze times.
