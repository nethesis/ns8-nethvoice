import { expect, test } from "@playwright/test";
import { drawer, flip, mockApi, profile } from "./agentsMock";

const text = {
  en: { transfer: "Transfer calls", attended: /Consult before connecting/, single: "Colleagues are consulted by Private assistant.", save: "Save draft" },
  it: { transfer: "Trasferisci chiamate", attended: /Consulta prima di collegare/, single: "I colleghi vengono consultati da Private assistant.", save: "Salva bozza" },
};
for (const language of ["en", "it"] as const) {
  test(`attended transfer is explicitly enabled and saved per agent (${language})`, async ({ page }) => {
    const mock = await mockApi(page, { assistants: [{ agent_id: "internal", name: "Private assistant", workflow_version: 1 }] }, language);
    const original = structuredClone(mock.profiles.receptionist.draft);
    await page.goto("./#/agents/receptionist");
    const labels = text[language];
    await expect(page.getByRole("radio", { name: labels.attended })).toBeVisible();
    expect(mock.requests).toEqual([]);
    await page.getByRole("radio", { name: labels.attended }).check();
    // The only published assistant is selected by itself.
    await expect(page.getByText(labels.single, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: labels.save, exact: true }).click();
    await expect.poll(() => mock.requests).toEqual(["PUT /profiles/receptionist"]);
    const draft = mock.profiles.receptionist.draft;
    expect(draft).toMatchObject({ contract_version: 9, role: "public", consultation: { mode: "attended", phone: true, chat: false, assistant_id: "internal" } });
    expect(draft.tool_bindings[1].config).toEqual(original.tool_bindings[1].config);
    expect(draft.tool_bindings[1].tool_version).toBe(3);
    // Transfer to people belongs to Transfer calls.
    await flip(page, labels.transfer);
    await expect(page.getByRole("radio", { name: labels.attended })).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("internal assistant has its own configuration and no public PBX tools", async ({ page }) => {
  const mock = await mockApi(page, { profiles: { receptionist: profile() } });
  await page.goto("./#/agents");
  await page.getByRole("button", { name: "Create agent", exact: true }).click();
  await page.getByRole("combobox", { name: "Agent type", exact: true }).click();
  await page.getByRole("option", { name: /^Internal consultation assistant/ }).click();
  await page.getByLabel("Name", { exact: true }).fill("Private assistant");
  await drawer(page).getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Transfer calls", exact: true })).toHaveCount(0);
  await page.getByLabel(/^Chat model ID/).fill("synthetic-text-model");
  await drawer(page).getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("dialog").filter({ hasText: "Unsaved changes" }).getByRole("button", { name: "Save draft", exact: true }).click();
  await expect.poll(() => mock.profiles.agent_new?.draft?.chat_model).toBe("synthetic-text-model");
  const saved = mock.profiles.agent_new.draft;
  expect(saved.role).toBe("consultation");
  expect(saved.tool_bindings.every((binding: { enabled: boolean }) => !binding.enabled)).toBe(true);
  // Its page has no Tools section and explains its role.
  await page.locator("main table").getByRole("link", { name: "Private assistant", exact: true }).click();
  await expect(page.getByText(/It handles private consultations only/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tools", exact: true })).toHaveCount(0);
});
