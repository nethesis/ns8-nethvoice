import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { loadErrorCode } from "../src/api";

const failure = (status?: number, data?: unknown) => {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError(
    "failed",
    status ? "ERR_BAD_RESPONSE" : "ECONNABORTED",
    config,
    {},
    status
      ? { status, statusText: "", headers: {}, config, data: data ?? {} }
      : undefined,
  );
};

describe("load error codes", () => {
  it("prefers a specific server code", () => {
    expect(loadErrorCode(failure(404, { error: "run_not_found" }))).toBe(
      "run_not_found",
    );
  });
  it("explains missing, unavailable and unanswered requests", () => {
    expect(loadErrorCode(failure(404))).toBe("not_found");
    expect(loadErrorCode(failure(503))).toBe("request_unavailable");
    expect(loadErrorCode(failure())).toBe("load_timeout");
    expect(loadErrorCode(failure(400))).toBe("request_failed");
  });
});
