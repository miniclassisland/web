/* ===== API 客户端层 ===== */
/* 统一封装所有后端接口调用，Bearer Token 自动注入 */
/* 双端点架构：Management API / Admin API */

import type {
    UserRegisterRequest, UserLoginRequest, TokenResponse,
    UserOut, UserUpdateRequest, AccountOut, AccountCreate,
    AccountIdUpdate, SlugUpdate, AccountNameUpdate, AccountInfoUpdate,
    EmailUpdate, UsernameUpdate, DisplayNameUpdate, PasswordChange,
    TotpEnableResponse, TotpConfirmRequest, TotpDisableRequest,
    TotpVerifyRequest, TotpRecoverRequest,
    PairingCodeOut, PairingStatusResponse, RegistrationMode,
    PreRegOut, PreRegCreate, AccessMember, AccessRoleUpdate,
    InvitationOut, InvitationCreate,
    NotificationPayload, BatchRequest, ClientBatchRequest, SiteAnnouncement,
    StatusResponse, MessageResponse, LoginResult,
    ResourceType, ClientDeviceOut, ClientProfileConfig,
    ConfigUploadItem, AuditLogItem, ManagementSettings,
    TicketDetail, TicketListResponse, TicketMessage,
    TicketCreateRequest, TicketStatus,
    CertificateIssueRequest, CertificateIssueResponse,
    LoginCertificateItem, CertificateRedeemResponse,
    CertificateSessionResponse, CertificateRotateResponse,
    ExtendCommandDispatchResult, ExtendCommandBroadcastResult,
} from "./types";

// ============================================================
// 服务器地址（从环境变量读取）
// Management API (27042) / Admin API (27043)
// ============================================================

const STORAGE_KEY_TOKEN = "miniclassisland_auth_token";
const STORAGE_KEY_ACCOUNT = "miniclassisland_current_account_id";
const STORAGE_KEY_TOKEN_ISSUED_AT = "miniclassisland_token_issued_at";

/** Refresh the 1-hour session token after 50 minutes, keeping a 10-minute margin. */
const TOKEN_REFRESH_AFTER_MS = 50 * 60 * 1000;
const TOKEN_REFRESH_RETRY_MS = 60 * 1000;
const TOKEN_REFRESH_TIMER_MS = 60 * 1000;
const TOKEN_REFRESH_EXEMPT_PATHS = new Set([
    "/token/refresh",
    "/token/deactivate",
    "/token/redeem",
    "/user/auth",
    "/user/apply",
]);
const TOKEN_REFRESH_EXEMPT_PREFIXES = ["/user/2fa/", "/user/availability/", "/token/certificate/", "/token/qr-login/"];

/** Management API 地址（认证、账户内操作） */
export function getServerUrl(): string {
    const url = process.env.NEXT_PUBLIC_MINICLASSISLAND_ENDPOINT || "";
    return url.replace(/\/+$/, "");
}

/** Admin API 地址（超管端点） */
export function getAdminUrl(): string {
    const url = process.env.NEXT_PUBLIC_MINICLASSISLAND_ADMIN_ENDPOINT || "";
    return url.replace(/\/+$/, "");
}

/** 动态解析超管站点地址（支持自定义域名部署与本地开发端口推导） */
export function getAdminSiteUrl(): string {
    const envUrl = process.env.NEXT_PUBLIC_ADMIN_SITE_URL;
    if (envUrl) return envUrl.replace(/\/+$/, "");
    if (typeof window !== "undefined") {
        const { protocol, hostname, port, host } = window.location;
        if (port === "27042") return `${protocol}//${hostname}:27043`;
        if (port === "3000") return `${protocol}//${hostname}:3001`;
        if (hostname.startsWith("dash.") || hostname.startsWith("dashboard.")) {
            const baseHost = host.replace(/^(dash|dashboard)\./i, "");
            return `${protocol}//admin.${baseHost}`;
        }
        if (!hostname.startsWith("admin.")) {
            return `${protocol}//admin.${host}`;
        }
        return `${protocol}//${host}`;
    }
    const configuredBase = (process.env.NEXT_PUBLIC_BASE_DOMAIN || "").trim();
    if (configuredBase) return `https://admin.${configuredBase}`;
    return "https://admin.miniclassisland.com";
}

export function getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY_TOKEN);
}

export function setToken(token: string): void {
    if (typeof window === "undefined") return;
    const previous = localStorage.getItem(STORAGE_KEY_TOKEN);
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
    // Only mark issuance when the token actually changes. Restoring the same
    // token from storage or SSO must not prolong its perceived lifetime.
    if (previous !== token) {
        localStorage.setItem(STORAGE_KEY_TOKEN_ISSUED_AT, String(Date.now()));
    }
}

export function clearToken(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_ACCOUNT);
    localStorage.removeItem(STORAGE_KEY_TOKEN_ISSUED_AT);
}

function getTokenIssuedAt(): number {
    if (typeof window === "undefined") return 0;
    const raw = localStorage.getItem(STORAGE_KEY_TOKEN_ISSUED_AT);
    const value = raw ? Number(raw) : 0;
    return Number.isFinite(value) ? value : 0;
}

function isTokenRefreshExempt(path: string): boolean {
    return (
        TOKEN_REFRESH_EXEMPT_PATHS.has(path) ||
        TOKEN_REFRESH_EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix))
    );
}

// ============================================================
// 通用请求
// ============================================================

export class ApiError extends Error {
    status: number;
    code?: string;
    retryAfter?: number;
    detail: unknown;

    constructor(status: number, detail: unknown, retryAfter?: number) {
        let msg = typeof detail === "string" ? detail : JSON.stringify(detail);
        let code: string | undefined;

        if (detail && typeof detail === "object") {
            const d = detail as Record<string, unknown>;
            if (typeof d.code === "string") {
                code = d.code;
            }
            if (typeof d.msg === "string") {
                msg = d.msg;
            } else if (typeof d.detail === "string") {
                msg = d.detail;
            } else if (Array.isArray(d.detail)) {
                const errors = (d.detail as Array<{ loc?: unknown[]; msg?: string }>).map((err) => {
                    const field = err.loc ? err.loc[err.loc.length - 1] : "";
                    const rawMsg = err.msg || "校验失败";
                    const cleanMsg = rawMsg.replace(/^Value error,\s*/i, "");
                    return field ? `${field}: ${cleanMsg}` : cleanMsg;
                });
                msg = errors.join("; ");
            }
        }

        if (status === 429) {
            if (code === "ERR_IP_BLOCKED" || msg.includes("IP address temporarily blocked")) {
                msg = "当前 IP 因短时间内多次异常请求已被安全机制临时封禁（约 5 分钟），请稍后再试";
            } else if (!msg || msg === "请求失败" || msg.startsWith("{")) {
                msg = "请求过于频繁，已被安全限流保护拦截，请稍后再试";
            }
        }

        if (msg === "Failed to fetch" || (typeof msg === "string" && msg.includes("Failed to fetch"))) {
            msg = "未知的服务器回答，请联系管理员";
        }

        super(msg);
        this.status = status;
        this.code = code;
        this.retryAfter = retryAfter;
        this.detail = detail;
    }
}

/**
 * 401 时清理失效凭据并直接退回到 /login，附带会话过期横幅标记。
 */
function emitAuthExpired(): void {
    if (typeof window !== "undefined") {
        clearToken();
        try {
            sessionStorage.setItem("miniclassisland_session_expired", "1");
        } catch { /* ignore */ }
        window.dispatchEvent(new CustomEvent("miniclassisland:auth-expired"));
        if (!window.location.pathname.startsWith("/login")) {
            window.location.href = "/login?expired=1";
        }
    }
}

/**
 * 429 时触发全局限流事件，供 RateLimitBanner 展示倒计时提示横幅。
 */
function emitRateLimited(detail: { message: string; retryAfter: number; code?: string; path?: string }): void {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("miniclassisland:rate-limited", { detail }));
    }
}

// ============================================================
// 会话滑动续期
// ============================================================

let activeRequests = 0;
let refreshPromise: Promise<void> | null = null;
let lastRefreshAttemptAt = 0;
let tokenRefreshTimer: number | null = null;

/** Let in-flight requests finish before revoking the old token. */
async function waitForActiveRequests(maxWaitMs = 5000): Promise<void> {
    const startedAt = Date.now();
    while (activeRequests > 0 && Date.now() - startedAt < maxWaitMs) {
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
}

type NavigatorWithLocks = Navigator & {
    locks?: {
        request<T>(name: string, callback: () => Promise<T>): Promise<T>;
    };
};

/** Coordinate refreshes across tabs so one tab cannot revoke another's token. */
async function withRefreshLock<T>(callback: () => Promise<T>): Promise<T> {
    if (typeof navigator !== "undefined") {
        const locks = (navigator as NavigatorWithLocks).locks;
        if (locks) {
            return locks.request("miniclassisland-token-refresh", callback);
        }
    }
    return callback();
}

async function refreshSessionToken(): Promise<void> {
    if (refreshPromise) return refreshPromise;
    const current = getToken();
    if (!current) return;

    refreshPromise = withRefreshLock(async () => {
        await waitForActiveRequests();
        const tokenToRefresh = getToken();
        if (!tokenToRefresh) return;
        const issuedAtBefore = getTokenIssuedAt();
        // Another tab may have already refreshed while we waited for the lock.
        if (
            issuedAtBefore > 0 &&
            Date.now() - issuedAtBefore < TOKEN_REFRESH_AFTER_MS
        ) {
            return;
        }
        lastRefreshAttemptAt = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const res = await fetch(`${getServerUrl()}/token/refresh`, {
                method: "POST",
                headers: { Authorization: `Bearer ${tokenToRefresh}` },
                signal: controller.signal,
            });
            if (res.status === 401 || res.status === 403) {
                const latest = getToken();
                if (
                    latest &&
                    latest !== tokenToRefresh &&
                    getTokenIssuedAt() > issuedAtBefore
                ) {
                    return;
                }
                emitAuthExpired();
                return;
            }
            if (!res.ok) return;
            const data = (await res.json()) as { token?: string };
            if (data?.token) {
                setToken(data.token);
            }
        } catch {
            /* Network failure: retry on a later request/timer tick. */
        } finally {
            clearTimeout(timeout);
        }
    }).finally(() => {
        refreshPromise = null;
    });

    return refreshPromise;
}

async function ensureFreshToken(path: string): Promise<void> {
    if (typeof window === "undefined" || isTokenRefreshExempt(path)) return;
    if (refreshPromise) {
        await refreshPromise;
        return;
    }
    if (!getToken()) return;

    const issuedAt = getTokenIssuedAt();
    const age = issuedAt > 0 ? Date.now() - issuedAt : Number.POSITIVE_INFINITY;
    if (age < TOKEN_REFRESH_AFTER_MS) return;
    if (Date.now() - lastRefreshAttemptAt < TOKEN_REFRESH_RETRY_MS) return;
    await refreshSessionToken();
}

function startTokenRefreshTimer(): void {
    if (typeof window === "undefined" || tokenRefreshTimer !== null) return;
    tokenRefreshTimer = window.setInterval(() => {
        void ensureFreshToken("/__token_timer__");
    }, TOKEN_REFRESH_TIMER_MS);
}

async function request<T>(
    path: string,
    options: RequestInit = {},
    baseOverride?: string,
    retried = false,
): Promise<T> {
    const base = baseOverride || getServerUrl();
    if (!base) throw new Error("未配置服务器地址");

    await ensureFreshToken(path);

    const token = getToken();
    const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> || {}),
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    if (options.body && typeof options.body === "string") {
        headers["Content-Type"] = "application/json";
    }

    let res: Response;
    activeRequests += 1;
    try {
        res = await fetch(`${base}${path}`, { ...options, headers });
    } catch (err: unknown) {
        const errObj = err as { message?: string; name?: string } | null;
        const rawMsg = errObj?.message || String(err);
        if (rawMsg.includes("Failed to fetch") || rawMsg.includes("fetch failed") || errObj?.name === "TypeError") {
            throw new ApiError(0, "未知的服务器回答，请联系管理员");
        }
        throw err;
    } finally {
        activeRequests = Math.max(0, activeRequests - 1);
    }

    if (res.status === 401 || res.status === 403) {
        const isAuthFlow = path === "/user/auth" || path === "/user/2fa/totp/verify" || path === "/user/2fa/totp/recover";
        if (!isAuthFlow) {
            if (path !== "/token/deactivate" && res.status === 401) {
                const latestToken = getToken();
                if (!retried && latestToken && latestToken !== token) {
                    return request<T>(path, options, baseOverride, true);
                }
                emitAuthExpired();
            }
            let errDetail: unknown = "未授权或权限不足，请重新登录";
            try { errDetail = await res.json(); } catch { /* ignore */ }
            throw new ApiError(res.status, errDetail);
        }
    }

    if (!res.ok) {
        let detail: unknown;
        try { detail = await res.json(); } catch { detail = await res.text(); }

        let code: string | undefined;
        let msg = "请求失败";
        if (detail && typeof detail === "object") {
            const d = detail as Record<string, unknown>;
            if (typeof d.code === "string") {
                code = d.code;
            }
            if (Array.isArray(d.detail)) {
                const errors = (d.detail as Array<{ loc?: unknown[]; msg?: string }>).map((err) => {
                    const field = err.loc ? err.loc[err.loc.length - 1] : "";
                    const rawMsg = err.msg || "校验失败";
                    const cleanMsg = rawMsg.replace(/^Value error,\s*/i, "");
                    return field ? `${field}: ${cleanMsg}` : cleanMsg;
                });
                msg = errors.join("; ");
            } else if (typeof d.detail === "string") {
                msg = d.detail;
            } else if (typeof d.msg === "string") {
                msg = d.msg;
            } else if (typeof d.message === "string") {
                msg = d.message;
            } else {
                msg = JSON.stringify(detail);
            }
        } else if (typeof detail === "string") {
            msg = detail;
        }

        const isOobe = res.status === 503 || code === "ERR_SYSTEM_OOBE" || msg.includes("System not initialized");
        if (isOobe) {
            if (typeof window !== "undefined") {
                const pathName = window.location.pathname;
                const isOobePage = pathName === "/oobe" || pathName.startsWith("/oobe");
                const isOobeApi = path.startsWith("/api/oobe") || path.includes("/oobe");
                if (!isOobePage && !isOobeApi) {
                    const targetOobeUrl = process.env.NEXT_PUBLIC_ADMIN_OOBE_URL || `${getAdminSiteUrl()}/oobe`;
                    window.location.href = targetOobeUrl;
                    return new Promise(() => {});
                }
            }
        }

        if (res.status === 429) {
            const retryHeader = res.headers.get("retry-after");
            const parsedRetry = retryHeader ? parseInt(retryHeader, 10) : NaN;
            const retryAfter = !Number.isNaN(parsedRetry) && parsedRetry > 0
                ? parsedRetry
                : (code === "ERR_IP_BLOCKED" ? 300 : 30);
            const apiErr = new ApiError(429, detail, retryAfter);
            if (!path.startsWith("/token/qr-login/poll")) {
                emitRateLimited({
                    message: apiErr.message,
                    retryAfter,
                    code: apiErr.code,
                    path,
                });
            }
            throw apiErr;
        }

        if (msg === "Failed to fetch" || (typeof msg === "string" && msg.includes("Failed to fetch"))) {
            msg = "未知的服务器回答，请联系管理员";
        }

        throw new ApiError(res.status, detail);
    }

    const text = await res.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
}

function get<T>(path: string, base?: string): Promise<T> {
    return request<T>(path, { method: "GET" }, base);
}

function post<T>(path: string, body?: unknown, base?: string): Promise<T> {
    return request<T>(path, {
        method: "POST",
        body: body !== undefined ? JSON.stringify(body) : undefined,
    }, base);
}

function patch<T>(path: string, body?: unknown, base?: string): Promise<T> {
    return request<T>(path, {
        method: "PATCH",
        body: body !== undefined ? JSON.stringify(body) : undefined,
    }, base);
}

function del<T>(path: string, base?: string): Promise<T> {
    return request<T>(path, { method: "DELETE" }, base);
}

/** 编码账户内路径前缀 */
function acctPath(accountId: string): string {
    return `/account/${encodeURIComponent(accountId)}`;
}

// ============================================================
// Token (Management API: /token/*)
// ============================================================

export const token = {
    refresh: () =>
        post<TokenResponse>("/token/refresh"),

    verify: () =>
        post<unknown>("/token/verify"),

    deactivate: () =>
        post<MessageResponse>("/token/deactivate"),

    exchange: () =>
        post<{ code: string }>("/token/exchange"),

    redeem: (code: string) =>
        post<TokenResponse>("/token/redeem", { code }),

    redeemCertificate: (code: string) =>
        post<CertificateRedeemResponse>("/token/certificate/redeem", { code }),

    sessionFromCertificate: (data: { cert_id: string; cert_secret: string; ttl?: number }) =>
        post<CertificateSessionResponse>("/token/certificate/session", data),

    rotateCertificate: (data: { cert_id: string; cert_secret: string }) =>
        post<CertificateRotateResponse>("/token/certificate/rotate", data),

    createQrLogin: () =>
        post<import("./types").QrLoginCreateResponse>("/token/qr-login/create"),

    pollQrLogin: (code: string) =>
        get<import("./types").QrLoginPollResponse>(`/token/qr-login/poll?code=${encodeURIComponent(code)}`),

    authorizeQrLogin: (data: { code: string; cert_id?: string; cert_secret?: string }) =>
        post<{ authorized: boolean; user_id: string }>("/token/qr-login/authorize", data),
};

// ============================================================
// Auth (Management API: /user/*)
// ============================================================

export const auth = {
    register: (data: UserRegisterRequest) =>
        post<MessageResponse>("/user/apply", data),

    login: (data: UserLoginRequest) =>
        post<LoginResult>("/user/auth", data),

    logout: () =>
        post<MessageResponse>("/token/deactivate"),

    checkMailAvailability: (email: string, cfTurnstileResponse: string) =>
        post<unknown>("/user/availability/mail", {
            email,
            cf_turnstile_response: cfTurnstileResponse,
        }),

    checkUsernameAvailability: (username: string) =>
        get<unknown>(`/user/availability/username?value=${encodeURIComponent(username)}`),
};

export const community = {
    getStatus: () =>
        get<import("./types").CommunityStatusResponse>("/community/status"),

    getCode: (cfTurnstileResponse: string) =>
        post<{ code: string; expires_in?: number }>("/community/code", {
            cf_turnstile_response: cfTurnstileResponse,
        }),
};

export const site = {
    getAnnouncement: () => get<SiteAnnouncement>("/site/announcement"),
};

export const system = {
    getVersion: () => get<{ version: string }>("/version"),
};

// ============================================================
// Support Tickets (Management API: /ticket/*)
// ============================================================

export const tickets = {
    create: (data: TicketCreateRequest) =>
        post<TicketDetail>("/ticket", data),

    list: (params?: { offset?: number; limit?: number; status?: TicketStatus }) => {
        const searchParams = new URLSearchParams();
        if (params?.offset !== undefined) searchParams.set("offset", String(params.offset));
        if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));
        if (params?.status) searchParams.set("status", params.status);
        const qs = searchParams.toString();
        return get<TicketListResponse>(`/ticket/list${qs ? `?${qs}` : ""}`);
    },

    get: (ticketId: string) =>
        get<TicketDetail>(`/ticket/${encodeURIComponent(ticketId)}`),

    reply: (ticketId: string, content: string) =>
        post<TicketMessage>(`/ticket/${encodeURIComponent(ticketId)}/reply`, { content }),

    close: (ticketId: string) =>
        post<MessageResponse>(`/ticket/${encodeURIComponent(ticketId)}/close`),

    unreadCount: () =>
        get<{ count: number }>("/ticket/unread-count"),
};

// ============================================================
// User Info (Management API: /user/info/*)
// ============================================================

export const userInfo = {
    get: () =>
        get<UserOut>("/user/info"),

    changeEmail: (data: EmailUpdate) =>
        post<unknown>("/user/info/email", data),

    changeUsername: (data: UsernameUpdate) =>
        post<unknown>("/user/info/username", data),

    changeDisplayName: (data: DisplayNameUpdate) =>
        post<unknown>("/user/info/display-name", data),

    changePassword: (data: PasswordChange) =>
        post<unknown>("/user/info/password/change", data),

    issueCertificate: (data: CertificateIssueRequest) =>
        post<CertificateIssueResponse>("/user/certificate/issue", data),

    listCertificates: () =>
        get<{ items: LoginCertificateItem[] }>("/user/certificate/list"),

    revokeCertificate: (certId?: string, revokeAll = false) =>
        post<{ status: string; message: string }>("/user/certificate/revoke", {
            cert_id: certId,
            revoke_all: revokeAll,
        }),
};

// ============================================================
// 2FA (Management API: /user/2fa/totp/*)
// ============================================================

export const twoFA = {
    enable: (reset = false) =>
        post<TotpEnableResponse>(`/user/2fa/totp/enable${reset ? "?reset=true" : ""}`),

    confirm: (data: TotpConfirmRequest) =>
        post<unknown>("/user/2fa/totp/confirm", data),

    disable: (data: TotpDisableRequest) =>
        post<unknown>("/user/2fa/totp/disable", data),

    verify: (data: TotpVerifyRequest) =>
        post<TokenResponse>("/user/2fa/totp/verify", data),

    recover: (data: TotpRecoverRequest) =>
        post<TokenResponse>("/user/2fa/totp/recover", data),
};

// ============================================================
// Accounts (Management API: /account/*)
// ============================================================

export const accounts = {
    list: () =>
        get<AccountOut[]>("/account/list"),

    search: (q: string) =>
        post<AccountOut[]>(`/account/search?q=${encodeURIComponent(q)}`),

    apply: (data: AccountCreate) =>
        post<AccountOut>("/account/apply", data),

    delete: (accountId: string) =>
        del<unknown>(`/account/${encodeURIComponent(accountId)}`),

    info: (accountId: string) =>
        get<AccountOut>(`/account/${encodeURIComponent(accountId)}/info`),

    updateInfo: (accountId: string, data: AccountInfoUpdate) =>
        post<AccountOut>(`/account/${encodeURIComponent(accountId)}/info`, data),

    changeId: (accountId: string, data: AccountIdUpdate) =>
        post<AccountOut>(`/account/${encodeURIComponent(accountId)}/info/id`, data),

    changeSlug: (accountId: string, data: SlugUpdate) =>
        post<AccountOut>(`/account/${encodeURIComponent(accountId)}/info/slug`, data),

    changeName: (accountId: string, data: AccountNameUpdate) =>
        post<AccountOut>(`/account/${encodeURIComponent(accountId)}/info/name`, data),

    regenerateApiKey: (accountId: string) =>
        post<AccountOut>(`/account/${encodeURIComponent(accountId)}/info/regenerate-api-key`),

    downloadPreset: (accountId: string, classIdentity = "") =>
        get<ManagementSettings>(`${acctPath(accountId)}/ManagementPreset.json${classIdentity ? `?class_identity=${encodeURIComponent(classIdentity)}` : ""}`),

    getQuotas: (accountId: string) =>
        get<import("./types").QuotaOut[]>(`${acctPath(accountId)}/quota`),

    setQuota: (accountId: string, data: import("./types").QuotaSetRequest) =>
        post<import("./types").QuotaOut>(`${acctPath(accountId)}/quota`, data),
};

// ============================================================
// Pairing & Registration Mode (Management API: /account/{accountId}/pairing/*)
// ============================================================

export const pairing = {
    getStatus: (accountId: string) =>
        get<PairingStatusResponse>(`${acctPath(accountId)}/pairing/status`),

    setMode: (accountId: string, mode: RegistrationMode) =>
        post<{ status: string; registration_mode: RegistrationMode }>(`${acctPath(accountId)}/pairing/mode`, { mode }),

    listCodes: (accountId: string) =>
        get<PairingCodeOut[]>(`${acctPath(accountId)}/pairing/list`),

    search: (accountId: string, q?: string) =>
        get<PairingCodeOut[]>(`${acctPath(accountId)}/pairing/search${q ? `?q=${encodeURIComponent(q)}` : ""}`),

    approve: (accountId: string, pairingId: string, presetProfile?: ClientProfileConfig) =>
        post<unknown>(`${acctPath(accountId)}/pairing/${encodeURIComponent(pairingId)}/approve`, presetProfile ? { preset_profile: presetProfile } : {}),

    reject: (accountId: string, pairingId: string) =>
        post<unknown>(`${acctPath(accountId)}/pairing/${encodeURIComponent(pairingId)}/reject`),

    enable: (accountId: string) =>
        post<unknown>(`${acctPath(accountId)}/pairing/enable`),

    disable: (accountId: string) =>
        post<unknown>(`${acctPath(accountId)}/pairing/disable`),
};

// ============================================================
// Pre-Registration (Management API: /account/{accountId}/pre-registration/*)
// ============================================================

export const preRegistration = {
    list: (accountId: string) =>
        get<PreRegOut[]>(`${acctPath(accountId)}/pre-registration/list`),

    search: (accountId: string, q?: string) =>
        get<PreRegOut[]>(`${acctPath(accountId)}/pre-registration/search${q ? `?q=${encodeURIComponent(q)}` : ""}`),

    get: (accountId: string, preRegId: string) =>
        get<PreRegOut>(`${acctPath(accountId)}/pre-registration/${encodeURIComponent(preRegId)}`),

    create: (accountId: string, data: PreRegCreate) =>
        post<PreRegOut>(`${acctPath(accountId)}/pre-registration/create`, data),

    batchCreate: (accountId: string, items: PreRegCreate[]) =>
        post<PreRegOut[]>(`${acctPath(accountId)}/pre-registration/batch-create`, { items }),

    delete: (accountId: string, preRegId: string) =>
        del<void>(`${acctPath(accountId)}/pre-registration/${encodeURIComponent(preRegId)}`),

    rename: (accountId: string, preRegId: string, body: { label?: string; class_identity?: string; mac_address?: string }) =>
        post<PreRegOut>(`${acctPath(accountId)}/pre-registration/${encodeURIComponent(preRegId)}/rename`, body),

    enable: (accountId: string, preRegId: string) =>
        post<unknown>(`${acctPath(accountId)}/pre-registration/${encodeURIComponent(preRegId)}/enable`),

    disable: (accountId: string, preRegId: string) =>
        post<unknown>(`${acctPath(accountId)}/pre-registration/${encodeURIComponent(preRegId)}/disable`),

    config: (accountId: string, preRegId: string, body: ClientProfileConfig) =>
        post<unknown>(`${acctPath(accountId)}/pre-registration/${encodeURIComponent(preRegId)}/config`, body),

    downloadPreset: (accountId: string, preRegId: string) =>
        get<ManagementSettings>(`${acctPath(accountId)}/pre-registration/${encodeURIComponent(preRegId)}/ManagementPreset.json`),
};

// ============================================================
// Access Control (Management API: /account/{accountId}/access/*)
// ============================================================

export const access = {
    list: (accountId: string) =>
        get<AccessMember[]>(`${acctPath(accountId)}/access/list`),

    search: (accountId: string, q?: string) =>
        get<AccessMember[]>(`${acctPath(accountId)}/access/search${q ? `?q=${encodeURIComponent(q)}` : ""}`),

    get: (accountId: string, userId: string) =>
        get<AccessMember>(`${acctPath(accountId)}/access/${encodeURIComponent(userId)}`),

    update: (accountId: string, userId: string, data: AccessRoleUpdate) =>
        post<AccessMember>(`${acctPath(accountId)}/access/${encodeURIComponent(userId)}`, data),

    rename: (accountId: string, userId: string, body: { display_name?: string; name?: string }) =>
        post<unknown>(`${acctPath(accountId)}/access/${encodeURIComponent(userId)}/rename`, body),

    delete: (accountId: string, userId: string) =>
        del<void>(`${acctPath(accountId)}/access/${encodeURIComponent(userId)}`),
};

// ============================================================
// Invitations (Management API: /account/{accountId}/invitation/*)
// ============================================================

export const invitations = {
    list: (accountId: string) =>
        get<InvitationOut[]>(`${acctPath(accountId)}/invitation/list`),

    search: (accountId: string, q?: string) =>
        get<InvitationOut[]>(`${acctPath(accountId)}/invitation/search${q ? `?q=${encodeURIComponent(q)}` : ""}`),

    get: (accountId: string, invitationId: string) =>
        get<InvitationOut>(`${acctPath(accountId)}/invitation/${encodeURIComponent(invitationId)}`),

    create: (accountId: string, data?: InvitationCreate) =>
        post<InvitationOut>(`${acctPath(accountId)}/invitation/create`, data || {}),

    accept: (code: string) =>
        post<{ status: string; account_id: string; role_in_account: string }>(`/account/invitation/accept`, { code }),

    rename: (accountId: string, invitationId: string, body: { role_in_account?: string; is_active?: boolean }) =>
        post<unknown>(`${acctPath(accountId)}/invitation/${encodeURIComponent(invitationId)}/rename`, body),

    delete: (accountId: string, invitationId: string) =>
        del<void>(`${acctPath(accountId)}/invitation/${encodeURIComponent(invitationId)}`),
};

// ============================================================
// Data（资源 CRUD, Management API: /account/{accountId}/{resource_type}/...)
// ============================================================

export const data = {
    create: (accountId: string, type: ResourceType, name: string) =>
        get<StatusResponse>(`${acctPath(accountId)}/${type}/create?name=${encodeURIComponent(name)}`),

    list: (accountId: string, type: ResourceType) =>
        get<string[]>(`${acctPath(accountId)}/${type}/list`),

    getToken: (accountId: string, type: ResourceType, name: string) =>
        get<{ token: string; url: string }>(`${acctPath(accountId)}/${type}/token?name=${encodeURIComponent(name)}`),

    deleteData: (accountId: string, type: ResourceType, name: string) =>
        del<StatusResponse>(`${acctPath(accountId)}/${type}/delete?name=${encodeURIComponent(name)}`),

    write: (accountId: string, type: ResourceType, name: string, payload: unknown) =>
        post<StatusResponse>(`${acctPath(accountId)}/${type}/write?name=${encodeURIComponent(name)}`, payload),

    patch: (accountId: string, type: ResourceType, name: string, payload: unknown) =>
        patch<StatusResponse>(`${acctPath(accountId)}/${type}/update?name=${encodeURIComponent(name)}`, payload),

    read: (accountId: string, type: ResourceType, name: string) =>
        get<unknown>(`${acctPath(accountId)}/${type}/${encodeURIComponent(name)}`),

    listHistory: (accountId: string, type: ResourceType, name: string) =>
        get<import("./types").ResourceHistoryItem[]>(`${acctPath(accountId)}/${type}/history?name=${encodeURIComponent(name)}`),

    readHistoryVersion: (accountId: string, type: ResourceType, name: string, version: number) =>
        get<import("./types").ResourceHistoryVersionOut>(`${acctPath(accountId)}/${type}/history/${version}?name=${encodeURIComponent(name)}`),

    batch: (accountId: string, ops: BatchRequest) =>
        post<unknown>(`${acctPath(accountId)}/batch`, { ...ops, target_account_id: accountId }),
};

// ============================================================
// Credentials Helper
// ============================================================

export const credentials = {
    encode: (accountId: string, password: string) =>
        post<{ credential: string }>(`${acctPath(accountId)}/credentials/encode`, { password }),
};

// ============================================================
// Clients (Management API: /account/{accountId}/client/*)
// ============================================================

export const clients = {
    list: (accountId: string) =>
        get<ClientDeviceOut[]>(`${acctPath(accountId)}/client/list`),

    search: (accountId: string, q?: string) =>
        get<ClientDeviceOut[]>(`${acctPath(accountId)}/client/search${q ? `?q=${encodeURIComponent(q)}` : ""}`),

    details: (accountId: string, clientId: string) =>
        get<ClientDeviceOut>(`${acctPath(accountId)}/client/${encodeURIComponent(clientId)}`),

    delete: (accountId: string, clientId: string) =>
        del<void>(`${acctPath(accountId)}/client/${encodeURIComponent(clientId)}`),

    rename: (accountId: string, clientId: string, body: { display_name?: string; client_id?: string }) =>
        post<unknown>(`${acctPath(accountId)}/client/${encodeURIComponent(clientId)}/rename`, body),

    status: (accountId: string, clientId: string) =>
        get<{ uid: string; status: string; is_disabled: boolean }>(`${acctPath(accountId)}/client/${encodeURIComponent(clientId)}/status`),

    disconnect: (accountId: string, clientId: string) =>
        post<StatusResponse>(`${acctPath(accountId)}/client/${encodeURIComponent(clientId)}/disconnect`),

    disable: (accountId: string, clientId: string) =>
        post<StatusResponse>(`${acctPath(accountId)}/client/${encodeURIComponent(clientId)}/disable`),

    enable: (accountId: string, clientId: string) =>
        post<StatusResponse>(`${acctPath(accountId)}/client/${encodeURIComponent(clientId)}/enable`),

    getProfileConfig: (accountId: string, clientId: string) =>
        get<{ client_uid: string; profile_config: ClientProfileConfig; has_custom_profile: boolean }>(
            `${acctPath(accountId)}/client/${encodeURIComponent(clientId)}/config`
        ),

    config: (accountId: string, clientId: string, body: ClientProfileConfig) =>
        post<StatusResponse>(`${acctPath(accountId)}/client/${encodeURIComponent(clientId)}/config`, body),

    batch: (accountId: string, req: ClientBatchRequest) =>
        post<{ status: string; results: Array<{ uid: string; status: string }> }>(`${acctPath(accountId)}/client/batch`, req),

    restart: (accountId: string, clientId: string) =>
        post<StatusResponse>(`${acctPath(accountId)}/client/${encodeURIComponent(clientId)}/command/restart`),

    forceSync: (accountId: string, clientId: string) =>
        post<StatusResponse>(`${acctPath(accountId)}/client/${encodeURIComponent(clientId)}/command/update-data`),

    sendNotification: (accountId: string, clientId: string, payload: NotificationPayload) =>
        post<StatusResponse>(`${acctPath(accountId)}/client/${encodeURIComponent(clientId)}/command/send-notification`, payload),

    broadcastNotification: (accountId: string, payload: NotificationPayload, clientUids?: string[]) =>
        post<{ status: string; sent_count: number; total_targets: number }>(
            `${acctPath(accountId)}/client/broadcast/send-notification`,
            { ...payload, client_uids: clientUids || null }
        ),

    getConfig: (accountId: string, clientId: string, configType: number) =>
        get<{ status: string; request_guid: string; config_type: number; config_type_name: string }>(
            `${acctPath(accountId)}/client/${encodeURIComponent(clientId)}/command/get-config?config_type=${configType}`
        ),

    listConfigUploads: (accountId: string, clientId: string) =>
        get<ConfigUploadItem[]>(`${acctPath(accountId)}/client/${encodeURIComponent(clientId)}/config-uploads`),

    getConfigUploadDetail: (accountId: string, requestGuid: string) =>
        get<ConfigUploadItem>(`${acctPath(accountId)}/config-upload/${encodeURIComponent(requestGuid)}`),

    sendExtendCommand: (
        accountId: string,
        clientId: string,
        action: string,
        payload?: Record<string, unknown> | null,
        ttlSeconds = 120,
    ) =>
        post<ExtendCommandDispatchResult>(
            `${acctPath(accountId)}/client/${encodeURIComponent(clientId)}/command/extend`,
            { action, payload: payload || null, ttl_seconds: ttlSeconds },
        ),

    broadcastExtendCommand: (
        accountId: string,
        action: string,
        payload?: Record<string, unknown> | null,
        clientUids?: string[],
        ttlSeconds = 120,
    ) =>
        post<ExtendCommandBroadcastResult>(
            `${acctPath(accountId)}/client/broadcast/extend`,
            {
                action,
                payload: payload || null,
                client_uids: clientUids || null,
                ttl_seconds: ttlSeconds,
            },
        ),
};

// ============================================================
// Audit Logs (Management API: /account/{accountId}/audit/*)
// ============================================================

export const audit = {
    list: (accountId: string, params?: { client_uid?: string; event_type?: number; limit?: number; offset?: number }) => {
        const searchParams = new URLSearchParams();
        if (params?.client_uid) searchParams.set("client_uid", params.client_uid);
        if (params?.event_type !== undefined) searchParams.set("event_type", String(params.event_type));
        if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));
        if (params?.offset !== undefined) searchParams.set("offset", String(params.offset));
        const qs = searchParams.toString();
        return get<AuditLogItem[]>(`${acctPath(accountId)}/audit/list${qs ? `?${qs}` : ""}`);
    },

    clear: (accountId: string, clientUid?: string) =>
        del<{ status: string }>(`${acctPath(accountId)}/audit/clear${clientUid ? `?client_uid=${encodeURIComponent(clientUid)}` : ""}`),
};

// ============================================================
// Bulk (Management API: /account/bulk)
// ============================================================

export const bulk = {
    execute: (ops: BatchRequest, accountId?: string) =>
        post<unknown>(
            accountId ? `${acctPath(accountId)}/batch` : "/bulk",
            accountId ? { ...ops, target_account_id: accountId } : ops
        ),
};

// ============================================================
// Admin API（超管专用，使用 Admin 端点）
// ============================================================

const adminBase = () => getAdminUrl();

export const adminApi = {
    listAccounts: () =>
        get<AccountOut[]>("/account", adminBase()),

    listUsers: (offset = 0, limit = 20) =>
        get<UserOut[]>(`/user/list?offset=${offset}&limit=${limit}`, adminBase()),

    searchUsers: (q: string) =>
        get<UserOut[]>(`/user/search?q=${encodeURIComponent(q)}`, adminBase()),

    createUser: (data: UserRegisterRequest) =>
        post<UserOut>("/user/create", data, adminBase()),

    getUser: (userId: string) =>
        get<UserOut>(`/user/${encodeURIComponent(userId)}`, adminBase()),

    updateUser: (userId: string, data: UserUpdateRequest) =>
        post<UserOut>(`/user/${encodeURIComponent(userId)}`, data, adminBase()),

    deleteUser: (userId: string) =>
        del<unknown>(`/user/${encodeURIComponent(userId)}`, adminBase()),

    renameUser: (userId: string, data: { name: string }) =>
        post<unknown>(`/user/${encodeURIComponent(userId)}/rename`, data, adminBase()),

    resetPassword: (userId: string, data: { new_password: string }) =>
        post<unknown>(`/user/${encodeURIComponent(userId)}/password/reset`, data, adminBase()),

    changePassword: (userId: string, data: PasswordChange) =>
        post<unknown>(`/user/${encodeURIComponent(userId)}/password/change`, data, adminBase()),

    listPendingUsers: (offset = 0, limit = 50) =>
        get<UserOut[]>(`/user/pending/list?offset=${offset}&limit=${limit}`, adminBase()),

    approveUser: (userId: string) =>
        post<unknown>(`/user/pending/approve/${encodeURIComponent(userId)}`, undefined, adminBase()),

    rejectUser: (userId: string) =>
        post<unknown>(`/user/pending/reject/${encodeURIComponent(userId)}`, undefined, adminBase()),

    getSettings: () =>
        get<Record<string, unknown>>("/settings", adminBase()),

    updateSettings: (data: Record<string, unknown>) =>
        post<unknown>("/settings", data, adminBase()),

    async probeSuperAdmin(): Promise<boolean> {
        try {
            await get<unknown>("/settings", adminBase());
            return true;
        } catch (e) {
            if (e instanceof ApiError && (e.status === 403 || e.status === 401)) {
                return false;
            }
            return false;
        }
    },
};

startTokenRefreshTimer();
