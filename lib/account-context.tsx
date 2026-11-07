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
    return (
        pathname === "/" ||
        pathname.startsWith("/security") ||
        pathname.startsWith("/tickets")
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
    const [loading, setLoading] = useState(false);

    const refreshAccounts = useCallback(async () => {
        if (!isAuthenticated) return;
        setLoading(true);
        try {
            const list = await accountsApi.list();
            setAccountList(list);

            // 恢复上次选择或自动选中唯一账户（仅作为进入账户中心时的默认目标）
            const savedId = typeof window !== "undefined"
                ? localStorage.getItem(STORAGE_KEY)
                : null;
            const saved = savedId ? list.find(a => a.id === savedId) : null;
            if (saved) {
                setSelectedAccount(saved);
            } else if (list.length === 1) {
                setSelectedAccount(list[0]);
                if (typeof window !== "undefined") {
                    localStorage.setItem(STORAGE_KEY, list[0].id);
                }
            } else if (list.length > 0 && !selectedAccount) {
                setSelectedAccount(list[0]);
                if (typeof window !== "undefined") {
                    localStorage.setItem(STORAGE_KEY, list[0].id);
                }
            } else if (list.length === 0) {
                setSelectedAccount(null);
            }
        } catch {
            /* 加载失败保持现状 */
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (isAuthenticated) {
            refreshAccounts();
        } else {
            setAccountList([]);
            setSelectedAccount(null);
        }
    }, [isAuthenticated, refreshAccounts]);

    const switchAccount = useCallback((id: string) => {
        const target = accountList.find(a => a.id === id);
        if (target) {
            setSelectedAccount(target);
            if (typeof window !== "undefined") {
                localStorage.setItem(STORAGE_KEY, id);
            }
        }
    }, [accountList]);

    const inUserCenter = isUserCenterPath(pathname);
    const effectiveAccount = inUserCenter ? null : selectedAccount;

    return (
        <AccountContext.Provider value={{
            accounts: accountList,
            currentAccount: effectiveAccount,
            accountId: effectiveAccount?.id || "",
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
