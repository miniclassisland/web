"use client";

import React, { useState, useEffect, useCallback } from "react";
import { invitations } from "@/lib/api";
import { useAccount } from "@/lib/account-context";
import type { InvitationOut, InvitationCreate } from "@/lib/types";
import { ACCOUNT_ROLE_LABELS } from "@/lib/types";
import {
    Button, Spinner, Input, Select,
    MessageBar, MessageBarBody,
    Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions,
} from "@fluentui/react-components";
import { Add24Regular, Dismiss24Regular, Copy24Regular, PeopleAdd24Regular } from "@fluentui/react-icons";

export default function InvitationsPage() {
    const { accountId, refreshAccounts } = useAccount();
    const [list, setList] = useState<InvitationOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [acceptOpen, setAcceptOpen] = useState(false);
    const [acceptCode, setAcceptCode] = useState("");
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState<InvitationCreate>({ role_in_account: "member", max_uses: 1 });

    const loadData = useCallback(async () => {
        if (!accountId) return;
        setLoading(true);
        try {
            setList(await invitations.list(accountId));
        } catch {
            setList([]);
        }
        setLoading(false);
    }, [accountId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    async function handleCreate() {
        setCreating(true);
        try {
            await invitations.create(accountId, form);
            setMsg({ type: "success", text: "邀请码已创建" });
            setDialogOpen(false);
            setForm({ role_in_account: "member", max_uses: 1 });
            loadData();
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "创建失败" });
        }
        setCreating(false);
    }

    async function handleAccept() {
        if (!acceptCode.trim()) return;
        setCreating(true);
        try {
            await invitations.accept(acceptCode.trim());
            setMsg({ type: "success", text: "已成功接受邀请加入账户！" });
            setAcceptOpen(false);
            setAcceptCode("");
            refreshAccounts();
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "接受邀请失败" });
        }
        setCreating(false);
    }

    async function handleRevoke(id: string) {
        if (!confirm("确定要撤销此邀请码吗？撤销后无法恢复。")) return;
        try {
            await invitations.delete(accountId, id);
            setMsg({ type: "success", text: "邀请已撤销" });
            loadData();
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "撤销失败" });
        }
    }

    function copyCode(code: string) {
        navigator.clipboard.writeText(code);
        setMsg({ type: "success", text: "邀请码已复制到剪贴板" });
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">邀请管理</h1>
                    <p className="page-subtitle">创建、分发账户协作邀请码，或输入邀请码加入其他账户</p>
                </div>
                <div className="flex gap-8">
                    <Button appearance="secondary" icon={<PeopleAdd24Regular />} onClick={() => setAcceptOpen(true)}>
                        使用邀请码加入账户
                    </Button>
                    <Button appearance="primary" icon={<Add24Regular />} onClick={() => setDialogOpen(true)}>
                        创建邀请码
                    </Button>
                </div>
            </div>

            {msg && (
                <MessageBar intent={msg.type} style={{ marginBottom: 16 }}>
                    <MessageBarBody>{msg.text}</MessageBarBody>
                </MessageBar>
            )}

            <div className="card">
                {loading ? (
                    <div className="empty-state"><Spinner size="medium" /></div>
                ) : list.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-text">暂无邀请记录</div>
                        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 8 }}>
                            点击「创建邀请码」生成协作邀请码
                        </p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>邀请码</th>
                                <th>授予角色</th>
                                <th>已用 / 上限</th>
                                <th>状态</th>
                                <th>创建时间</th>
                                <th>过期时间</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {list.map((item) => (
                                <tr key={item.id}>
                                    <td>
                                        <span className="flex items-center gap-4">
                                            <span className="api-key-cell" style={{ userSelect: "all" }}>{item.code}</span>
                                            <Button
                                                appearance="subtle"
                                                size="small"
                                                icon={<Copy24Regular />}
                                                onClick={() => copyCode(item.code)}
                                                title="复制"
                                            />
                                        </span>
                                    </td>
                                    <td>
                                        <span className="badge badge-info">
                                            {ACCOUNT_ROLE_LABELS[item.role_in_account] || item.role_in_account}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: 12 }}>
                                        {item.used_count} / {item.max_uses}
                                    </td>
                                    <td>
                                        <span className={`badge ${item.is_active ? "badge-success" : "badge-danger"}`}>
                                            {item.is_active ? "活跃" : "已撤销"}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: 12 }}>{new Date(item.created_at).toLocaleString("zh-CN")}</td>
                                    <td style={{ fontSize: 12 }}>
                                        {item.expires_at ? new Date(item.expires_at).toLocaleString("zh-CN") : "永不过期"}
                                    </td>
                                    <td>
                                        {item.is_active && (
                                            <Button
                                                appearance="subtle"
                                                size="small"
                                                icon={<Dismiss24Regular />}
                                                onClick={() => handleRevoke(item.id)}
                                                style={{ color: "var(--danger-color)" }}
                                            >
                                                撤销
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* 创建邀请对话框 */}
            <Dialog open={dialogOpen} onOpenChange={(_, d) => setDialogOpen(d.open)}>
                <DialogSurface>
                    <DialogBody>
                        <DialogTitle>创建邀请码</DialogTitle>
                        <DialogContent>
                            <div style={{ display: "grid", gap: 16, paddingTop: 8 }}>
                                <div>
                                    <label className="form-label">授予角色</label>
                                    <Select
                                        value={form.role_in_account}
                                        onChange={(_, d) => setForm((f) => ({ ...f, role_in_account: d.value }))}
                                        style={{ width: "100%" }}
                                    >
                                        {Object.entries(ACCOUNT_ROLE_LABELS)
                                            .filter(([k]) => k !== "owner")
                                            .map(([k, v]) => (
                                                <option key={k} value={k}>{v}</option>
                                            ))}
                                    </Select>
                                </div>
                                <div>
                                    <label className="form-label">最大使用次数</label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={100}
                                        value={String(form.max_uses ?? 1)}
                                        onChange={(_, d) => setForm((f) => ({ ...f, max_uses: parseInt(d.value, 10) || 1 }))}
                                        style={{ width: "100%" }}
                                    />
                                </div>
                            </div>
                        </DialogContent>
                        <DialogActions>
                            <Button appearance="secondary" onClick={() => setDialogOpen(false)}>取消</Button>
                            <Button appearance="primary" onClick={handleCreate} disabled={creating}>
                                {creating ? <Spinner size="tiny" /> : "创建"}
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>

            {/* 使用邀请码加入账户对话框 */}
            <Dialog open={acceptOpen} onOpenChange={(_, d) => setAcceptOpen(d.open)}>
                <DialogSurface>
                    <DialogBody>
                        <DialogTitle>使用邀请码加入账户</DialogTitle>
                        <DialogContent>
                            <div className="form-group" style={{ paddingTop: 8 }}>
                                <label className="form-label">邀请码</label>
                                <Input
                                    value={acceptCode}
                                    onChange={(_, d) => setAcceptCode(d.value)}
                                    placeholder="粘贴管理员提供的邀请码..."
                                    style={{ width: "100%" }}
                                />
                            </div>
                        </DialogContent>
                        <DialogActions>
                            <Button appearance="secondary" onClick={() => setAcceptOpen(false)}>取消</Button>
                            <Button appearance="primary" onClick={handleAccept} disabled={creating || !acceptCode.trim()}>
                                {creating ? <Spinner size="tiny" /> : "确认加入"}
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </div>
    );
}
