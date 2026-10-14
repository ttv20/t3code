const MARKDOWN_LETTER_REGEX = /\p{L}/u;
const MARKDOWN_RTL_LETTER_REGEX = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/u;
const STREAMING_DIRECTION_MIN_LEAD = 8;
const STREAMING_DIRECTION_LEAD_RATIO = 1.25;

export type MarkdownDirection = "ltr" | "rtl";

export interface MarkdownDirectionCounts {
  readonly ltr: number;
  readonly rtl: number;
}

function backtickRunLength(text: string, start: number): number {
  let end = start;
  while (text[end] === "`") end += 1;
  return end - start;
}

function closingBacktickRun(text: string, start: number, length: number): number {
  let cursor = start;
  while (cursor < text.length) {
    if (text[cursor] !== "`") {
      cursor += 1;
      continue;
    }
    const candidateLength = backtickRunLength(text, cursor);
    if (candidateLength === length) return cursor;
    cursor += candidateLength;
  }
  return -1;
}

function isEscapedMarkdownCharacter(text: string, index: number): boolean {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

function markdownLinkDestinationEnd(text: string, openingStart: number): number {
  let depth = 0;
  for (let cursor = openingStart; cursor < text.length; cursor += 1) {
    if (isEscapedMarkdownCharacter(text, cursor)) continue;
    if (text[cursor] === "(") {
      depth += 1;
      continue;
    }
    if (text[cursor] !== ")") continue;
    depth -= 1;
    if (depth === 0) return cursor;
  }
  // A destination arriving during streaming is not visible message text and
  // must not temporarily flip the whole message before its closing parenthesis.
  return text.length - 1;
}

export function countMarkdownDirectionCharacters(text: string): MarkdownDirectionCounts {
  let ltr = 0;
  let rtl = 0;
  for (let cursor = 0; cursor < text.length; cursor += 1) {
    const character = text[cursor]!;
    if (character === "`" && !isEscapedMarkdownCharacter(text, cursor)) {
      const openingLength = backtickRunLength(text, cursor);
      const closingStart = closingBacktickRun(text, cursor + openingLength, openingLength);
      if (closingStart !== -1) {
        cursor = closingStart + openingLength - 1;
        continue;
      }
      cursor += openingLength - 1;
      continue;
    }
    if (
      character === "]" &&
      text[cursor + 1] === "(" &&
      !isEscapedMarkdownCharacter(text, cursor)
    ) {
      cursor = markdownLinkDestinationEnd(text, cursor + 1);
      continue;
    }
    if (!MARKDOWN_LETTER_REGEX.test(character)) continue;
    if (MARKDOWN_RTL_LETTER_REGEX.test(character)) rtl += 1;
    else ltr += 1;
  }
  return { ltr, rtl };
}

export function resolveMarkdownDirection(
  counts: MarkdownDirectionCounts,
  fallback: MarkdownDirection = "ltr",
): MarkdownDirection {
  if (counts.rtl === counts.ltr) return fallback;
  return counts.rtl > counts.ltr ? "rtl" : "ltr";
}

export function resolveStreamingMarkdownDirection(
  counts: MarkdownDirectionCounts,
  current: MarkdownDirection,
): MarkdownDirection {
  const currentCount = counts[current];
  const other: MarkdownDirection = current === "ltr" ? "rtl" : "ltr";
  const otherCount = counts[other];
  if (otherCount === 0 || otherCount <= currentCount) return current;
  if (currentCount === 0) return other;
  const hasClearLead =
    otherCount - currentCount >= STREAMING_DIRECTION_MIN_LEAD &&
    otherCount >= currentCount * STREAMING_DIRECTION_LEAD_RATIO;
  return hasClearLead ? other : current;
}
