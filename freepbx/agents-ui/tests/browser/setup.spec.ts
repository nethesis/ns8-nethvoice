import { expect, test } from "@playwright/test";

test("setup follows the agent's own trunk and clears only when an inbound route uses it", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "secretkey",
      JSON.stringify({ user: "administrator", hash: "synthetic" }),
    );
    localStorage.setItem("nethvoice.agents.language", "en");
  });
  const draft = {
    provider_binding_id: "agent_trunk",
    conversation: { model: "gpt-live-1" },
  };
  let profiles = [
    {
      agent_id: "receptionist",
      name: "Receptionist",
      kind: "builtin",
      agent_type: "basic_voice",
      workflow_version: null as number | null,
      published: null as typeof draft | null,
      routable: false,
      in_use: true,
      inbound_route_in_use: false as boolean | null,
      draft,
    },
  ];
  const trunk = {
    binding_id: "agent_trunk",
    name: "Agent trunk",
    provider: "openai",
    sync_status: "synced",
    native_ready: true,
    api_key_configured: false,
    webhook_secret_configured: false,
  };
  let trunks = [] as (typeof trunk)[];
  await page.route("**/freepbx/rest/agents/**", (route) => {
    const path = new URL(route.request().url()).pathname.split("/agents/")[1];
    const data =
      path === "access"
        ? { csrf: "synthetic-csrf" }
        : path === "trunks"
          ? { items: trunks }
          : path === "catalog"
            ? { providers: ["openai"] }
            : { items: profiles };
    return route.fulfill({ json: data });
  });
  await page.route("**/freepbx/wizard/**", (route) =>
    route.fulfill({ body: "Inbound routes" }),
  );
  const refresh = () =>
    page.evaluate(() =>
      document.dispatchEvent(new Event("visibilitychange", { bubbles: true })),
    );
  await page.goto("./#/agents");
  await expect(
    page.getByText("Create a provider trunk to connect the agent."),
  ).toBeVisible();

  trunks = [
    trunk,
    { ...trunk, binding_id: "unrelated", api_key_configured: true },
  ];
  await page.reload();
  await expect(
    page.getByText("Add the provider credentials for Receptionist."),
  ).toBeVisible();

  trunk.api_key_configured = true;
  await page.reload();
  await expect(
    page.getByText("Complete and publish Receptionist."),
  ).toBeVisible();

  profiles = [
    {
      ...profiles[0],
      workflow_version: 1,
      published: draft,
      routable: true,
      inbound_route_in_use: null,
    },
  ];
  await page.reload();
  await expect(
    page.getByText(
      "Could not check whether Receptionist is used in an inbound route.",
    ),
  ).toBeVisible();

  profiles[0].inbound_route_in_use = false;
  await refresh();
  await expect(
    page.getByText("Add Receptionist to an inbound route."),
  ).toBeVisible();
  const popupPromise = page.waitForEvent("popup");
  await page
    .getByRole("button", { name: "Inbound routes", exact: true })
    .first()
    .click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/\/freepbx\/wizard\/#!\/routes\/inbound$/);
  await popup.close();

  draft.conversation.model = "gpt-realtime-2.1";
  await refresh();
  await expect(
    page.getByText("Configure the provider webhook for Receptionist."),
  ).toBeVisible();
  trunk.webhook_secret_configured = true;
  await page.reload();
  await expect(
    page.getByText(
      "Add Receptionist to an inbound route and place a call to verify the webhook.",
    ),
  ).toBeVisible();

  profiles[0].inbound_route_in_use = true;
  await refresh();
  await expect(page.getByText("Set up inbound calls")).toHaveCount(0);
  trunk.api_key_configured = false;
  await page.reload();
  await expect(
    page.getByText("Add the provider credentials for Receptionist."),
  ).toBeVisible();
});
