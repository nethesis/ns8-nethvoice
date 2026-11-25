import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const base = new URL("../../../var/www/html/freepbx/rest/lib/agents/contracts/", import.meta.url);
const read = (file: string) => JSON.parse(readFileSync(new URL(file, base), "utf8"));

async function editor(page: Page, rejectFirstSave: boolean) {
  const draft = read("published-v8.example.json");
  for (const key of ["agent_id", "destination_id", "workflow_version", "provider"]) delete draft[key];
  draft.provider_binding_id = null;
  const record = {agent_id: "receptionist", name: "Receptionist", agent_type: "basic_voice", kind: "builtin", revision: 1, workflow_version: null, published: null, draft};
  const saved: string[] = [];
  let rejected = !rejectFirstSave;
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("secretkey", JSON.stringify({user: "administrator", hash: "synthetic"}));
      localStorage.setItem("nethvoice.agents.language", "en");
      sessionStorage.setItem("seeded", "1");
    }
  });
  await page.context().route("**/freepbx/rest/agents/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/freepbx/rest/agents", "");
    if (request.method() === "PUT") {
      if (!rejected) {
        rejected = true;
        await route.fulfill({status: 401, json: {error: "unauthorized"}});
        return;
      }
      saved.push(request.postDataJSON().profile.draft.conversation.greeting);
      record.draft = request.postDataJSON().profile.draft;
      record.revision++;
    }
    await route.fulfill({json: path === "/access" ? {csrf: "synthetic-csrf"} : path === "/catalog" ? {tools: read("tools-v5.json"), default_language: "en", extensions: [], languages: [{id: "en", label: "English"}]} : path === "/trunks" ? {items: []} : path === "/destinations" ? {items: [], next_offset: null, modules: {}, unavailable_ids: []} : record});
  });
  await page.goto("./#/agents/receptionist");
  await page.getByLabel("Greeting", {exact: true}).fill("Unsaved greeting");
  return saved;
}

test("an expired session keeps the editor and resumes after signing in elsewhere", async ({page, context}) => {
  const saved = await editor(page, true);
  await page.getByRole("button", {name: "Save draft", exact: true}).click();
  await expect(page.getByText("Administrator login required")).toBeVisible();
  await expect(page.getByText(/keeps your unsaved changes/)).toBeVisible();
  await expect(page.getByLabel("Greeting", {exact: true})).toBeHidden();
  const popup = context.waitForEvent("page");
  await page.getByRole("button", {name: "Sign in through Wizard", exact: true}).click();
  const login = await popup;
  expect(login.url()).toContain("/freepbx/wizard/#!/login");
  await login.evaluate(() => localStorage.setItem("secretkey", JSON.stringify({user: "administrator", hash: "renewed"})));
  await expect(page.getByLabel("Greeting", {exact: true})).toHaveValue("Unsaved greeting");
  await page.getByRole("button", {name: "Save draft", exact: true}).click();
  await expect.poll(() => saved).toEqual(["Unsaved greeting"]);
});

test("closing the editor with unsaved changes asks for confirmation", async ({page}) => {
  await editor(page, false);
  const dialog = new Promise<string>(resolve => page.once("dialog", async item => {
    resolve(item.type());
    await item.dismiss();
  }));
  await page.close({runBeforeUnload: true});
  expect(await dialog).toBe("beforeunload");
});
