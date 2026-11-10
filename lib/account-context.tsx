"use client";

/**
 * 账户上下文管理器（Cloudflare 风格账户切换）。
 *
 * 用户登录后拉取可用账户列表，选择后设为当前账户上下文。
 * 只有一个账户时自动选中。accountId 供 API 层使用。
 */

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { accounts as accountsApi } from "./api";
import type { AccountOut } from "./types";

const STORAGE_KEY = "miniclassisland_current_account_id";

export function isUserCenterPath(pathname: string | null): boolean {
    if (!pathname) return false;
    const clean = pathname.replace(/\/+$/, "") || "/";
    return (
        clean === "/" ||
        clean === "/profile" ||
        clean.startsWith("/profile/") ||
        clean === "/security" ||
        clean.startsWith("/security/") ||
        clean === "/tickets" ||
        clean.startsWith("/tickets/")
    );
}

interface AccountState {
    /** 所有可用账户 */
    accounts: AccountOut[];
    /** 当前选中的账户（在用户中心路由下始终为 null） */
    currentAccount: AccountOut | null;
    /** 当前账户 ID 快捷访问（在用户中心路由下始终为 ""） */
    accountId: string;
    /** 是否正在加载 */
    loading: boolean;
    /** 切换到另一个账户 */
    switchAccount: (accountId: string) => void;
    /** 重新拉取账户列表 */
    refreshAccounts: () => Promise<void>;
}

const AccountContext = createContext<AccountState | null>(null);

export function AccountProvider({
    children,
    isAuthenticated,
}: {
    children: ReactNode;
    isAuthenticated: boolean;
}) {
    const pathname = usePathname();
    const [accountList, setAccountList] = useState<AccountOut[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<AccountOut | null>(null);
    const [selectedAccountId, setSelectedAccountId] = useState<string>(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem(STORAGE_KEY) || "";
        }
        return "";
    });
    const [loading, setLoading] = useState(true);

    const refreshAccounts = useCallback(async () => {
        if (!isAuthenticated) return;
        setLoading(true);
        try {
            const list = await accountsApi.list();
            setAccountList(list);

            const savedId = typeof window !== "undefined"
                ? localStorage.getItem(STORAGE_KEY)
                : null;
            const saved = savedId ? list.find(a => a.id === savedId) : null;
            if (saved) {
                setSelectedAccount(saved);
                setSelectedAccountId(saved.id);
            } else if (list.length > 0) {
                setSelectedAccount(list[0]);
                setSelectedAccountId(list[0].id);
                if (typeof window !== "undefined") {
                    localStorage.setItem(STORAGE_KEY, list[0].id);
                }
            } else {
                setSelectedAccount(null);
                setSelectedAccountId("");
            }
        } catch {
            /* 加载失败保持现状 */
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (isAuthenticated) {
            refreshAccounts();
        } else {
            setAccountList([]);
            setSelectedAccount(null);
            setSelectedAccountId("");
            setLoading(false);
        }
    }, [isAuthenticated, refreshAccounts]);

    const switchAccount = useCallback((id: string) => {
        if (!id) return;
        setSelectedAccountId(id);
        if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_KEY, id);
        }
        const target = accountList.find(a => a.id === id);
        if (target) {
            setSelectedAccount(target);
        }
    }, [accountList]);

    const inUserCenter = isUserCenterPath(pathname);
    const resolvedAccount = selectedAccount || (selectedAccountId ? accountList.find(a => a.id === selectedAccountId) || null : null);
    const effectiveAccount = inUserCenter ? null : resolvedAccount;
    const effectiveAccountId = inUserCenter ? "" : (effectiveAccount?.id || selectedAccountId || "");

    return (
        <AccountContext.Provider value={{
            accounts: accountList,
            currentAccount: effectiveAccount,
            accountId: effectiveAccountId,
            loading,
            switchAccount,
            refreshAccounts,
        }}>
            {children}
        </AccountContext.Provider>
    );
}

export function useAccount(): AccountState {
    const ctx = useContext(AccountContext);
    if (!ctx) throw new Error("useAccount must be used within AccountProvider");
    return ctx;
}
