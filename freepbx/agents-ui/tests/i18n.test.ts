import { describe, expect, it } from "vitest";
import en from "../src/i18n/en/translation.json";
import italian from "../src/i18n/it/translation.json";

function keys(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    child && typeof child === "object"
      ? keys(child as object, prefix + key + ".")
      : [prefix + key],
  );
}

describe("translations", () => {
  it("have the same keys in English and Italian", () => {
    expect(keys(italian).sort()).toEqual(keys(en).sort());
  });
  it("have no empty text", () => {
    for (const messages of [en, italian])
      expect(
        keys(messages).filter((key) => {
          const text = key
            .split(".")
            .reduce<unknown>(
              (node, part) => (node as Record<string, unknown>)[part],
              messages,
            );
          return typeof text !== "string" || !text.trim();
        }),
      ).toEqual([]);
  });
});
