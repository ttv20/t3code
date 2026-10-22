import { describe, expect, it } from "vite-plus/test";

import { textDirection } from "./textDirection";

describe("textDirection", () => {
  it.each([
    ["Arabic", "اكتب دالة تجمع الأرقام", "rtl"],
    ["Hebrew", "תקן את הבאג", "rtl"],
    ["English", "fix the failing test", "ltr"],
    [
      "Arabic that opens with an English term",
      "StrictMode: يعيد الـ render مرتين في التطوير",
      "rtl",
    ],
    ["English quoting one Arabic word", "translate the label مرحبا for the login screen", "ltr"],
    ["a mixed line opening with English", "React مكتبة", "rtl"],
    ["a tie that opens in Arabic", "مكتبة React", "rtl"],
    ["Arabic around numbers and punctuation", "عدّل السطر 42، ثم شغّل الاختبارات (3)", "rtl"],
  ])("reads %s", (_, text, direction) => {
    expect(textDirection(text)).toBe(direction);
  });

  it("leaves text without letters to its surroundings", () => {
    expect(textDirection("42 — 7 ✓")).toBeUndefined();
  });

  it("uses an inclusive 30 percent of words, independently of word length", () => {
    expect(textDirection("one two three four five six seven א ב ג")).toBe("rtl");
    expect(textDirection("one two three four five six seven eight א ב")).toBe("ltr");
    expect(textDirection("one two three four five six seven אבגדהוזחט יכלמנסעפצ קרשת")).toBe("rtl");
    expect(textDirection("one two three four five six seven 123 ! 456 א ב ג")).toBe("rtl");
    expect(textDirection("one two three four five six seven שלום عالم فارسی")).toBe("rtl");
  });
});
