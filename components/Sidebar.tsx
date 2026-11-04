"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAccount } from "@/lib/account-context";
import { useAuth } from "@/lib/auth-context";
import { token as tokenApi } from "@/lib/api";
import { Select } from "@fluentui/react-components";
import {
    Home24Regular, PlugConnected24Regular, Link24Regular,
    Settings24Regular, Book24Regular, Clock24Regular,
    Board24Regular, ShieldTask24Regular, Apps24Regular,
    Key24Regular, PersonAccounts24Regular,
    Send24Regular, PeopleAdd24Regular, Laptop24Regular,
    DataBarVertical24Regular, DocumentSearch24Regular,
    Add24Regular, ArrowLeft16Regular, ArrowRight16Regular,
    ShieldKeyhole24Regular, Dismiss24Regular,
} from "@fluentui/react-icons";

interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
    exact?: boolean;
}

interface NavSection {
    title: string;
    items: NavItem[];
}

const USER_CENTER_SECTIONS: NavSection[] = [
    {
        title: "用户中心",
        items: [
            { label: "账户主页", href: "/", icon: <Home24Regular />, exact: true },
            { label: "创建新账户", href: "/accounts/new", icon: <Add24Regular />, exact: true },
            { label: "个人资料与安全", href: "/security", icon: <DataBarVertical24Regular /> },
        ],
    },
];

const ACCOUNT_CENTER_SECTIONS: NavSection[] = [
    {
        title: "概览",
        items: [
            { label: "仪表盘", href: "/dashboard", icon: <Home24Regular /> },
        ],
    },
    {
        title: "档案管理",
        items: [
            { label: "科目管理", href: "/profiles/subjects", icon: <Book24Regular /> },
            { label: "时间表管理", href: "/profiles/timelayout", icon: <Clock24Regular /> },
            { label: "课表管理", href: "/profiles/classplan", icon: <Board24Regular /> },
            { label: "策略管理", href: "/profiles/policy", icon: <ShieldTask24Regular /> },
            { label: "默认设置", href: "/profiles/settings", icon: <Settings24Regular /> },
            { label: "组件设置", href: "/profiles/components", icon: <Apps24Regular /> },
            { label: "凭据管理", href: "/profiles/credentials", icon: <Key24Regular /> },
        ],
    },
    {
        title: "客户端",
        items: [
            { label: "客户端管理", href: "/clients", icon: <PlugConnected24Regular /> },
            { label: "通知推送", href: "/notifications", icon: <Send24Regular /> },
            { label: "审计日志", href: "/audit", icon: <DocumentSearch24Regular /> },
        ],
    },
    {
        title: "接入管理",
        items: [
            { label: "配对码管理", href: "/pairing", icon: <Link24Regular /> },
            { label: "预注册客户端", href: "/pre-registration", icon: <Laptop24Regular /> },
        ],
    },
    {
        title: "账户配置",
        items: [
            { label: "账户基础信息", href: "/accounts", icon: <PersonAccounts24Regular />, exact: true },
            { label: "访问控制", href: "/access", icon: <PeopleAdd24Regular /> },
            { label: "邀请管理", href: "/invitations", icon: <PeopleAdd24Regular /> },
        ],
    },
    {
        title: "个人与安全",
        items: [
            { label: "个人资料与安全", href: "/security", icon: <DataBarVertical24Regular /> },
        ],
    },
];

function resolveAdminSiteUrl(): string {
    const envUrl = process.env.NEXT_PUBLIC_ADMIN_SITE_URL;
    if (envUrl) return envUrl.replace(/\/+$/, "");
    if (typeof window === "undefined") return "";
    const { protocol, hostname, port, host } = window.location;
    if (port === "27042") {
        return `${protocol}//${hostname}:27043`;
    }
    if (port === "3000") {
        return `${protocol}//${hostname}:3001`;
    }
    if (hostname.startsWith("dash.")) {
        const baseHost = host.replace(/^dash\./i, "");
        return `${protocol}//admin.${baseHost}`;
    }
    if (!hostname.startsWith("admin.")) {
        return `${protocol}//admin.${host}`;
    }
    return "";
}

export default function Sidebar({
    mobileOpen = false,
    onCloseMobile,
}: {
    mobileOpen?: boolean;
    onCloseMobile?: () => void;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const { accounts, accountId, currentAccount, switchAccount } = useAccount();
    const { isSuperAdmin, token } = useAuth();

    const isUserCenter =
        pathname === "/" ||
        pathname.startsWith("/accounts/new") ||
        (pathname.startsWith("/security") && !accountId);

    const sections = isUserCenter ? USER_CENTER_SECTIONS : ACCOUNT_CENTER_SECTIONS;

    function handleJumpToAccount(targetAccountId: string) {
        switchAccount(targetAccountId);
        onCloseMobile?.();
        router.push("/dashboard");
    }

    return (
        <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
            <div className="sidebar-header">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.svg" alt="MINI ClassIsland" className="sidebar-logo" />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="sidebar-title">
                        {isUserCenter ? "MINI ClassIsland 用户中心" : "MINI ClassIsland 账户中心"}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                        {isUserCenter ? "User Center & Accounts" : (currentAccount?.slug || "Account Management")}
                    </div>
                </div>
                {onCloseMobile && (
                    <button
                        type="button"
                        className="mobile-drawer-close"
                        onClick={onCloseMobile}
                        aria-label="关闭导航菜单"
                    >
                        <Dismiss24Regular />
                    </button>
                )}
            </div>

            {!isUserCenter && (
                <div className="sidebar-tenant-box">
                    <Link
                        href="/"
                        className="sidebar-back-link"
                    >
                        <ArrowLeft16Regular />
                        <span>返回用户中心 (所有账户)</span>
                    </Link>

                    <div className="sidebar-section-label" style={{ paddingLeft: 0, marginTop: 8 }}>
                        当前账户中心
                    </div>
                    {accounts.length > 0 ? (
                        <Select
                            size="small"
                            value={accountId || ""}
                            onChange={(_, d) => {
                                if (d.value) {
                                    switchAccount(d.value);
                                }
                            }}
                            style={{ width: "100%" }}
                        >
                            {accounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.name} ({a.slug})
                                </option>
                            ))}
                        </Select>
                    ) : (
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>暂无可用账户</div>
                    )}
                </div>
            )}

            <nav className="sidebar-nav">
                {sections.map((section) => (
                    <div key={section.title} className="sidebar-section">
                        <div className="sidebar-section-label">{section.title}</div>
                        {section.items.map((item) => {
                            const isActive = item.exact
                                ? pathname === item.href
                                : pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`sidebar-link ${isActive ? "active" : ""}`}
                                >
                                    {item.icon}
                                    <span>{item.label}</span>
                                </Link>
                            );
                        })}
                        {isUserCenter && isSuperAdmin && section.title === "用户中心" && (
                            <button
                                type="button"
                                className="sidebar-link"
                                style={{ width: "100%", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}
                                onClick={async () => {
                                    const adminUrl = resolveAdminSiteUrl();
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
                    </div>
                ))}

                {isUserCenter && (
                    <div className="sidebar-section">
                        <div className="sidebar-section-label">选择跳转账户中心 ({accounts.length})</div>
                        {accounts.length === 0 ? (
                            <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-tertiary)" }}>
                                暂无已关联账户
                            </div>
                        ) : (
                            accounts.map((acct) => (
                                <button
                                    key={acct.id}
                                    type="button"
                                    className={`sidebar-account-jump ${accountId === acct.id ? "active" : ""}`}
                                    onClick={() => handleJumpToAccount(acct.id)}
                                    title={`进入「${acct.name}」(${acct.slug}) 账户中心`}
                                >
                                    <PersonAccounts24Regular style={{ flexShrink: 0 }} />
                                    <div className="sidebar-account-jump-info">
                                        <div className="sidebar-account-jump-name">{acct.name}</div>
                                        <div className="sidebar-account-jump-slug">{acct.slug}</div>
                                    </div>
                                    <ArrowRight16Regular className="sidebar-account-jump-arrow" />
                                </button>
                            ))
                        )}
                    </div>
                )}
            </nav>
        </aside>
    );
}
