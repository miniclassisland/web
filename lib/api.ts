/* ===== API 客户端层 ===== */
/* 统一封装所有后端接口调用，Bearer Token 自动注入 */
/* 双端点架构：Management API / Admin API */

import type {
    UserRegisterRequest, UserLoginRequest, TokenResponse,
    UserOut, UserUpdateRequest, AccountOut, AccountCreate, SlugUpdate, AccountNameUpdate,
    EmailUpdate, UsernameUpdate, DisplayNameUpdate, PasswordChange,
    TotpEnableResponse, TotpConfirmRequest, TotpDisableRequest,
    TotpVerifyRequest, TotpRecoverRequest,
    PairingCodeOut, PairingStatusResponse, RegistrationMode,
    PreRegOut, PreRegCreate, AccessMember, AccessRoleUpdate,
    InvitationOut, InvitationCreate,
    NotificationPayload, BatchRequest, ClientBatchRequest,
    StatusResponse, MessageResponse, LoginResult,
    ResourceType, ClientDeviceOut, ClientProfileConfig,
    ConfigUploadItem, AuditLogItem, ManagementSettings,
} from "./types";

// ============================================================
// 服务器地址（从环境变量读取）
// Management API (27042) / Admin API (27043)
// ============================================================

const STORAGE_KEY_TOKEN = "miniclassisland_auth_token";

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

export function getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY_TOKEN);
}

export function setToken(token: string): void {
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
}

export function clearToken(): void {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
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
                msg = "请求过于频繁（HTTP 429），已被安全限流保护拦截，请稍后再试";
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
 * 401 时触发全局事件，供 AuthProvider 拦截并显示内联登录卡片。
 * 不再硬跳转 /login，保留用户上下文。
 */
function emitAuthExpired(): void {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("miniclassisland:auth-expired"));
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

async function request<T>(
    path: string,
    options: RequestInit = {},
    baseOverride?: string,
): Promise<T> {
    const base = baseOverride || getServerUrl();
    if (!base) throw new Error("未配置服务器地址");

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
    try {
        res = await fetch(`${base}${path}`, { ...options, headers });
    } catch (err: unknown) {
        const errObj = err as { message?: string; name?: string } | null;
        const rawMsg = errObj?.message || String(err);
        if (rawMsg.includes("Failed to fetch") || rawMsg.includes("fetch failed") || errObj?.name === "TypeError") {
            throw new ApiError(0, "未知的服务器回答，请联系管理员");
        }
        throw err;
    }

    if (res.status === 401 || res.status === 403) {
        const isAuthFlow = path === "/user/auth" || path === "/user/2fa/totp/verify" || path === "/user/2fa/totp/recover";
        if (!isAuthFlow) {
            if (path !== "/token/deactivate" && res.status === 401) {
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
                    const targetOobeUrl = process.env.NEXT_PUBLIC_ADMIN_OOBE_URL || `${process.env.NEXT_PUBLIC_ADMIN_SITE_URL || "https://admin.miniclassisland.com"}/oobe`;
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
            emitRateLimited({
                message: apiErr.message,
                retryAfter,
                code: apiErr.code,
                path,
            });
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

    checkMailAvailability: (email: string) =>
        get<unknown>(`/user/availability/mail?value=${encodeURIComponent(email)}`),

    checkUsernameAvailability: (username: string) =>
        get<unknown>(`/user/availability/username?value=${encodeURIComponent(username)}`),
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
};

// ============================================================
// 2FA (Management API: /user/2fa/totp/*)
// ============================================================

export const twoFA = {
    enable: () =>
        post<TotpEnableResponse>("/user/2fa/totp/enable"),

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

    batch: (accountId: string, ops: BatchRequest) =>
        post<unknown>(`${acctPath(accountId)}/batch`, ops),
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
    execute: (ops: BatchRequest) =>
        post<unknown>("/account/bulk", ops),
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
            await get<unknown>("/", adminBase());
            return true;
        } catch (e) {
            if (e instanceof ApiError && (e.status === 403 || e.status === 401)) {
                return false;
            }
            return false;
        }
    },
};
