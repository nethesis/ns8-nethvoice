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

async function monitoring(page: Page, expireOnce: (path: string) => boolean) {
  let expired = false;
  const unhandled: string[] = [];
  page.on("pageerror", error => unhandled.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("secretkey", JSON.stringify({user: "administrator", hash: "synthetic"}));
    localStorage.setItem("nethvoice.agents.language", "en");
  });
  await page.route("**/freepbx/rest/agents/**", async route => {
    const path = new URL(route.request().url()).pathname.replace("/freepbx/rest/agents", "");
    if (!expired && expireOnce(path)) {
      expired = true;
      await route.fulfill({status: 401, json: {error: "unauthorized"}});
      return;
    }
    const json = path === "/access" ? {csrf: "synthetic-csrf"}
      : path === "/monitoring/summary" ? {coverage: {total_runs: 42, instrumented_runs: 42, partial_runs: 0, incomplete_runs: 0}, outcomes: [], trends: [], latencies: {}, phases: [], tools: [], errors: []}
      : path === "/monitoring/health" ? {stale: false, degraded: false, ari_connected: true, queue_depth: 0, oldest_pending_seconds: 0, dropped: 0, retries: 0, last_write_at: null}
      : {items: [], has_more: false};
    await route.fulfill({json});
  });
  await page.goto("./#/activity");
  await expect(page.getByText("Administrator login required")).toBeVisible();
  return unhandled;
}

test("monitoring loads again after the session resumes", async ({page}) => {
  const unhandled = await monitoring(page, path => path === "/monitoring/summary");
  await page.evaluate(() => {
    localStorage.setItem("secretkey", JSON.stringify({user: "administrator", hash: "renewed"}));
    window.dispatchEvent(new StorageEvent("storage", {key: "secretkey"}));
  });
  await expect(page.getByTestId("monitoring-total")).toHaveText("42");
  expect(unhandled).toEqual([]);
});

test("returning to the tab resumes when the wizard stored the same key", async ({page}) => {
  const unhandled = await monitoring(page, path => path === "/monitoring/summary");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByTestId("monitoring-total")).toHaveText("42");
  expect(unhandled).toEqual([]);
});

test("an invalid stored key does not leave unhandled rejections", async ({page}) => {
  const rejections: string[] = [];
  await page.exposeFunction("reportRejection", (value: string) => rejections.push(value));
  await page.addInitScript(() => window.addEventListener("unhandledrejection", event => (window as unknown as {reportRejection: (v: string) => void}).reportRejection(String(event.reason))));
  await monitoring(page, () => true);
  await page.route("**/freepbx/rest/agents/access", route => route.fulfill({status: 401, json: {error: "unauthorized"}}));
  await page.evaluate(() => {
    localStorage.setItem("secretkey", JSON.stringify({user: "administrator", hash: "wrong"}));
    window.dispatchEvent(new StorageEvent("storage", {key: "secretkey"}));
  });
  await expect(page.getByText("Administrator login required")).toBeVisible();
  await page.waitForTimeout(300);
  expect(rejections).toEqual([]);
});
