import { expect, test } from "@playwright/test";

for (const [title, path, response, message] of [
  ["a missing run", "./#/activity/77777777-7777-4777-a777-777777777777", {status: 404, body: ""}, "Not found. It may have been deleted: go back and reload the list."],
  ["an unavailable service", "./#/agents", {status: 503, body: ""}, "Service unavailable. Retry shortly."],
] as const) {
  test(`loading ${title} explains the cause`, async ({page}) => {
    await page.addInitScript(() => {
      localStorage.setItem("secretkey", JSON.stringify({user: "administrator", hash: "synthetic"}));
      localStorage.setItem("nethvoice.agents.language", "en");
    });
    await page.route("**/freepbx/rest/agents/**", async route => {
      const url = new URL(route.request().url()).pathname;
      if (url.endsWith("/access")) await route.fulfill({json: {csrf: "synthetic-csrf"}});
      else if (url.endsWith("/runs/77777777-7777-4777-a777-777777777777") || url.endsWith("/profiles")) await route.fulfill(response);
      else await route.fulfill({json: {items: [], next_cursor: null}});
    });
    await page.goto(path);
    await expect(page.getByText(message)).toBeVisible();
  });
}
