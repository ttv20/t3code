export type TextDirection = "ltr" | "rtl";

// Hebrew through Arabic Extended-A, their presentation forms, and the
// supplementary right-to-left blocks.
const RTL_LETTER = /[֐-ࣿיִ-﷿ﹰ-﻿\u{10800}-\u{10FFF}\u{1E800}-\u{1EFFF}]/u;
const LETTER = /\p{L}/u;

/**
 * Words without letters do not vote. Mixed technical prose stays RTL when at
 * least 30% of words start with an RTL letter, even when an English term leads.
 */
export function textDirection(text: string): TextDirection | undefined {
  let rtlWords = 0;
  let ltrWords = 0;
  for (const word of text.split(/\s+/)) {
    const letter = LETTER.exec(word)?.[0];
    if (!letter) continue;
    const direction = RTL_LETTER.test(letter) ? "rtl" : "ltr";
    if (direction === "rtl") rtlWords += 1;
    else ltrWords += 1;
  }
  const words = rtlWords + ltrWords;
  if (words === 0) return undefined;
  return rtlWords * 10 >= words * 3 ? "rtl" : "ltr";
}
