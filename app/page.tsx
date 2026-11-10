"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAccount } from "@/lib/account-context";
import { accounts as accountsApi, invitations, userInfo } from "@/lib/api";
import { useRouter } from "next/navigation";
import {
    Button, Spinner, Input, Badge,
    Popover, PopoverTrigger, PopoverSurface,
} from "@fluentui/react-components";
import { MessageBar, MessageBarBody } from "@/components/ToastMessageBar";
import { Select } from "@/components/CustomSelect";
import {
    PersonAccounts24Regular,
    Add24Regular,
    CheckmarkCircle16Regular,
    DismissCircle16Regular,
    Search24Regular,
    PeopleAdd24Regular,
    Filter16Regular,
    ChevronLeft16Regular,
    ChevronRight16Regular,
} from "@fluentui/react-icons";
import type { AccountOut, UserOut } from "@/lib/types";
import { REGISTRATION_MODE_LABELS } from "@/lib/types";
import { matchAdvancedQuery } from "@/lib/search-engine";
import OnboardingWizard from "@/components/OnboardingWizard";

export default function UserCenterHomePage() {
    const { isAuthenticated } = useAuth();
    const { accounts, loading, switchAccount, refreshAccounts } = useAccount();
    const router = useRouter();
    const [profile, setProfile] = useState<UserOut | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    // 加入账户
    const [joinOpen, setJoinOpen] = useState(false);
    const [inviteCode, setInviteCode] = useState("");
    const [joining, setJoining] = useState(false);
    const [joinError, setJoinError] = useState<string | null>(null);

    // 创建账户
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
        if (!isAuthenticated || loading || !profile) return;
        if (profile.role_code === "pending") return;
        if (accounts.length === 0 && typeof window !== "undefined") {
            const done = localStorage.getItem("miniclassisland_onboarding_completed");
            if (!done) {
                setWizardTargetAccountId(undefined);
                setWizardOpen(true);
            }
        }
    }, [isAuthenticated, loading, accounts.length, profile]);

    const activeCount = useMemo(() => accounts.filter((a) => a.is_active).length, [accounts]);
    const inactiveCount = accounts.length - activeCount;

    const filteredAccounts = useMemo(() => {
        return accounts.filter((a) => {
            if (statusFilter === "active" && !a.is_active) return false;
            if (statusFilter === "inactive" && a.is_active) return false;
            return matchAdvancedQuery(a, searchQuery, {
                fields: {
                    status: (item) => (item.is_active ? "active" : "inactive"),
                    mode: (item) => item.registration_mode || "pairing",
                    name: (item) => item.name,
                    slug: (item) => item.slug,
                    id: (item) => item.id,
                },
                freeText: (item) => [
                    item.name,
                    item.slug,
                    item.id,
                    REGISTRATION_MODE_LABELS[item.registration_mode || "pairing"],
                ],
            });
        });
    }, [accounts, searchQuery, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const pagedAccounts = useMemo(() => {
        const start = (safePage - 1) * pageSize;
        return filteredAccounts.slice(start, start + pageSize);
    }, [filteredAccounts, safePage, pageSize]);

    function handleSelect(account: AccountOut) {
        switchAccount(account.id);
        router.push("/dashboard");
    }

    async function handleJoinByCode(e: React.FormEvent) {
        e.preventDefault();
        if (!inviteCode.trim()) return;
        setJoining(true);
        setJoinError(null);
        setMsg(null);
        try {
            const res = await invitations.accept(inviteCode.trim());
            await refreshAccounts();
            setInviteCode("");
            setJoinOpen(false);
            switchAccount(res.account_id);
            router.push("/dashboard");
        } catch (err: unknown) {
            setJoinError(err instanceof Error ? err.message : "加入账户失败");
        } finally {
            setJoining(false);
        }
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

    const isPendingUser = profile?.role_code === "pending";
    const displayName = profile?.display_name || profile?.username || "管理员";

    return (
        <div className="fade-in">
            <div className="page-header" style={{ marginBottom: 16 }}>
                <div>
                    <h1 className="page-title">欢迎回来，{displayName}</h1>
                </div>
                <div className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                    <Popover
                        withArrow
                        positioning="below-end"
                        open={joinOpen}
                        onOpenChange={(_, d) => {
                            setJoinOpen(d.open);
                            if (!d.open) setJoinError(null);
                        }}
                    >
                        <PopoverTrigger disableButtonEnhancement>
                            <Button
                                appearance="secondary"
                                icon={<PeopleAdd24Regular />}
                            >
                                加入账户
                            </Button>
                        </PopoverTrigger>
                        <PopoverSurface style={{ width: 320, padding: 18 }}>
                            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4, color: "var(--text-primary)" }}>
                                使用邀请码加入账户
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
                                输入管理员分发的邀请码以加入对应集控账户中心
                            </div>
                            {joinError && (
                                <MessageBar intent="error" style={{ marginBottom: 10 }}>
                                    <MessageBarBody>{joinError}</MessageBarBody>
                                </MessageBar>
                            )}
                            <form onSubmit={(e) => { void handleJoinByCode(e); }}>
                                <div className="form-group" style={{ marginBottom: 14 }}>
                                    <label className="form-label">邀请码 *</label>
                                    <Input
                                        value={inviteCode}
                                        onChange={(_, d) => setInviteCode(d.value)}
                                        placeholder="输入账户邀请码"
                                        style={{ width: "100%" }}
                                        autoFocus
                                    />
                                </div>
                                <div className="flex gap-8" style={{ justifyContent: "flex-end" }}>
                                    <Button
                                        size="small"
                                        appearance="primary"
                                        type="submit"
                                        disabled={joining || !inviteCode.trim()}
                                    >
                                        {joining ? <Spinner size="tiny" /> : "立即加入"}
                                    </Button>
                                </div>
                            </form>
                        </PopoverSurface>
                    </Popover>

                    {!isPendingUser && (
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
                                            placeholder="输入组织或学校名称"
                                            style={{ width: "100%" }}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 14 }}>
                                        <label className="form-label">子域名标识（可选）</label>
                                        <Input
                                            value={newAccountSlug}
                                            onChange={(_, d) => setNewAccountSlug(d.value)}
                                            placeholder="留空自动生成随机标识"
                                            style={{ width: "100%" }}
                                        />
                                        <div className="form-hint">3-64 位小写字母、数字、连字符或下划线</div>
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
                    )}
                </div>
            </div>

            {isPendingUser && (
                <MessageBar intent="warning" style={{ marginBottom: 16 }}>
                    <MessageBarBody>
                        您的账号当前处于待审核状态，仅支持获取交流群入群码或通过邀请码加入组织。
                    </MessageBarBody>
                </MessageBar>
            )}

            {msg && (
                <MessageBar intent={msg.type} style={{ marginBottom: 16 }}>
                    <MessageBarBody>{msg.text}</MessageBarBody>
                </MessageBar>
            )}

            <div className="clients-main-pane">
                {/* 筛选栏与统计摘要 */}
                <div className="card" style={{ padding: "12px 16px", marginBottom: 0 }}>
                    <div className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                        <Input
                            placeholder="搜索账户名称、子域标识或高级过滤表达式"
                            value={searchQuery}
                            onChange={(_, d) => {
                                setSearchQuery(d.value);
                                setCurrentPage(1);
                            }}
                            contentBefore={<Search24Regular />}
                            style={{ flex: 1, minWidth: 240, fontFamily: "var(--font-mono)" }}
                        />

                        <Popover withArrow positioning="below-end">
                            <PopoverTrigger disableButtonEnhancement>
                                <Button appearance="outline" icon={<Filter16Regular />}>
                                    筛选
                                </Button>
                            </PopoverTrigger>
                            <PopoverSurface style={{ padding: 12, width: 280 }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600 }}>状态快速过滤</div>
                                    <Select
                                        size="small"
                                        value={statusFilter}
                                        onChange={(_, d) => {
                                            setStatusFilter(d.value as typeof statusFilter);
                                            setCurrentPage(1);
                                        }}
                                    >
                                        <option value="all">全部账户 {accounts.length}</option>
                                        <option value="active">活跃 {activeCount}</option>
                                        <option value="inactive">已停用 {inactiveCount}</option>
                                    </Select>
                                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>快捷表达式</div>
                                    <div className="flex gap-4" style={{ flexWrap: "wrap" }}>
                                        {[
                                            "status:active",
                                            "status:inactive",
                                            "mode:pairing",
                                            "mode:open",
                                            "mode:pre_reg",
                                        ].map((expr) => (
                                            <Button
                                                key={expr}
                                                size="small"
                                                appearance="secondary"
                                                onClick={() => {
                                                    setSearchQuery((prev) => `${prev} ${expr}`.trim());
                                                    setCurrentPage(1);
                                                }}
                                            >
                                                {expr}
                                            </Button>
                                        ))}
                                        <Button
                                            size="small"
                                            appearance="subtle"
                                            onClick={() => {
                                                setSearchQuery("");
                                                setStatusFilter("all");
                                                setCurrentPage(1);
                                            }}
                                        >
                                            重置
                                        </Button>
                                    </div>
                                </div>
                            </PopoverSurface>
                        </Popover>
                    </div>

                    <div
                        style={{
                            marginTop: 8,
                            fontSize: 12.5,
                            color: "var(--text-secondary)",
                            display: "flex",
                            gap: 14,
                        }}
                    >
                        <span>{accounts.length}个账户</span>
                        <span>{filteredAccounts.length}已筛选</span>
                    </div>
                </div>

                {/* 账户数据表 */}
                <div className="card" style={{ marginBottom: 0, padding: 0, overflow: "hidden" }}>
                    {loading ? (
                        <div className="empty-state">
                            <Spinner size="medium" />
                        </div>
                    ) : accounts.length === 0 ? (
                        <div className="accounts-list-empty">
                            <PersonAccounts24Regular style={{ fontSize: 48, color: "var(--text-tertiary)" }} />
                            <p className="accounts-list-empty-text">暂无可用账户</p>
                            <p className="accounts-list-empty-hint">
                                {isPendingUser
                                    ? "您的账号正在等待管理员批准，目前可使用邀请码加入现有组织。"
                                    : "您还没有加入任何集控账户，可以创建新账户或使用邀请码加入现有账户。"}
                            </p>
                            <div className="flex gap-8" style={{ flexWrap: "wrap", justifyContent: "center" }}>
                                <Button
                                    appearance="secondary"
                                    icon={<PeopleAdd24Regular />}
                                    onClick={() => setJoinOpen(true)}
                                >
                                    加入账户
                                </Button>
                                {!isPendingUser && (
                                    <Button
                                        appearance="primary"
                                        icon={<Add24Regular />}
                                        onClick={() => setCreateOpen(true)}
                                    >
                                        创建新账户
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : pagedAccounts.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-text">暂无符合筛选条件的账户</div>
                        </div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>名称</th>
                                    <th>子域名标识</th>
                                    <th>账户 ID</th>
                                    <th>终端接入策略</th>
                                    <th>状态</th>
                                    <th style={{ width: 44 }} aria-label="进入" />
                                </tr>
                            </thead>
                            <tbody>
                                {pagedAccounts.map((account) => (
                                    <tr
                                        key={account.id}
                                        style={{ cursor: "pointer" }}
                                        onClick={() => handleSelect(account)}
                                    >
                                        <td>
                                            <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                                                {account.name}
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
                                                {REGISTRATION_MODE_LABELS[account.registration_mode || "pairing"]}
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
                                        <td style={{ textAlign: "right", color: "var(--text-tertiary)" }}>
                                            <ChevronRight16Regular style={{ verticalAlign: "middle" }} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* 底部分页栏 */}
                <div className="clients-pagination-bar">
                    <div className="flex items-center gap-8">
                        <Button
                            size="small"
                            appearance="subtle"
                            icon={<ChevronLeft16Regular />}
                            disabled={safePage <= 1}
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        />
                        <span className="mono-code" style={{ fontWeight: 600 }}>
                            {safePage} / {totalPages}
                        </span>
                        <Button
                            size="small"
                            appearance="subtle"
                            icon={<ChevronRight16Regular />}
                            disabled={safePage >= totalPages}
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        />
                        <span style={{ marginLeft: 6 }}>
                            {loading ? "正在加载" : "加载完毕"}
                        </span>
                    </div>

                    <div className="flex items-center gap-6">
                        <span>每页</span>
                        <Select
                            size="small"
                            value={String(pageSize)}
                            onChange={(_, d) => {
                                setPageSize(Number(d.value) || 20);
                                setCurrentPage(1);
                            }}
                            style={{ width: 72 }}
                        >
                            <option value="10">10</option>
                            <option value="20">20</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </Select>
                        <span>条</span>
                    </div>
                </div>
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
