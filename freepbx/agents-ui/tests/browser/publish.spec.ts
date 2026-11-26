import { expect, test } from "@playwright/test";
import { drawer, mockApi } from "./agentsMock";

// A rejected publication from the Create agent drawer is covered by
// create-drawer.spec.ts: the agent is created once and its page shows the
// error. Here: a create whose result is unknown must not be repeated.
for (const expired of [false, true])
  test(`a create with an unknown result blocks another create (${expired ? "renewed session" : "dropped connection"})`, async ({ page }) => {
    let creates = 0;
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await mockApi(page, {
      intercept: async (route, method, path, body) => {
        if (method !== "POST" || path !== "/profiles") return false;
        creates++;
        if (expired) {
          await held;
          await route.fulfill({ json: { agent_id: "possibly_created", revision: 1, ...body.profile } });
        } else await route.abort("connectionreset");
        return true;
      },
    });
    await page.goto("./#/agents");
    await page.getByRole("button", { name: "Create agent", exact: true }).click();
    await page.getByLabel("Name", { exact: true }).fill("Night desk");
    const sent = page.waitForRequest((request) => request.method() === "POST");
    await drawer(page).getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("dialog").filter({ hasText: "Unsaved changes" }).getByRole("button", { name: "Save draft", exact: true }).click();
    await sent;
    if (expired) {
      await page.evaluate(() => {
        localStorage.setItem("secretkey", JSON.stringify({ user: "administrator", hash: "renewed" }));
        window.dispatchEvent(new StorageEvent("storage", { key: "secretkey" }));
      });
      release();
    }
    await expect(drawer(page).getByText(/The connection ended before the result was received/)).toBeVisible();
    await expect(drawer(page).getByText("The agent may have been created anyway. Check the Agents list before creating it again.", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Night desk");
    await expect(drawer(page).getByRole("button", { name: "Next", exact: true })).toBeEnabled();
    // Publish and Save draft are blocked: Cancel closes without asking.
    await drawer(page).getByRole("button", { name: "Next", exact: true }).click();
    await drawer(page).getByRole("button", { name: "Next", exact: true }).click();
    await expect(drawer(page).getByRole("button", { name: "Publish", exact: true })).toBeDisabled();
    expect(creates).toBe(1);
    await drawer(page).getByRole("button", { name: "Go to the Agents list", exact: true }).click();
    await expect(page).toHaveURL(/#\/agents$/);
    expect(creates).toBe(1);
  });
