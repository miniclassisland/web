"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAccount } from "@/lib/account-context";
import { accounts as accountsApi, userInfo } from "@/lib/api";
import { useRouter } from "next/navigation";
import {
    Button, Spinner, Input, Badge,
    Popover, PopoverTrigger, PopoverSurface,
    MessageBar, MessageBarBody,
} from "@fluentui/react-components";
import {
    PersonAccounts24Regular,
    Add24Regular,
    ArrowRight16Regular,
    CheckmarkCircle16Regular,
    DismissCircle16Regular,
    Search24Regular,
    ShieldTask24Regular,
    Person24Regular,
    Settings24Regular,
    ArrowUpload24Regular,
} from "@fluentui/react-icons";
import type { AccountOut, UserOut } from "@/lib/types";
import { REGISTRATION_MODE_LABELS, ROLE_LABELS } from "@/lib/types";
import OnboardingWizard from "@/components/OnboardingWizard";

export default function UserCenterHomePage() {
    const { isAuthenticated, isSuperAdmin } = useAuth();
    const { accounts, loading, switchAccount, refreshAccounts } = useAccount();
    const router = useRouter();
    const [profile, setProfile] = useState<UserOut | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [createOpen, setCreateOpen] = useState(false);
    const [newAccountName, setNewAccountName] = useState("");
    const [newAccountSlug, setNewAccountSlug] = useState("");
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [wizardOpen, setWizardOpen] = useState(false);
    const [wizardTargetAccountId, setWizardTargetAccountId] = useState<string | undefined>(undefined);
    const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        if (!isAuthenticated) return;
        userInfo.get().then(setProfile).catch(() => {});
    }, [isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated || loading) return;
        if (accounts.length === 0 && typeof window !== "undefined") {
            const done = localStorage.getItem("miniclassisland_onboarding_completed");
            if (!done) {
                setWizardTargetAccountId(undefined);
                setWizardOpen(true);
            }
        }
    }, [isAuthenticated, loading, accounts.length]);

    const filteredAccounts = useMemo(() => {
        if (!searchQuery.trim()) return accounts;
        const q = searchQuery.trim().toLowerCase();
        return accounts.filter(
            (a) =>
                a.name.toLowerCase().includes(q) ||
                a.slug.toLowerCase().includes(q) ||
                a.id.toLowerCase().includes(q)
        );
    }, [accounts, searchQuery]);

    function handleSelect(account: AccountOut) {
        switchAccount(account.id);
        router.push("/dashboard");
    }

    function handleOpenAccountSettings(account: AccountOut) {
        switchAccount(account.id);
        router.push("/accounts");
    }

    function handleImportLocalConfig(account: AccountOut) {
        switchAccount(account.id);
        setWizardTargetAccountId(account.id);
        setWizardOpen(true);
    }

    async function handleCreateAccount() {
        if (!newAccountName.trim()) return;
        setCreating(true);
        setCreateError(null);
        setMsg(null);
        try {
            const created = await accountsApi.apply({
                name: newAccountName.trim(),
                slug: newAccountSlug.trim() || undefined,
            });
            await refreshAccounts();
            switchAccount(created.id);
            setCreateOpen(false);
            setNewAccountName("");
            setNewAccountSlug("");
            router.push("/dashboard");
        } catch (err: unknown) {
            setCreateError(err instanceof Error ? err.message : "创建账户失败");
        } finally {
            setCreating(false);
        }
    }

    if (!isAuthenticated) return null;

    const displayName = profile?.display_name || profile?.username || "管理员";
    const roleLabel = profile?.role_code
        ? (ROLE_LABELS[profile.role_code] || profile.role_code)
        : (isSuperAdmin ? "超级管理员" : "普通用户");

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">欢迎回来，{displayName}</h1>
                    <p className="page-subtitle">
                        用户中心主页 · 从左侧导航栏或下方列表选择任一账户，即可进入对应的集控账户中心
                    </p>
                </div>
                <div className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                    <Popover
                        withArrow
                        positioning="below-end"
                        open={createOpen}
                        onOpenChange={(_, d) => {
                            setCreateOpen(d.open);
                            if (!d.open) setCreateError(null);
                        }}
                    >
                        <PopoverTrigger disableButtonEnhancement>
                            <Button
                                appearance="primary"
                                icon={<Add24Regular />}
                            >
                                创建新账户
                            </Button>
                        </PopoverTrigger>
                        <PopoverSurface style={{ width: 340, padding: 18 }}>
                            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4, color: "var(--text-primary)" }}>
                                创建新集控账户
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
                                创建一个新的学校或组织集控账户中心
                            </div>
                            {createError && (
                                <MessageBar intent="error" style={{ marginBottom: 10 }}>
                                    <MessageBarBody>{createError}</MessageBarBody>
                                </MessageBar>
                            )}
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    void handleCreateAccount();
                                }}
                            >
                                <div className="form-group" style={{ marginBottom: 10 }}>
                                    <label className="form-label">账户 / 组织名称 *</label>
                                    <Input
                                        value={newAccountName}
                                        onChange={(_, d) => setNewAccountName(d.value)}
                                        placeholder="例如：第一中学电教中心"
                                        style={{ width: "100%" }}
                                        autoFocus
                                    />
                                </div>
                                <div className="form-group" style={{ marginBottom: 14 }}>
                                    <label className="form-label">子域名标识 Slug（可选）</label>
                                    <Input
                                        value={newAccountSlug}
                                        onChange={(_, d) => setNewAccountSlug(d.value)}
                                        placeholder="例如：no1-school (留空自动生成)"
                                        style={{ width: "100%" }}
                                    />
                                    <div className="form-hint">3-64 位小写字母、数字或连字符</div>
                                </div>
                                <div className="flex gap-8" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
                                    <Button
                                        size="small"
                                        appearance="primary"
                                        type="submit"
                                        disabled={creating || !newAccountName.trim()}
                                    >
                                        {creating ? <Spinner size="tiny" /> : "立即创建"}
                                    </Button>
                                </div>
                            </form>
                        </PopoverSurface>
                    </Popover>
                </div>
            </div>

            {msg && (
                <MessageBar intent={msg.type} style={{ marginBottom: 16 }}>
                    <MessageBarBody>{msg.text}</MessageBarBody>
                </MessageBar>
            )}

            {/* 用户概览统计栏 */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-card-header">
                        <span className="stat-card-label">可访问账户中心</span>
                        <span className="stat-card-icon"><PersonAccounts24Regular /></span>
                    </div>
                    <div className="stat-card-value">{accounts.length}</div>
                    <div className="stat-card-footer">可在左侧菜单直接点击切换进入</div>
                </div>

                <div className="stat-card">
                    <div className="stat-card-header">
                        <span className="stat-card-label">当前登录账号</span>
                        <span className="stat-card-icon"><Person24Regular /></span>
                    </div>
                    <div className="stat-card-value" style={{ fontSize: 18 }}>
                        {profile?.email || profile?.username || displayName}
                    </div>
                    <div className="stat-card-footer">系统角色：{roleLabel}</div>
                </div>

                <div className="stat-card">
                    <div className="stat-card-header">
                        <span className="stat-card-label">两步验证 (2FA)</span>
                        <span className="stat-card-icon"><ShieldTask24Regular /></span>
                    </div>
                    <div className="stat-card-value" style={{ fontSize: 18 }}>
                        <span className={`badge ${profile?.totp_enabled ? "badge-success" : "badge-warning"}`}>
                            {profile?.totp_enabled ? "已开启 TOTP 保护" : "未开启两步验证"}
                        </span>
                    </div>
                    <div className="stat-card-footer">
                        <a
                            href="/security"
                            style={{ color: "var(--accent-color)", textDecoration: "none", fontWeight: 500 }}
                        >
                            前往个人资料与安全设置 →
                        </a>
                    </div>
                </div>
            </div>

            {/* 账户中心列表卡片 (Cloudflare 风格表格视图) */}
            <div className="card">
                <div className="card-title">
                    <span>您的集控账户中心 ({filteredAccounts.length})</span>
                    <div className="flex items-center gap-8">
                        <Input
                            size="small"
                            placeholder="搜索账户名称、Slug 或账户 ID..."
                            value={searchQuery}
                            onChange={(_, d) => setSearchQuery(d.value)}
                            contentBefore={<Search24Regular />}
                            style={{ width: 280 }}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="accounts-list-loading">
                        <Spinner size="large" />
                        <p>正在加载账户列表…</p>
                    </div>
                ) : accounts.length === 0 ? (
                    <div className="accounts-list-empty">
                        <PersonAccounts24Regular style={{ fontSize: 48, color: "var(--text-tertiary)" }} />
                        <p className="accounts-list-empty-text">暂无可用账户</p>
                        <p className="accounts-list-empty-hint">
                            您还没有加入任何集控账户，可以创建新账户或使用邀请码加入现有账户。
                        </p>
                        <div className="flex gap-8" style={{ flexWrap: "wrap", justifyContent: "center" }}>
                            <Button
                                appearance="primary"
                                icon={<Add24Regular />}
                                onClick={() => setCreateOpen(true)}
                            >
                                创建新账户
                            </Button>
                            <Button
                                appearance="secondary"
                                onClick={() => router.push("/security")}
                            >
                                前往安全设置使用邀请码
                            </Button>
                        </div>
                    </div>
                ) : filteredAccounts.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-text">未找到匹配的账户</div>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>账户名称</th>
                                    <th>子域名标识 (Slug)</th>
                                    <th>账户 ID</th>
                                    <th>终端接入策略</th>
                                    <th>状态</th>
                                    <th style={{ textAlign: "right" }}>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAccounts.map((account) => (
                                    <tr
                                        key={account.id}
                                        style={{ cursor: "pointer" }}
                                        onClick={() => handleSelect(account)}
                                    >
                                        <td>
                                            <div className="flex items-center gap-8">
                                                <div className="account-card-icon" style={{ width: 32, height: 32, fontSize: 16 }}>
                                                    <PersonAccounts24Regular />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                                                        {account.name}
                                                    </div>
                                                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                                        创建于 {new Date(account.created_at).toLocaleDateString("zh-CN")}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="account-card-slug">{account.slug}</span>
                                        </td>
                                        <td>
                                            <span className="api-key-cell" style={{ fontSize: 12 }}>{account.id}</span>
                                        </td>
                                        <td>
                                            <Badge appearance="outline" color="informative">
                                                {REGISTRATION_MODE_LABELS[account.registration_mode || "open"]}
                                            </Badge>
                                        </td>
                                        <td>
                                            <span className={`badge ${account.is_active ? "badge-success" : "badge-danger"}`}>
                                                {account.is_active ? (
                                                    <>
                                                        <CheckmarkCircle16Regular style={{ fontSize: 12, marginRight: 2 }} /> 活跃
                                                    </>
                                                ) : (
                                                    <>
                                                        <DismissCircle16Regular style={{ fontSize: 12, marginRight: 2 }} /> 停用
                                                    </>
                                                )}
                                            </span>
                                        </td>
                                        <td
                                            style={{ textAlign: "right" }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div className="flex items-center justify-between gap-8" style={{ justifyContent: "flex-end" }}>
                                                <Button
                                                    size="small"
                                                    appearance="subtle"
                                                    icon={<ArrowUpload24Regular />}
                                                    onClick={() => handleImportLocalConfig(account)}
                                                >
                                                    导入本地配置
                                                </Button>
                                                <Button
                                                    size="small"
                                                    appearance="subtle"
                                                    icon={<Settings24Regular />}
                                                    onClick={() => handleOpenAccountSettings(account)}
                                                >
                                                    基础信息
                                                </Button>
                                                <Button
                                                    size="small"
                                                    appearance="primary"
                                                    icon={<ArrowRight16Regular />}
                                                    iconPosition="after"
                                                    onClick={() => handleSelect(account)}
                                                >
                                                    进入账户中心
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div
                style={{
                    marginTop: 24,
                    paddingTop: 16,
                    borderTop: "1px solid var(--border-color)",
                    textAlign: "center",
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    lineHeight: 1.6,
                }}
            >
                <div>本项目与 ClassIsland 官方无关，ClassIsland 是由 ClassIsland 社区开发和维护的开源软件</div>
                <div>本项目由 MINIOpenSource 开发和维护，并开源在 GitHub</div>
            </div>

            <OnboardingWizard
                open={wizardOpen}
                onClose={() => setWizardOpen(false)}
                initialStep={wizardTargetAccountId ? 2 : accounts.length === 0 ? 1 : 2}
                targetAccountId={wizardTargetAccountId}
                mode={wizardTargetAccountId ? "import" : "onboarding"}
            />
        </div>
    );
}
