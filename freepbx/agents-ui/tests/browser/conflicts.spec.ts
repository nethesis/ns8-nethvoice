import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const base = new URL(
  "../../../var/www/html/freepbx/rest/lib/agents/contracts/",
  import.meta.url,
);
const read = (file: string) =>
  JSON.parse(readFileSync(new URL(file, base), "utf8"));
for (const fallbackOnly of [true, false]) {
  test(
    fallbackOnly
      ? "a route-only revision rebases a draft save"
      : "confirming a mixed revision saves only local edits",
    async ({ page }) => {
      const draft = read("published-v8.example.json");
      for (const key of [
        "agent_id",
        "destination_id",
        "workflow_version",
        "provider",
      ])
        delete draft[key];
      draft.provider_binding_id = null;
      let profile = {
        agent_id: "receptionist",
        name: "Front desk",
        agent_type: "basic_voice",
        kind: "builtin",
        revision: 1,
        workflow_version: 1,
        draft_version: 1,
        published: draft,
        draft,
        sync_status: "synced",
      };
      const updates: number[] = [];
      await page.addInitScript(() => {
        localStorage.setItem(
          "secretkey",
          JSON.stringify({ user: "administrator", hash: "synthetic" }),
        );
        localStorage.setItem("nethvoice.agents.language", "en");
      });
      await page.route("**/freepbx/rest/agents/**", async (route) => {
        const path = new URL(route.request().url()).pathname.replace(
          "/freepbx/rest/agents",
          "",
        );
        if (route.request().method() === "PUT") {
          const input = route.request().postDataJSON();
          updates.push(input.expected_revision);
          if (profile.revision !== input.expected_revision) {
            return route.fulfill({
              status: 409,
              json: {
                error: "revision_conflict",
                ...(fallbackOnly
                  ? {
                      field: "draft.fallback_destination_id",
                      current_revision: profile.revision,
                    }
                  : {}),
              },
            });
          }
          profile = {
            ...profile,
            ...input.profile,
            revision: profile.revision + 1,
          };
        }
        await route.fulfill({
          json:
            path === "/access"
              ? { csrf: "synthetic-csrf" }
              : path === "/catalog"
                ? {
                    tools: read("tools-v5.json"),
                    default_language: "en",
                    languages: [{ id: "en", label: "English" }],
                  }
                : path === "/trunks" || path === "/destinations"
                  ? { items: [] }
                  : profile,
        });
      });
      await page.goto("./#/agents/receptionist");
      const name = page.getByRole("textbox", { name: "Name", exact: true });
      await name.fill("My local name");
      profile = {
        ...profile,
        revision: 2,
        draft: {
          ...profile.draft,
          fallback_destination_id: "extension:203",
          conversation: {
            ...profile.draft.conversation,
            greeting: fallbackOnly
              ? draft.conversation.greeting
              : "Remote greeting",
          },
        },
      };
      await page
        .getByRole("button", { name: "Save draft", exact: true })
        .click();
      if (!fallbackOnly) {
        await expect(name).toHaveValue("My local name");
        await page.getByRole("button", { name: "Save my changes" }).click();
        await expect(page.getByLabel(/^Greeting/)).toHaveValue(
          "Remote greeting",
        );
      }
      await expect.poll(() => profile.revision).toBe(3);
      await expect(
        page.getByRole("button", { name: "Save my changes" }),
      ).toHaveCount(0);
      expect(updates).toEqual([1, 2]);
      expect(profile.name).toBe("My local name");
      expect(profile.draft.fallback_destination_id).toBe("extension:203");
      expect(profile.workflow_version).toBe(1);
    },
  );
}
