"use client";

import React, { useState, useEffect, useCallback } from "react";
import { accounts } from "@/lib/api";
import { useAccount } from "@/lib/account-context";
import type { AccountOut, SlugUpdate } from "@/lib/types";
import { REGISTRATION_MODE_LABELS } from "@/lib/types";
import {
    Button, Input, Spinner,
    MessageBar, MessageBarBody,
} from "@fluentui/react-components";
import {
    Edit24Regular, Delete24Regular, ArrowClockwise24Regular, ArrowDownload24Regular, Copy24Regular,
} from "@fluentui/react-icons";
import { useRouter } from "next/navigation";

export default function AccountsPage() {
    const { accountId, currentAccount, refreshAccounts } = useAccount();
    const router = useRouter();
    const [accountInfo, setAccountInfo] = useState<AccountOut | null>(null);
    const [loading, setLoading] = useState(true);
    const [editingName, setEditingName] = useState(false);
    const [newName, setNewName] = useState("");
    const [editingSlug, setEditingSlug] = useState(false);
    const [newSlug, setNewSlug] = useState("");
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState("");
    const [deleting, setDeleting] = useState(false);

    const loadData = useCallback(async () => {
        if (!accountId) return;
        setLoading(true);
        try {
            const info = await accounts.info(accountId);
            setAccountInfo(info);
        } catch {
            setAccountInfo(currentAccount);
        }
        setLoading(false);
    }, [accountId, currentAccount]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    async function handleNameChange(e: React.FormEvent) {
        e.preventDefault();
        if (!accountId || !newName.trim()) return;
        setSaving(true);
        setMsg(null);
        try {
            const updated = await accounts.changeName(accountId, { name: newName.trim() });
            setAccountInfo(updated);
            setEditingName(false);
            setMsg({ type: "success", text: "账户名称已更新" });
            refreshAccounts();
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "更新失败" });
        }
        setSaving(false);
    }

    async function handleSlugChange(e: React.FormEvent) {
        e.preventDefault();
        if (!accountId || !newSlug.trim()) return;
        setSaving(true);
        setMsg(null);
        try {
            const payload: SlugUpdate = { slug: newSlug.trim() };
            const updated = await accounts.changeSlug(accountId, payload);
            setAccountInfo(updated);
            setEditingSlug(false);
            setMsg({ type: "success", text: "账户 Slug 已更新" });
            refreshAccounts();
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "更新失败" });
        }
        setSaving(false);
    }

    async function handleRegenerateApiKey() {
        if (!accountId) return;
        if (!confirm("确定要重置 API Key 吗？旧 API Key 将立即失效。")) return;
        setSaving(true);
        try {
            const updated = await accounts.regenerateApiKey(accountId);
            setAccountInfo(updated);
            setMsg({ type: "success", text: "API Key 已重新生成" });
            refreshAccounts();
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "重置失败" });
        }
        setSaving(false);
    }

    async function handleDownloadPreset() {
        if (!accountId) return;
        try {
            const preset = await accounts.downloadPreset(accountId);
            const blob = new Blob([JSON.stringify(preset, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "ManagementPreset.json";
            a.click();
            URL.revokeObjectURL(url);
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "下载失败" });
        }
    }

    async function handleDeleteAccount() {
        if (!accountInfo || deleteConfirm !== accountInfo.name) return;
        setDeleting(true);
        try {
            await accounts.delete(accountId);
            setMsg({ type: "success", text: "账户已停用" });
            refreshAccounts();
            router.push("/");
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "删除失败" });
            setDeleting(false);
        }
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">账户概览</h1>
                    <p className="page-subtitle">查看和管理当前 MINI ClassIsland 账户信息与引导凭证</p>
                </div>
                <Button appearance="primary" icon={<ArrowDownload24Regular />} onClick={handleDownloadPreset}>
                    下载 ManagementPreset.json
                </Button>
            </div>

            {msg && (
                <MessageBar intent={msg.type} style={{ marginBottom: 16 }}>
                    <MessageBarBody>{msg.text}</MessageBarBody>
                </MessageBar>
            )}

            <div className="card">
                {loading ? (
                    <div className="empty-state"><Spinner size="medium" /></div>
                ) : !accountInfo ? (
                    <div className="empty-state"><div className="empty-state-text">暂无账户数据</div></div>
                ) : (
                    <div style={{ display: "grid", gap: 20 }}>
                        <div className="detail-row">
                            <div className="detail-label">账户名称</div>
                            <div className="detail-value">
                                {editingName ? (
                                    <form onSubmit={handleNameChange} className="flex items-center gap-8">
                                        <Input
                                            value={newName}
                                            onChange={(_, d) => setNewName(d.value)}
                                            placeholder="输入账户/学校名称"
                                            size="small"
                                        />
                                        <Button appearance="primary" size="small" type="submit" disabled={saving || !newName.trim()}>
                                            保存
                                        </Button>
                                        <Button appearance="subtle" size="small" onClick={() => setEditingName(false)}>
                                            取消
                                        </Button>
                                    </form>
                                ) : (
                                    <span className="flex items-center gap-8">
                                        <strong style={{ fontSize: 15 }}>{accountInfo.name}</strong>
                                        <Button
                                            appearance="subtle"
                                            size="small"
                                            icon={<Edit24Regular />}
                                            onClick={() => {
                                                setNewName(accountInfo.name);
                                                setEditingName(true);
                                            }}
                                        >
                                            修改名称
                                        </Button>
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="detail-row">
                            <div className="detail-label">账户 ID</div>
                            <div className="detail-value" style={{ fontSize: 13 }}>{accountInfo.id}</div>
                        </div>

                        <div className="detail-row">
                            <div className="detail-label">子域名标识 (Slug)</div>
                            <div className="detail-value">
                                {editingSlug ? (
                                    <form onSubmit={handleSlugChange} className="flex items-center gap-8">
                                        <Input
                                            value={newSlug}
                                            onChange={(_, d) => setNewSlug(d.value)}
                                            placeholder="3-64 位小写字母/数字/连字符"
                                            size="small"
                                        />
                                        <Button appearance="primary" size="small" type="submit" disabled={saving || !newSlug.trim()}>
                                            保存
                                        </Button>
                                        <Button appearance="subtle" size="small" onClick={() => setEditingSlug(false)}>
                                            取消
                                        </Button>
                                    </form>
                                ) : (
                                    <span className="flex items-center gap-8">
                                        <span className="account-card-slug">{accountInfo.slug}</span>
                                        <Button
                                            appearance="subtle"
                                            size="small"
                                            icon={<Edit24Regular />}
                                            onClick={() => {
                                                setNewSlug(accountInfo.slug);
                                                setEditingSlug(true);
                                            }}
                                        >
                                            修改 Slug
                                        </Button>
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="detail-row">
                            <div className="detail-label">API Key</div>
                            <div className="detail-value flex items-center gap-8">
                                <span className="api-key-cell">{accountInfo.api_key}</span>
                                <Button
                                    appearance="subtle"
                                    size="small"
                                    icon={<Copy24Regular />}
                                    onClick={() => {
                                        navigator.clipboard.writeText(accountInfo.api_key);
                                        setMsg({ type: "success", text: "API Key 已复制到剪贴板" });
                                    }}
                                >
                                    复制
                                </Button>
                                <Button
                                    appearance="subtle"
                                    size="small"
                                    icon={<ArrowClockwise24Regular />}
                                    onClick={handleRegenerateApiKey}
                                    disabled={saving}
                                >
                                    重新生成
                                </Button>
                            </div>
                        </div>

                        <div className="detail-row">
                            <div className="detail-label">终端接入策略</div>
                            <div className="detail-value">
                                <span className="badge badge-info">
                                    {REGISTRATION_MODE_LABELS[accountInfo.registration_mode || "open"]}
                                </span>
                            </div>
                        </div>

                        <div className="detail-row">
                            <div className="detail-label">账户状态</div>
                            <div className="detail-value">
                                <span className={`badge ${accountInfo.is_active ? "badge-success" : "badge-danger"}`}>
                                    {accountInfo.is_active ? "活跃" : "停用"}
                                </span>
                            </div>
                        </div>

                        <div className="detail-row">
                            <div className="detail-label">创建时间</div>
                            <div className="detail-value" style={{ fontSize: 13 }}>
                                {new Date(accountInfo.created_at).toLocaleString("zh-CN")}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {accountInfo && (
                <div
                    className="card mt-16"
                    style={{
                        borderColor: "var(--danger-color)",
                        borderWidth: 1,
                        borderStyle: "solid",
                    }}
                >
                    <div className="card-title" style={{ color: "var(--danger-color)" }}>
                        危险操作
                    </div>
                    <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
                        停用账户后，所有成员和预注册客户端将被清理，此操作不可撤销。仅账户所有者可执行此操作。
                    </p>
                    <div style={{ display: "grid", gap: 12, maxWidth: 400 }}>
                        <label style={{ fontSize: 13, fontWeight: 500 }}>
                            请输入账户名称「{accountInfo.name}」以确认:
                        </label>
                        <Input
                            value={deleteConfirm}
                            onChange={(_, d) => setDeleteConfirm(d.value)}
                            placeholder={accountInfo.name}
                        />
                        <Button
                            appearance="primary"
                            icon={<Delete24Regular />}
                            onClick={handleDeleteAccount}
                            disabled={deleting || deleteConfirm !== accountInfo.name}
                            style={{
                                backgroundColor: deleteConfirm === accountInfo.name ? "var(--danger-color)" : undefined,
                            }}
                        >
                            {deleting ? <Spinner size="tiny" /> : "停用账户"}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
