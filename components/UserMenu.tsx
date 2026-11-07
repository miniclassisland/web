"use client";

/**
 * 右上角用户菜单（MINI ClassIsland 顶栏）。
 *
 * 弹出卡片包含：用户头像/角色、当前账户信息、
 * 账户切换器、外观主题切换（自动深色/浅色/深色）、超级管理面板入口（条件显示）、安全设置和登出。
 */

import React, { useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAccount, isUserCenterPath } from "@/lib/account-context";
import { useThemeMode, THEME_MODE_LABELS, type ThemeMode } from "@/lib/theme-context";
import { token as tokenApi, getAdminSiteUrl } from "@/lib/api";
import { ROLE_LABELS, SYSTEM_ROLES } from "@/lib/types";
import {
    Person24Regular, ShieldKeyhole24Regular,
    Settings24Regular, SignOut24Regular,
    ChevronDown16Regular, Checkmark16Regular,
    ArrowSwap20Regular, WeatherSunny20Regular,
    WeatherMoon20Regular, Desktop20Regular,
    Home24Regular,
} from "@fluentui/react-icons";

export default function UserMenu() {
    const router = useRouter();
    const pathname = usePathname();
    const { user, isSuperAdmin, logout, token } = useAuth();
    const { accounts, currentAccount, switchAccount } = useAccount();
    const { mode, setMode } = useThemeMode();
    const [open, setOpen] = useState(false);
    const [showSwitcher, setShowSwitcher] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const inUserCenter = isUserCenterPath(pathname);
    const isUserHome = pathname === "/";

    React.useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpen(false);
                setShowSwitcher(false);
            }
        }
        if (open) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    const userDisplayLabel = user?.display_name || user?.username || user?.email || "当前用户";
    const roleLabel = user
        ? (ROLE_LABELS[user.role_code] || user.role_code)
        : (isSuperAdmin ? ROLE_LABELS[SYSTEM_ROLES.SUPERADMIN] : ROLE_LABELS[SYSTEM_ROLES.NORMAL]);

    const themeOptions: { key: ThemeMode; label: string; icon: React.ReactNode }[] = [
        { key: "system", label: "自动", icon: <Desktop20Regular style={{ width: 14, height: 14 }} /> },
        { key: "light", label: "浅色", icon: <WeatherSunny20Regular style={{ width: 14, height: 14 }} /> },
        { key: "dark", label: "深色", icon: <WeatherMoon20Regular style={{ width: 14, height: 14 }} /> },
    ];

    return (
        <div className="user-menu-wrapper" ref={menuRef}>
            <button
                className="user-menu-trigger"
                onClick={() => { setOpen(!open); setShowSwitcher(false); }}
                aria-label="用户菜单"
            >
                <div className="user-menu-avatar">
                    <Person24Regular />
                </div>
                <span className="user-menu-account-name">
                    {userDisplayLabel}
                </span>
                <ChevronDown16Regular />
            </button>

            {open && (
                <div className="user-menu-popover">
                    {!showSwitcher ? (
                        <>
                            <div className="user-menu-header">
                                <div className="user-menu-avatar-lg">
                                    <Person24Regular />
                                </div>
                                <div className="user-menu-info">
                                    <div className="user-menu-name">
                                        {userDisplayLabel}
                                    </div>
                                    <div className="user-menu-role">
                                        {roleLabel}
                                    </div>
                                </div>
                            </div>

                            <div className="user-menu-divider" />

                            {!inUserCenter && currentAccount && (
                                <div className="user-menu-section">
                                    <div className="user-menu-section-label">当前账户</div>
                                    <div className="user-menu-current-account">
                                        <span>{currentAccount.name}</span>
                                        <span className="user-menu-slug">{currentAccount.slug}</span>
                                    </div>
                                </div>
                            )}

                            {accounts.length > 0 && (
                                <button
                                    className="user-menu-item"
                                    onClick={() => setShowSwitcher(true)}
                                >
                                    <ArrowSwap20Regular />
                                    <span>切换账户中心 ({accounts.length})</span>
                                </button>
                            )}

                            {!isUserHome && (
                                <button
                                    className="user-menu-item"
                                    onClick={() => {
                                        setOpen(false);
                                        router.push("/");
                                    }}
                                >
                                    <Home24Regular />
                                    <span>返回用户中心主页</span>
                                </button>
                            )}

                            {(accounts.length > 0 || !isUserHome || (!inUserCenter && currentAccount)) && (
                                <div className="user-menu-divider" />
                            )}

                            <div className="user-menu-section">
                                <div className="user-menu-section-label">
                                    外观主题 · {THEME_MODE_LABELS[mode]}
                                </div>
                                <div className="theme-switcher-group" style={{ width: "100%", marginTop: 4 }}>
                                    {themeOptions.map((opt) => (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            className={`theme-segment-btn ${mode === opt.key ? "active" : ""}`}
                                            style={{ flex: 1, justifyContent: "center" }}
                                            onClick={() => setMode(opt.key)}
                                        >
                                            {opt.icon}
                                            <span>{opt.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="user-menu-divider" />

                            {isSuperAdmin && (
                                <button
                                    className="user-menu-item user-menu-item-admin"
                                    onClick={async () => {
                                        setOpen(false);
                                        const adminUrl = getAdminSiteUrl();
                                        if (token) {
                                            try {
                                                const { code } = await tokenApi.exchange();
                                                window.location.href = `${adminUrl}/auth#code=${encodeURIComponent(code)}`;
                                                return;
                                            } catch {
                                                window.location.href = adminUrl || "/";
                                                return;
                                            }
                                        }
                                        window.location.href = adminUrl || "/";
                                    }}
                                >
                                    <ShieldKeyhole24Regular />
                                    <span>超级管理面板</span>
                                </button>
                            )}

                            <a
                                className="user-menu-item"
                                href="/security"
                                onClick={() => setOpen(false)}
                            >
                                <Settings24Regular />
                                <span>安全设置</span>
                            </a>

                            <div className="user-menu-divider" />

                            <button
                                className="user-menu-item user-menu-item-danger"
                                onClick={() => { logout(); setOpen(false); }}
                            >
                                <SignOut24Regular />
                                <span>登出</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="user-menu-header">
                                <button
                                    className="user-menu-back"
                                    onClick={() => setShowSwitcher(false)}
                                >
                                    ← 返回
                                </button>
                                <span className="user-menu-section-label">选择账户</span>
                            </div>
                            <div className="user-menu-divider" />
                            <div className="user-menu-account-list">
                                {accounts.map(acct => (
                                    <button
                                        key={acct.id}
                                        className={`user-menu-account-item ${currentAccount?.id === acct.id ? "active" : ""}`}
                                        onClick={() => {
                                            switchAccount(acct.id);
                                            setShowSwitcher(false);
                                            setOpen(false);
                                            router.push("/dashboard");
                                        }}
                                    >
                                        <div>
                                            <div className="user-menu-account-item-name">{acct.name}</div>
                                            <div className="user-menu-account-item-slug">{acct.slug}</div>
                                        </div>
                                        {currentAccount?.id === acct.id && (
                                            <Checkmark16Regular />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
