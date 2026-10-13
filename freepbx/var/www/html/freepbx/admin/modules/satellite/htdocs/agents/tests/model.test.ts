import { describe, expect, it } from "vitest";
import {
  blankGraph,
  upgrade,
  removeBinding,
  effectiveTools,
  graphErrors,
  identifier,
  toolKey,
} from "../src/model";

describe("workflow edits", () => {
  it("keeps objects distinct from lists across serialization", () => {
    const graph = JSON.parse(
      JSON.stringify(blankGraph("reception", "Reception", "voice")),
    );
    expect(graph.nodes[0].config).toEqual({});
    expect(graph.nodes[0].inputs).toEqual({});
    expect(graph.input_schema.properties).toEqual({});
    expect(graph.tool_bindings).toEqual([]);
    expect(graph.edges).toBeInstanceOf(Array);
  });
  it("inherits tools and restricts an individual conversation phase", () => {
    const graph = blankGraph("reception", "Reception", "voice");
    const binding = {
      tool_id: "tickets",
      version: 1,
      conversation: true,
      workflow: true,
      instructions: "",
      scope: {},
    };
    graph.tool_bindings = [binding];
    const node = graph.nodes[1]!;
    expect(effectiveTools(graph, node)).toEqual([toolKey(binding)]);
    node.config.tool_mode = "selected";
    node.config.tools = [];
    expect(effectiveTools(graph, node)).toEqual([]);
  });
  it("removes conversation permissions but keeps explicit references visibly invalid", () => {
    const graph = blankGraph("reception", "Reception", "voice");
    const binding = {
      tool_id: "tickets",
      version: 1,
      conversation: true,
      workflow: true,
      instructions: "",
      scope: {},
    };
    graph.tool_bindings = [binding];
    graph.nodes.push({
      id: "write",
      name: "Write",
      type: "tool.invoke",
      version: 1,
      config: { tool: { tool_id: "tickets", version: 1 } },
      inputs: {},
    });
    const result = removeBinding(graph, toolKey(binding));
    expect(result.tool_bindings).toEqual([]);
    expect(result.nodes.at(-1)!.config.tool.tool_id).toBe("tickets");
    expect(graphErrors(result, [])).toContain("write");
  });
  it("upgrades legacy drafts without changing node inputs or legacy grants", () => {
    const graph = blankGraph("reception", "Reception", "voice");
    graph.schema_version = 1;
    graph.tool_grants = ["company.get_information"];
    const result = upgrade(graph);
    expect(result.tool_grants).toEqual(graph.tool_grants);
    expect(result.nodes).toEqual(graph.nodes);
    expect(result).not.toBe(graph);
  });
  it("generates bounded ASCII identifiers", () => {
    const value = identifier(
      "Segreteria condominio è un nome molto lungo ".repeat(4),
    );
    expect(value).toMatch(/^[a-z][a-z0-9_-]{0,47}$/);
  });
});
