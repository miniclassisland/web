"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAccount } from "@/lib/account-context";
import { invitations } from "@/lib/api";
import { useRouter } from "next/navigation";
import {
    Button, Spinner, Input,
    Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions,
    MessageBar, MessageBarBody,
} from "@fluentui/react-components";
import {
    PersonAccounts24Regular,
    Add24Regular,
    ArrowRight16Regular,
    CheckmarkCircle16Regular,
    DismissCircle16Regular,
    PeopleAdd24Regular,
} from "@fluentui/react-icons";
import type { AccountOut } from "@/lib/types";

function AccountCard({ account, onSelect }: { account: AccountOut; onSelect: () => void }) {
    return (
        <button className="account-card" onClick={onSelect} type="button">
            <div className="account-card-icon">
                <PersonAccounts24Regular />
            </div>
            <div className="account-card-info">
                <div className="account-card-name">{account.name}</div>
                <div className="account-card-meta">
                    <span className="account-card-slug">{account.slug}</span>
                    <span
                        className={`badge ${account.is_active ? "badge-success" : "badge-danger"}`}
                        style={{ fontSize: 11, padding: "1px 6px" }}
                    >
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
                </div>
                <div className="account-card-id">ID: {account.id}</div>
            </div>
            <div className="account-card-arrow">
                <ArrowRight16Regular />
            </div>
        </button>
    );
}

export default function AccountListPage() {
    const { isAuthenticated, logout } = useAuth();
    const { accounts, loading, switchAccount, refreshAccounts } = useAccount();
    const router = useRouter();
    const [joinOpen, setJoinOpen] = useState(false);
    const [inviteCode, setInviteCode] = useState("");
    const [joining, setJoining] = useState(false);
    const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

    function handleSelect(account: AccountOut) {
        switchAccount(account.id);
        router.push("/dashboard");
    }

    async function handleJoinByCode() {
        if (!inviteCode.trim()) return;
        setJoining(true);
        setMsg(null);
        try {
            const res = await invitations.accept(inviteCode.trim());
            await refreshAccounts();
            setJoinOpen(false);
            setInviteCode("");
            switchAccount(res.account_id);
            router.push("/dashboard");
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "加入账户失败" });
        }
        setJoining(false);
    }

    if (!isAuthenticated) return null;

    return (
        <div className="login-container fade-in">
            <div className="login-card" style={{ padding: "32px 24px", width: 460 }}>
                <div className="login-title">选择 MINI ClassIsland 账户</div>
                <div className="login-subtitle">选择一个账户以进入集控管理面板</div>

                {msg && (
                    <MessageBar intent={msg.type} style={{ marginBottom: 16 }}>
                        <MessageBarBody>{msg.text}</MessageBarBody>
                    </MessageBar>
                )}

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
                            您还没有加入任何账户，可以创建新账户或使用邀请码加入现有账户。
                        </p>
                        <div className="flex gap-8">
                            <Button
                                appearance="primary"
                                icon={<Add24Regular />}
                                onClick={() => router.push("/accounts/new")}
                            >
                                创建账户
                            </Button>
                            <Button
                                appearance="secondary"
                                icon={<PeopleAdd24Regular />}
                                onClick={() => setJoinOpen(true)}
                            >
                                输入邀请码
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="accounts-list-grid">
                            {accounts.map((account) => (
                                <AccountCard
                                    key={account.id}
                                    account={account}
                                    onSelect={() => handleSelect(account)}
                                />
                            ))}
                        </div>
                        <div className="flex justify-center gap-8 mt-16">
                            <Button
                                size="small"
                                appearance="secondary"
                                icon={<Add24Regular />}
                                onClick={() => router.push("/accounts/new")}
                            >
                                创建新账户
                            </Button>
                            <Button
                                size="small"
                                appearance="secondary"
                                icon={<PeopleAdd24Regular />}
                                onClick={() => setJoinOpen(true)}
                            >
                                使用邀请码加入
                            </Button>
                        </div>
                    </>
                )}

                <div style={{ marginTop: 24, textAlign: "center" }}>
                    <Button appearance="subtle" onClick={() => logout()}>
                        退出登录
                    </Button>
                </div>

                <div
                    style={{
                        marginTop: 32,
                        paddingTop: 16,
                        borderTop: "1px solid var(--border-color)",
                        textAlign: "center",
                        fontSize: 11,
                        color: "var(--text-secondary)",
                        lineHeight: 1.6,
                    }}
                >
                    <div>本项目与 ClassIsland 官方无关，ClassIsland 是由 ClassIsland 社区开发和维护的开源软件</div>
                    <div>本项目由 MINIOpenSource 开发和维护，并开源在 GitHub</div>
                </div>
            </div>

            <Dialog open={joinOpen} onOpenChange={(_, d) => setJoinOpen(d.open)}>
                <DialogSurface>
                    <DialogBody>
                        <DialogTitle>使用邀请码加入账户</DialogTitle>
                        <DialogContent>
                            <div className="form-group" style={{ paddingTop: 8 }}>
                                <label className="form-label">邀请码</label>
                                <Input
                                    value={inviteCode}
                                    onChange={(_, d) => setInviteCode(d.value)}
                                    placeholder="请输入邀请码..."
                                    style={{ width: "100%" }}
                                />
                            </div>
                        </DialogContent>
                        <DialogActions>
                            <Button appearance="secondary" onClick={() => setJoinOpen(false)}>取消</Button>
                            <Button appearance="primary" onClick={handleJoinByCode} disabled={joining || !inviteCode.trim()}>
                                {joining ? <Spinner size="tiny" /> : "加入账户"}
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </div>
    );
}
