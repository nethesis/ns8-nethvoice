import { beforeEach, describe, expect, it, vi } from "vitest";
import { credentials, queryClient, request } from "../src/api";
import { invalidJsonEditors } from "../src/jsonValidity";

describe("browser authentication", () => {
  beforeEach(() => {
    localStorage.clear();
    invalidJsonEditors.clear();
    queryClient.clear();
  });
  it("reads only a complete Wizard credential pair", () => {
    expect(credentials()).toBeNull();
    localStorage.setItem("secretkey", "{bad");
    expect(credentials()).toBeNull();
    localStorage.setItem(
      "secretkey",
      JSON.stringify({ user: "administrator" }),
    );
    expect(credentials()).toBeNull();
    localStorage.setItem(
      "secretkey",
      JSON.stringify({ user: "administrator", hash: "synthetic-test" }),
    );
    expect(credentials()).toEqual({
      user: "administrator",
      hash: "synthetic-test",
    });
  });
  it("clears cached private data when another tab signs out", () => {
    queryClient.setQueryData(["private"], { content: "synthetic-private" });
    window.dispatchEvent(
      new StorageEvent("storage", { key: "secretkey", newValue: null }),
    );
    expect(queryClient.getQueryData(["private"])).toBeUndefined();
  });
  it("blocks mutations when an advanced editor contains invalid JSON", async () => {
    localStorage.setItem("secretkey", JSON.stringify({ user: "administrator", hash: "synthetic-test" }));
    invalidJsonEditors.add(Symbol());
    const network = vi.spyOn(XMLHttpRequest.prototype, "send").mockImplementation(() => { throw new Error("network_probe"); });
    await expect(
      request("PUT", "/draft", {}),
    ).rejects.toThrow("invalid_json");
    expect(network).not.toHaveBeenCalled();
    network.mockRestore();
  });
  it("observes the XHR adapter for an allowed request", async () => {
    localStorage.setItem("secretkey", JSON.stringify({ user: "administrator", hash: "synthetic-test" }));
    const network = vi.spyOn(XMLHttpRequest.prototype, "send").mockImplementation(() => { throw new Error("network_probe"); });
    await expect(request("GET", "/catalog")).rejects.toThrow("network_probe");
    expect(network).toHaveBeenCalledOnce();
    network.mockRestore();
  });
});
