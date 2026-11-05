"use client";

/**
 * 认证上下文 + 当前用户信息 + SuperAdmin 检测 + 401 内联登录支持。
 */

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { auth as authApi, userInfo, adminApi, getToken, setToken, clearToken } from "./api";
import type {
    UserLoginRequest,
    UserRegisterRequest,
    LoginResult,
    TokenResponse,
    TwoFARequired,
    UserOut,
} from "./types";

interface AuthState {
    isAuthenticated: boolean;
    initialized: boolean;
    token: string | null;
    user: UserOut | null;
    isSuperAdmin: boolean;
    pending2FA: TwoFARequired | null;
    requireReAuth: boolean;
    loading: boolean;
    error: string | null;
    registerSuccess: string | null;
    login: (data: UserLoginRequest) => Promise<void>;
    register: (data: UserRegisterRequest) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
    syncTokenFromStorage: (tokenOverride?: string | null) => void;
    complete2FA: (token: string) => void;
    cancel2FA: () => void;
    clearError: () => void;
    handleReAuth: (data: UserLoginRequest) => Promise<void>;
    dismissReAuth: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setTokenState] = useState<string | null>(null);
    const [initialized, setInitialized] = useState(false);
    const [user, setUser] = useState<UserOut | null>(null);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [pending2FA, setPending2FA] = useState<TwoFARequired | null>(null);
    const [requireReAuth, setRequireReAuth] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);

    const syncTokenFromStorage = useCallback((tokenOverride?: string | null) => {
        if (tokenOverride !== undefined) {
            if (tokenOverride) {
                setToken(tokenOverride);
                setTokenState(tokenOverride);
            } else {
                clearToken();
                setTokenState(null);
            }
        } else {
            setTokenState(getToken());
        }
        setInitialized(true);
    }, []);

    useEffect(() => {
        setTokenState(getToken());
        setInitialized(true);
    }, []);

    const isAuthenticated = !!token;

    const refreshUser = useCallback(async () => {
        if (!getToken()) {
            setUser(null);
            setIsSuperAdmin(false);
            return;
        }
        try {
            const u = await userInfo.get();
            setUser(u);
            if (u.role_code === "superadmin") {
                setIsSuperAdmin(true);
            } else {
                const probe = await adminApi.probeSuperAdmin();
                setIsSuperAdmin(probe);
            }
        } catch {
            const probe = await adminApi.probeSuperAdmin();
            setIsSuperAdmin(probe);
        }
    }, []);

    useEffect(() => {
        if (token) {
            refreshUser();
        } else {
            setUser(null);
            setIsSuperAdmin(false);
        }
    }, [token, refreshUser]);

    useEffect(() => {
        function onAuthExpired() {
            clearToken();
            setTokenState(null);
            setUser(null);
            setIsSuperAdmin(false);
            setRequireReAuth(false);
            try {
                sessionStorage.setItem("miniclassisland_session_expired", "1");
            } catch { /* ignore */ }
            if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
                window.location.href = "/login?expired=1";
            }
        }
        window.addEventListener("miniclassisland:auth-expired", onAuthExpired);
        return () => window.removeEventListener("miniclassisland:auth-expired", onAuthExpired);
    }, []);

    const login = useCallback(async (data: UserLoginRequest) => {
        setLoading(true);
        setError(null);
        setRegisterSuccess(null);
        try {
            const result: LoginResult = await authApi.login(data);
            if ("requires_2fa" in result && result.requires_2fa) {
                setPending2FA(result as TwoFARequired);
            } else {
                const tr = result as TokenResponse;
                setToken(tr.token);
                setTokenState(tr.token);
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "登录失败";
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, []);

    const register = useCallback(async (data: UserRegisterRequest) => {
        setLoading(true);
        setError(null);
        setRegisterSuccess(null);
        try {
            const result = await authApi.register(data);
            setRegisterSuccess(result.message || "注册成功，等待管理员审核");
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "注册失败";
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            await authApi.logout();
        } catch { /* ignore */ }
        clearToken();
        setTokenState(null);
        setUser(null);
        setPending2FA(null);
        setIsSuperAdmin(false);
        setRequireReAuth(false);
    }, []);

    const complete2FA = useCallback((t: string) => {
        setToken(t);
        setTokenState(t);
        setPending2FA(null);
    }, []);

    const cancel2FA = useCallback(() => {
        setPending2FA(null);
    }, []);

    const clearErrorCb = useCallback(() => {
        setError(null);
        setRegisterSuccess(null);
    }, []);

    const handleReAuth = useCallback(async (data: UserLoginRequest) => {
        setLoading(true);
        setError(null);
        try {
            const result: LoginResult = await authApi.login(data);
            if ("requires_2fa" in result && result.requires_2fa) {
                setPending2FA(result as TwoFARequired);
            } else {
                const tr = result as TokenResponse;
                setToken(tr.token);
                setTokenState(tr.token);
                setRequireReAuth(false);
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "重新登录失败";
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, []);

    const dismissReAuth = useCallback(() => {
        setRequireReAuth(false);
        clearToken();
        setTokenState(null);
    }, []);

    return (
        <AuthContext.Provider
            value={{
                isAuthenticated,
                initialized,
                token,
                user,
                isSuperAdmin,
                pending2FA,
                requireReAuth,
                loading,
                error,
                registerSuccess,
                login,
                register,
                logout,
                refreshUser,
                syncTokenFromStorage,
                complete2FA,
                cancel2FA,
                clearError: clearErrorCb,
                handleReAuth,
                dismissReAuth,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthState {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
