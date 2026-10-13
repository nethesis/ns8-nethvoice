import axios from "axios";
import { invalidJsonEditors } from "./jsonValidity";
import { reactive } from "vue";
import { QueryClient } from "@tanstack/vue-query";
type JsonObject = Record<string, unknown>;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 10000 },
    mutations: { retry: false },
  },
});
export const auth = reactive({ user: "", ready: false, authorized: false });
const client = axios.create({
  baseURL: "/freepbx/rest/agents",
  timeout: 45000,
  withCredentials: true,
});
let csrf = "";
let authGeneration = 0;
const requestGenerations = new WeakMap<object, number>();
let accessPromise: Promise<void> | undefined;

export function credentials(): { user: string; hash: string } | null {
  try {
    const value = JSON.parse(localStorage.getItem("secretkey") || "null");
    return value &&
      typeof value.user === "string" &&
      typeof value.hash === "string" &&
      value.user &&
      value.hash
      ? { user: value.user, hash: value.hash }
      : null;
  } catch {
    return null;
  }
}

function clearAuth() {
  authGeneration++;
  auth.user = "";
  auth.ready = true;
  csrf = "";
  accessPromise = undefined;
  auth.authorized = false;
  queryClient.cancelQueries();
  queryClient.clear();
}

client.interceptors.request.use((config) => {
  const identity = credentials();
  if (!identity) {
    clearAuth();
    throw new Error("authentication_required");
  }
  requestGenerations.set(config, authGeneration);
  config.headers.set("User", identity.user);
  config.headers.set("Secretkey", identity.hash);
  // Administrator identity is established by server authentication, never this display value.
  auth.user = identity.user;
  return config;
});
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || "";
    if (
      requestGenerations.get(error.config) === authGeneration &&
      (error.response?.status === 401 ||
        (error.response?.status === 403 &&
          /Forbidden|unauthorized/.test(message)))
    )
      clearAuth();
    return Promise.reject(error);
  },
);

export async function access() {
  if (!accessPromise) {
    const generation = authGeneration;
    const identity = credentials();
    accessPromise = client
      .get("/access")
      .then(({ data }) => {
        if (
          generation !== authGeneration ||
          JSON.stringify(identity) !== JSON.stringify(credentials())
        ) {
          throw new Error("authentication_required");
        }
        csrf = data.csrf;
        auth.authorized = true;
      })
      .catch((error) => {
        if (generation === authGeneration) accessPromise = undefined;
        throw error;
      })
      .finally(() => {
        if (generation === authGeneration) auth.ready = true;
      });
  }
  return accessPromise;
}

export async function request<T = JsonObject>(
  method: string,
  path: string,
  data?: unknown,
  params?: JsonObject,
): Promise<T> {
  if (method !== "GET") {
    if (invalidJsonEditors.size) throw new Error("invalid_json");
    await access();
  }
  const response = await client.request<T>({
    method,
    url: path,
    data,
    params,
    timeout: /\/data\/|\/documents\//.test(path) ? 60000 : 45000,
    headers: method === "GET" ? {} : { "X-Agents-CSRF": csrf },
  });
  return response.data;
}
export function errorCode(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const code = error.response?.data?.error;
    if (typeof code === "string" && /^[a-z_]{1,64}$/.test(code)) return code;
    if (!error.response) return "request_uncertain";
  }
  return error instanceof Error &&
    ["authentication_required", "invalid_json"].includes(error.message)
    ? error.message
    : "request_failed";
}
export function signIn() {
  sessionStorage.setItem(
    "nethvoice.agents.return",
    window.location.pathname + window.location.hash,
  );
  window.location.assign("/freepbx/wizard/#!/login");
}
window.addEventListener("storage", (event) => {
  if (event.key === "secretkey") {
    clearAuth();
    if (credentials()) void access();
  }
});
