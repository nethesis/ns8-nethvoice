import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const base = new URL("../../../var/www/html/freepbx/rest/lib/agents/contracts/", import.meta.url);
const read = (file: string) => JSON.parse(readFileSync(new URL(file, base), "utf8"));

for (const language of ["en", "it"]) {
  test(`numeric settings are checked before saving (${language})`, async ({page}) => {
    const draft = read("published-v8.example.json");
    for (const key of ["agent_id", "destination_id", "workflow_version", "provider"]) delete draft[key];
    draft.provider_binding_id = null;
    for (const binding of draft.tool_bindings) if (binding.tool_id === "telephony.hangup") binding.enabled = true;
    const record = {agent_id: "receptionist", name: "Receptionist", agent_type: "basic_voice", kind: "builtin", revision: 1, workflow_version: null, published: null, draft};
    let writes = 0;
    await page.addInitScript(language => {
      localStorage.setItem("secretkey", JSON.stringify({user: "administrator", hash: "synthetic"}));
      localStorage.setItem("nethvoice.agents.language", language);
    }, language);
    await page.route("**/freepbx/rest/agents/**", async route => {
      const path = new URL(route.request().url()).pathname.replace("/freepbx/rest/agents", "");
      if (route.request().method() === "PUT") writes++;
      await route.fulfill({json: path === "/access" ? {csrf: "synthetic-csrf"} : path === "/catalog" ? {tools: read("tools-v5.json"), default_language: language, extensions: [], languages: [{id: language, label: language}]} : path === "/trunks" ? {items: []} : path === "/destinations" ? {items: [], next_offset: null, modules: {}, unavailable_ids: []} : record});
    });
    const text = language === "en"
      ? {duration: "Maximum call duration", lookback: "Lookback period", goodbye: "Maximum goodbye duration", save: "Save draft", range: (min: number, max: number) => `Enter a value from ${min} to ${max}`}
      : {duration: "Durata massima chiamata", lookback: "Periodo considerato", goodbye: "Durata massima del congedo", save: "Salva bozza", range: (min: number, max: number) => `Inserisci un valore da ${min} a ${max}`};
    await page.goto("./#/agents/receptionist");
    await page.getByLabel(text.duration, {exact: true}).fill("");
    await page.getByLabel(text.lookback, {exact: true}).fill("0");
    await page.getByLabel(text.goodbye, {exact: true}).fill("11");
    await page.getByRole("button", {name: text.save, exact: true}).click();
    await expect(page.getByText(text.range(30, 3600))).toBeVisible();
    await expect(page.getByText(text.range(1, 90))).toBeVisible();
    await expect(page.getByText(text.range(1, 10))).toBeVisible();
    expect(writes).toBe(0);
    await page.getByLabel(text.goodbye, {exact: true}).fill("5");
    await expect(page.getByText(text.range(1, 10))).toHaveCount(0);
    await page.getByLabel(text.duration, {exact: true}).fill("900");
    await page.getByLabel(text.lookback, {exact: true}).fill("7");
    await page.getByRole("button", {name: text.save, exact: true}).click();
    await expect.poll(() => writes).toBe(1);
  });
}
