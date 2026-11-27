import { expect, test } from "@playwright/test";

const runId = "77777777-7777-4777-a777-777777777777";
const run = {run_id: runId, agent_id: "receptionist", agent_name: "Receptionist", workflow_version: 1, started_at: "2026-10-20 12:00:00", ended_at: "2026-10-20 12:00:20", outcome: "completed", error_code: null, provider: "openai", adapter: "realtime", model: "synthetic-model", monitoring_version: 2, trace_status: "complete", incomplete: false, duration_ms: 20000, usage: {}, usage_complete: true, events: [], transcripts: []};

test.use({timezoneId: "Europe/Rome"});

test("monitoring shows local times and sends local day boundaries", async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem("secretkey", JSON.stringify({user: "administrator", hash: "synthetic"}));
    localStorage.setItem("preferredLanguage", JSON.stringify("en"));
  });
  const ranges: string[] = [];
  await page.route("**/freepbx/rest/agents/**", async route => {
    const url = new URL(route.request().url()), path = url.pathname.replace("/freepbx/rest/agents", "");
    if (path === "/runs" && url.searchParams.get("from")) ranges.push(url.searchParams.get("from") + "|" + url.searchParams.get("to"));
    const json = path === "/access" ? {csrf: "synthetic-csrf"}
      : path === "/monitoring/summary" ? {coverage: {total_runs: 1, instrumented_runs: 1, partial_runs: 0, incomplete_runs: 0}, outcomes: [], trends: [], latencies: {}, phases: [], tools: [], errors: []}
      : path === "/monitoring/health" ? {stale: false, degraded: false, ari_connected: true, queue_depth: 0, oldest_pending_seconds: 0, dropped: 0, retries: 0, last_write_at: null}
      : path === "/runs" ? {items: [run], has_more: false}
      : path === `/runs/${runId}` ? run
      : path === `/runs/${runId}/trace` ? {items: [], next_cursor: null}
      : {items: []};
    await route.fulfill({json});
  });
  await page.goto("./#/activity");
  await expect(page.getByRole("gridcell", {name: "20 Oct 2026, 14:00:00", exact: true})).toBeVisible();
  await expect(page.getByText(/UTC\b(?! day)/)).toHaveCount(0);
  await page.getByRole("button", {name: /^Details/}).click();
  await expect(page.getByText(/20 Oct 2026.*14:00:00/).first()).toBeVisible();
  await expect(page.getByText(/12:00:00/)).toHaveCount(0);
  await page.getByRole("link", {name: /Monitoring/}).first().click();
  await page.getByRole("button", {name: "Open filter Period"}).click();
  await page.getByRole("radio", {name: "Custom dates"}).check();
  await page.keyboard.press("Escape");
  await page.getByLabel("From", {exact: true}).fill("2026-10-20");
  await page.getByLabel("Through", {exact: true}).fill("2026-10-20");
  await expect.poll(() => ranges).toContain("2026-10-19T22:00:00.000Z|2026-10-20T21:59:59.000Z");
});
