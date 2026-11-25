import axios, { type InternalAxiosRequestConfig } from "axios";
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
export const draftRecoveryKey = "nethvoice.agents.edit";
const client = axios.create({
  baseURL: "/freepbx/rest/agents",
  timeout: 45000,
  withCredentials: true,
});
let csrf = "";
let authGeneration = 0;
const requestGenerations = new WeakMap<object, number>();
let accessPromise: Promise<void> | undefined;
let refetchOnAccess = false;
let lastAuthorizedUser = "";

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

function isCurrentRequest(config: InternalAxiosRequestConfig): boolean {
  const identity = credentials();
  return (
    requestGenerations.get(config) === authGeneration &&
    identity !== null &&
    config.headers.get("User") === identity.user &&
    config.headers.get("Secretkey") === identity.hash
  );
}

function clearAuth(recover = true, rejected?: InternalAxiosRequestConfig) {
  if (recover && auth.authorized)
    window.dispatchEvent(
      new CustomEvent("agents-auth-expired", {
        detail: {
          createRejected:
            rejected?.method === "post" && rejected.url === "/profiles",
        },
      }),
    );
  authGeneration++;
  auth.user = "";
  auth.ready = true;
  csrf = "";
  accessPromise = undefined;
  auth.authorized = false;
  refetchOnAccess = true;
  queryClient.cancelQueries();
  const cache = queryClient.getQueryCache();
  for (const query of cache.getAll())
    if (!query.getObserversCount()) cache.remove(query);
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
  return config;
});
client.interceptors.response.use(
  (response) => {
    if (!isCurrentRequest(response.config))
      throw new Error("authentication_required");
    return response;
  },
  (error) => {
    if (error.config && !isCurrentRequest(error.config))
      throw new Error("authentication_required");
    const message = error.response?.data?.error || "";
    if (message === "csrf_invalid") {
      csrf = "";
      accessPromise = undefined;
    }
    if (
      error.response?.status === 401 ||
      (error.response?.status === 403 && /Forbidden|unauthorized/.test(message))
    )
      clearAuth(true, error.config);
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
          !identity ||
          JSON.stringify(identity) !== JSON.stringify(credentials())
        ) {
          throw new Error("authentication_required");
        }
        if (lastAuthorizedUser && lastAuthorizedUser !== identity.user) {
          queryClient.clear();
          refetchOnAccess = false;
        }
        const recovery = sessionStorage.getItem(draftRecoveryKey);
        if (recovery) {
          try {
            if (JSON.parse(recovery)?.user !== identity.user)
              sessionStorage.removeItem(draftRecoveryKey);
          } catch {
            sessionStorage.removeItem(draftRecoveryKey);
          }
        }
        lastAuthorizedUser = auth.user = identity.user;
        csrf = data.csrf;
        auth.authorized = true;
        if (refetchOnAccess) {
          refetchOnAccess = false;
          void queryClient.invalidateQueries();
        }
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
    const generation = authGeneration;
    const identity = credentials();
    await access();
    if (
      generation !== authGeneration ||
      identity?.user !== auth.user ||
      JSON.stringify(identity) !== JSON.stringify(credentials())
    )
      throw new Error("authentication_required");
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
    ["authentication_required", "invalid_json", "revision_conflict"].includes(
      error.message,
    )
    ? error.message
    : "request_failed";
}
export function loadErrorCode(
  error: unknown,
  known: (code: string) => boolean = () => false,
): string {
  const code = errorCode(error);
  if (code === "request_uncertain") return "load_timeout";
  if (!axios.isAxiosError(error) || (code !== "request_failed" && known(code)))
    return code;
  const status = error.response?.status || 0;
  if (status === 404) return "not_found";
  if (status >= 500) return "request_unavailable";
  return code;
}
export function signIn(keepPage = false) {
  if (keepPage) window.open("/freepbx/wizard/#!/login", "_blank", "noopener");
  else window.location.assign("/freepbx/wizard/#!/login");
}
export function signOut() {
  localStorage.removeItem("secretkey");
  clearAuth(false);
  sessionStorage.removeItem(draftRecoveryKey);
  window.location.assign("/freepbx/wizard/#!/login");
}
function resume() {
  if (auth.ready && !auth.authorized && credentials())
    access().catch(() => undefined);
}
window.addEventListener("storage", (event) => {
  if (event.key === "secretkey") {
    clearAuth();
    resume();
  }
});
window.addEventListener("focus", resume);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") resume();
});
