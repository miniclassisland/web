"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAccount, isUserCenterPath } from "@/lib/account-context";
import { useAuth } from "@/lib/auth-context";
import { token as tokenApi, getAdminSiteUrl, system } from "@/lib/api";
import { type AccountOut } from "@/lib/types";
import { WEB_VERSION } from "@/lib/version";
import CommunityJoinLink from "./CommunityJoinLink";
import {
    Home24Regular,
    Link24Regular,
    Settings24Regular,
    Book24Regular,
    Clock24Regular,
    Board24Regular,
    ShieldTask24Regular,
    Apps24Regular,
    Key24Regular,
    PersonAccounts24Regular,
    PeopleAdd24Regular,
    Laptop24Regular,
    Person24Regular,
    ArrowLeft24Regular,
    ShieldKeyhole24Regular,
    Dismiss24Regular,
    Headset24Regular,
    Grid24Regular,
    Document24Regular,
    ChevronDown16Regular,
    ChevronRight16Regular,
} from "@fluentui/react-icons";

interface AccountTreeNode {
    key: string;
    label: string;
    fullPath: string;
    account?: AccountOut;
    children: AccountTreeNode[];
}

function buildAccountTree(accounts: AccountOut[]): AccountTreeNode[] {
    const root: AccountTreeNode[] = [];
    const sorted = [...accounts].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

    for (const acct of sorted) {
        const parts = acct.name
            .split("/")
            .map((s) => s.trim())
            .filter(Boolean);
        if (parts.length === 0) {
            parts.push(acct.name);
        }

        let currentList = root;
        let currentPath = "";
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            const isLeaf = i === parts.length - 1;

            let node = currentList.find((n) => n.label === part);
            if (!node) {
                node = {
                    key: isLeaf ? acct.id : `group:${currentPath}`,
                    label: part,
                    fullPath: currentPath,
                    children: [],
                };
                currentList.push(node);
            }
            if (isLeaf) {
                node.account = acct;
            }
            currentList = node.children;
        }
    }
    return root;
}

interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
    exact?: boolean;
}

const USER_CENTER_ITEMS: NavItem[] = [
    { label: "账户主页", href: "/", icon: <Home24Regular />, exact: true },
    { label: "个人资料", href: "/profile", icon: <Person24Regular /> },
    { label: "安全设置", href: "/security", icon: <ShieldKeyhole24Regular /> },
    { label: "我的工单", href: "/tickets", icon: <Headset24Regular /> },
];

const PROFILE_NAV_ITEMS: NavItem[] = [
    { label: "时间表", href: "/profiles/timelayout", icon: <Clock24Regular /> },
    { label: "课表", href: "/profiles/classplan", icon: <Board24Regular /> },
    { label: "科目", href: "/profiles/subjects", icon: <Book24Regular /> },
    { label: "策略", href: "/profiles/policy", icon: <ShieldTask24Regular /> },
    { label: "设置", href: "/profiles/settings", icon: <Settings24Regular /> },
    { label: "组件", href: "/profiles/components", icon: <Apps24Regular /> },
    { label: "凭据", href: "/profiles/credentials", icon: <Key24Regular /> },
];

const SETTINGS_NAV_ITEMS: NavItem[] = [
    { label: "账户基础信息", href: "/accounts", icon: <PersonAccounts24Regular />, exact: true },
    { label: "配对码管理", href: "/pairing", icon: <Link24Regular /> },
    { label: "预注册客户端", href: "/pre-registration", icon: <Laptop24Regular /> },
    { label: "访问控制", href: "/access", icon: <PeopleAdd24Regular /> },
    { label: "邀请管理", href: "/invitations", icon: <PeopleAdd24Regular /> },
];

export default function Sidebar({
    mobileOpen = false,
    onCloseMobile,
}: {
    mobileOpen?: boolean;
    onCloseMobile?: () => void;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const { accounts, accountId, switchAccount } = useAccount();
    const { isSuperAdmin, token } = useAuth();

    const isUserCenter = isUserCenterPath(pathname);

    const [profilesOpen, setProfilesOpen] = useState(true);
    const [settingsOpen, setSettingsOpen] = useState(() =>
        SETTINGS_NAV_ITEMS.some((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    );
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
    const [coreVersion, setCoreVersion] = useState("...");

    const accountTree = useMemo(() => buildAccountTree(accounts), [accounts]);

    function toggleGroupCollapse(fullPath: string) {
        setCollapsedGroups((prev) => ({
            ...prev,
            [fullPath]: !prev[fullPath],
        }));
    }

    function renderAccountTree(nodes: AccountTreeNode[], depth = 0): React.ReactNode {
        return nodes.map((node) => {
            const hasChildren = node.children.length > 0;
            const isCollapsed = !!collapsedGroups[node.fullPath];
            const indent = depth * 14;

            if (hasChildren && !node.account) {
                return (
                    <div key={node.key} className="sidebar-account-tree-group">
                        <button
                            type="button"
                            className="sidebar-account-group-header"
                            style={{ paddingLeft: 10 + indent }}
                            onClick={() => toggleGroupCollapse(node.fullPath)}
                        >
                            <span className="sidebar-account-group-title">{node.label}</span>
                            {isCollapsed ? <ChevronRight16Regular /> : <ChevronDown16Regular />}
                        </button>
                        {!isCollapsed && (
                            <div className="sidebar-account-group-children">
                                {renderAccountTree(node.children, depth + 1)}
                            </div>
                        )}
                    </div>
                );
            }

            return (
                <div key={node.key}>
                    {node.account && (
                        <button
                            type="button"
                            className={`sidebar-account-row ${accountId === node.account.id ? "active" : ""}`}
                            style={{ paddingLeft: 12 + indent }}
                            onClick={() => handleJumpToAccount(node.account!.id)}
                            title={node.account.name}
                        >
                            <span className="sidebar-account-row-name">{node.label}</span>
                            {hasChildren && (
                                <span
                                    className="sidebar-account-row-toggle"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleGroupCollapse(node.fullPath);
                                    }}
                                >
                                    {isCollapsed ? <ChevronRight16Regular /> : <ChevronDown16Regular />}
                                </span>
                            )}
                        </button>
                    )}
                    {hasChildren && !isCollapsed && (
                        <div className="sidebar-account-group-children">
                            {renderAccountTree(node.children, depth + 1)}
                        </div>
                    )}
                </div>
            );
        });
    }

    useEffect(() => {
        if (pathname.startsWith("/profiles")) {
            setProfilesOpen(true);
        }
        if (SETTINGS_NAV_ITEMS.some((i) => pathname === i.href || pathname.startsWith(i.href + "/"))) {
            setSettingsOpen(true);
        }
    }, [pathname]);

    useEffect(() => {
        let cancelled = false;
        system.getVersion()
            .then((res) => {
                if (!cancelled && res?.version) setCoreVersion(res.version);
            })
            .catch(() => {
                if (!cancelled) setCoreVersion("build");
            });
        return () => {
            cancelled = true;
        };
    }, []);

    function handleJumpToAccount(targetAccountId: string) {
        switchAccount(targetAccountId);
        onCloseMobile?.();
        router.push("/dashboard");
    }

    function checkItemActive(item: NavItem) {
        return item.exact
            ? pathname === item.href
            : pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
    }

    return (
        <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
            <div className="sidebar-header">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.svg" alt="MINI ClassIsland" className="sidebar-logo" />
                <div className="sidebar-title">
                    MINI ClassIsland
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

            <nav className="sidebar-nav">
                {isUserCenter ? (
                    <>
                        <div className="sidebar-section">
                            <div className="sidebar-section-label">用户中心</div>
                            {USER_CENTER_ITEMS.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`sidebar-link ${checkItemActive(item) ? "active" : ""}`}
                                >
                                    {item.icon}
                                    <span>{item.label}</span>
                                </Link>
                            ))}
                            {isSuperAdmin && (
                                <button
                                    type="button"
                                    className="sidebar-link"
                                    onClick={async () => {
                                        const adminUrl = getAdminSiteUrl();
                                        if (token) {
                                            try {
                                                const { code } = await tokenApi.exchange();
                                                window.location.assign(`${adminUrl}/auth#code=${encodeURIComponent(code)}`);
                                                return;
                                            } catch {
                                                window.location.assign(adminUrl || "/");
                                                return;
                                            }
                                        }
                                        window.location.assign(adminUrl || "/");
                                    }}
                                >
                                    <ShieldKeyhole24Regular />
                                    <span>超级管理面板</span>
                                </button>
                            )}
                        </div>

                        <div className="sidebar-section">
                            <div className="sidebar-section-label">我的账户</div>
                            {accounts.length === 0 ? (
                                <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-tertiary)" }}>
                                    暂无已关联账户
                                </div>
                            ) : (
                                <div className="sidebar-account-tree">
                                    {renderAccountTree(accountTree)}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="sidebar-section" style={{ gap: 4 }}>
                        <Link
                            href="/"
                            className="sidebar-link"
                        >
                            <ArrowLeft24Regular />
                            <span>返回用户中心</span>
                        </Link>

                        <Link
                            href="/dashboard"
                            className={`sidebar-link ${pathname === "/dashboard" ? "active" : ""}`}
                        >
                            <Grid24Regular />
                            <span>状态速览</span>
                        </Link>

                        <Link
                            href="/clients"
                            className={`sidebar-link ${pathname.startsWith("/clients") || pathname.startsWith("/audit") || pathname.startsWith("/notifications") ? "active" : ""}`}
                        >
                            <Laptop24Regular />
                            <span>客户端</span>
                        </Link>

                        <div>
                            <button
                                type="button"
                                className="sidebar-group-toggle"
                                onClick={() => setProfilesOpen((v) => !v)}
                            >
                                <span className="sidebar-group-toggle-left">
                                    <Document24Regular />
                                    <span>配置管理</span>
                                </span>
                                {profilesOpen ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
                            </button>
                            {profilesOpen && (
                                <div className="sidebar-sub-items">
                                    {PROFILE_NAV_ITEMS.map((item) => (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={`sidebar-link ${checkItemActive(item) ? "active" : ""}`}
                                        >
                                            {item.icon}
                                            <span>{item.label}</span>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <button
                                type="button"
                                className="sidebar-group-toggle"
                                onClick={() => setSettingsOpen((v) => !v)}
                            >
                                <span className="sidebar-group-toggle-left">
                                    <Settings24Regular />
                                    <span>设置</span>
                                </span>
                                {settingsOpen ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
                            </button>
                            {settingsOpen && (
                                <div className="sidebar-sub-items">
                                    {SETTINGS_NAV_ITEMS.map((item) => (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={`sidebar-link ${checkItemActive(item) ? "active" : ""}`}
                                        >
                                            {item.icon}
                                            <span>{item.label}</span>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </nav>

            <div className="sidebar-sketch-footer">
                <div className="sidebar-footer-links">
                    <a
                        href="https://github.com/miniclassisland/miniclassisland"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sidebar-footer-link"
                    >
                        GitHub
                    </a>
                    <span className="sidebar-footer-sep">·</span>
                    <CommunityJoinLink />
                </div>
                <div className="sidebar-version-bar">
                    网页版本 {WEB_VERSION} | 核心版本 {coreVersion}
                </div>
            </div>
        </aside>
    );
}
