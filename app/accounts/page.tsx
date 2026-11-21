"use client";

import React, { useState, useEffect, useCallback } from "react";
import { accounts, approvalRequests } from "@/lib/api";
import { useAccount } from "@/lib/account-context";
import type {
    AccountOut,
    SlugUpdate,
    QuotaOut,
    RegistrationMode,
    ApprovalRequestItem,
    ApprovalRequestType,
    ApprovalRequestStatus,
} from "@/lib/types";
import {
    REGISTRATION_MODE_LABELS,
    QUOTA_META,
    APPROVAL_REQUEST_TYPE_LABELS,
    APPROVAL_REQUEST_STATUS_LABELS,
} from "@/lib/types";
import {
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    Input,
    Spinner,
    Switch,
    Textarea,
} from "@fluentui/react-components";
import { MessageBar, MessageBarBody } from "@/components/ToastMessageBar";
import { Select } from "@/components/CustomSelect";
import { ConfirmPopover } from "@/components/ConfirmPopover";
import {
    Edit24Regular,
    Delete24Regular,
    ArrowClockwise24Regular,
    Copy24Regular,
    ArrowUpload24Regular,
    Add24Regular,
    ShieldTask24Regular,
    Send24Regular,
} from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import DownloadPresetPopoverButton from "@/components/DownloadPresetPopoverButton";
import OnboardingWizard from "@/components/OnboardingWizard";

const QUOTA_KEYS = Object.entries(QUOTA_META)
    .filter(([, meta]) => meta.type === "number")
    .map(([key]) => key);

const PERMISSION_KEYS = Object.entries(QUOTA_META)
    .filter(([, meta]) => meta.type === "boolean")
    .map(([key]) => key);

function formatQuotaVal(key: string, val: number): string {
    const meta = QUOTA_META[key];
    if (meta?.type === "boolean") {
        return val >= 1 ? "已启用" : "已禁用";
    }
    return val < 0 ? "不限制" : String(val);
}

function statusBadgeClass(status: ApprovalRequestStatus): string {
    if (status === "approved") return "badge-success";
    if (status === "rejected") return "badge-danger";
    if (status === "pending") return "badge-warning";
    return "badge-info";
}

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
    const [quotas, setQuotas] = useState<QuotaOut[]>([]);
    const [wizardOpen, setWizardOpen] = useState(false);

    // 专用配额/权限审批申请通道
    const [approvalList, setApprovalList] = useState<ApprovalRequestItem[]>([]);
    const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
    const [approvalType, setApprovalType] = useState<ApprovalRequestType>("quota");
    const [approvalTargetKey, setApprovalTargetKey] = useState<string>("max_clients");
    const [approvalRequestedValue, setApprovalRequestedValue] = useState<string>("");
    const [approvalUnlimited, setApprovalUnlimited] = useState(false);
    const [approvalReason, setApprovalReason] = useState("");
    const [approvalSubmitting, setApprovalSubmitting] = useState(false);
    const [cancellingId, setCancellingId] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        if (!accountId) return;
        setLoading(true);
        try {
            const [info, qList, reqRes] = await Promise.all([
                accounts.info(accountId),
                accounts.getQuotas(accountId).catch(() => []),
                approvalRequests.list(accountId, { limit: 50 }).catch(() => ({ total: 0, items: [] })),
            ]);
            setAccountInfo(info);
            setQuotas(Array.isArray(qList) ? qList : []);
            setApprovalList(Array.isArray(reqRes?.items) ? reqRes.items : []);
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

    async function handleRegModeChange(mode: RegistrationMode) {
        if (!accountId) return;
        setSaving(true);
        setMsg(null);
        try {
            const updated = await accounts.updateInfo(accountId, { registration_mode: mode });
            setAccountInfo(updated);
            setMsg({ type: "success", text: `终端接入策略已切换为：${REGISTRATION_MODE_LABELS[mode]}` });
            refreshAccounts();
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "更新失败" });
        }
        setSaving(false);
    }

    async function handleRegenerateApiKey() {
        if (!accountId) return;
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

    const slugName = accountInfo?.slug || currentAccount?.slug || "account";

    function getCurrentQuotaMax(key: string): number {
        const q = quotas.find((item) => item.quota_key === key);
        return q?.max_value ?? QUOTA_META[key]?.defaultMax ?? 0;
    }

    function openApprovalDialog(type: ApprovalRequestType, presetKey?: string) {
        setApprovalType(type);
        const candidates = type === "quota" ? QUOTA_KEYS : PERMISSION_KEYS;
        const target = presetKey && candidates.includes(presetKey)
            ? presetKey
            : (type === "permission"
                ? (candidates.find((k) => getCurrentQuotaMax(k) < 1) || candidates[0])
                : (candidates.find((k) => getCurrentQuotaMax(k) >= 0) || candidates[0]));
        setApprovalTargetKey(target);
        setApprovalUnlimited(false);
        if (type === "quota") {
            const cur = getCurrentQuotaMax(target);
            setApprovalRequestedValue(cur >= 0 ? String(Math.max(cur + 1, cur * 2)) : "");
        } else {
            setApprovalRequestedValue("1");
        }
        setApprovalReason("");
        setApprovalDialogOpen(true);
    }

    async function handleSubmitApproval() {
        if (!accountId || !approvalReason.trim()) return;
        const requestedVal =
            approvalType === "permission"
                ? 1
                : approvalUnlimited
                    ? -1
                    : parseInt(approvalRequestedValue, 10);
        if (approvalType === "quota" && !approvalUnlimited && (!Number.isFinite(requestedVal) || requestedVal < 1)) {
            setMsg({ type: "error", text: "请输入有效的目标配额数值" });
            return;
        }
        setApprovalSubmitting(true);
        setMsg(null);
        try {
            await approvalRequests.create(accountId, {
                request_type: approvalType,
                target_key: approvalTargetKey,
                requested_value: requestedVal,
                reason: approvalReason.trim(),
            });
            setApprovalDialogOpen(false);
            setMsg({
                type: "success",
                text: approvalType === "quota" ? "增开配额申请已提交，请等待管理员审批" : "权限开通申请已提交，请等待管理员审批",
            });
            await loadData();
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "提交审批申请失败" });
        } finally {
            setApprovalSubmitting(false);
        }
    }

    async function handleCancelApproval(requestId: string) {
        if (!accountId) return;
        setCancellingId(requestId);
        setMsg(null);
        try {
            await approvalRequests.cancel(accountId, requestId);
            setMsg({ type: "success", text: "已撤回该审批申请" });
            await loadData();
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "撤回申请失败" });
        } finally {
            setCancellingId(null);
        }
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">账户概览</h1>
                    <p className="page-subtitle">查看和管理当前 MINI ClassIsland 账户信息与引导凭证</p>
                </div>
                <div className="flex gap-8" style={{ flexWrap: "wrap" }}>
                    <Button
                        appearance="secondary"
                        icon={<ArrowUpload24Regular />}
                        onClick={() => setWizardOpen(true)}
                    >
                        从本地上传配置
                    </Button>
                    <DownloadPresetPopoverButton
                        buttonText="下载通用配置"
                        appearance="primary"
                        defaultFileName={`ManagementPreset-${slugName}-generic.json`}
                        onFetchData={() => accounts.downloadPreset(accountId)}
                        onError={(text) => setMsg({ type: "error", text })}
                    />
                </div>
            </div>

            <OnboardingWizard
                open={wizardOpen}
                onClose={() => setWizardOpen(false)}
                initialStep={2}
                targetAccountId={accountId}
                mode="import"
            />

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
                            <div className="detail-value">
                                <span className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                                    <Input
                                        value={accountInfo.id}
                                        readOnly
                                        size="small"
                                        style={{ minWidth: 320, fontFamily: "var(--font-mono)" }}
                                    />
                                    <Button
                                        appearance="subtle"
                                        size="small"
                                        icon={<Copy24Regular />}
                                        onClick={() => {
                                            navigator.clipboard.writeText(accountInfo.id);
                                            setMsg({ type: "success", text: "账户 ID 已复制到剪贴板" });
                                        }}
                                    >
                                        复制
                                    </Button>
                                </span>
                            </div>
                        </div>

                        <div className="detail-row">
                            <div className="detail-label">子域名标识</div>
                            <div className="detail-value">
                                {editingSlug ? (
                                    <form onSubmit={handleSlugChange} className="flex items-center gap-8">
                                        <Input
                                            value={newSlug}
                                            onChange={(_, d) => setNewSlug(d.value)}
                                            placeholder="3-64 位小写字母/数字/连字符/下划线"
                                            size="small"
                                            style={{ minWidth: 320, fontFamily: "var(--font-mono)" }}
                                        />
                                        <Button appearance="primary" size="small" type="submit" disabled={saving || !newSlug.trim()}>
                                            保存
                                        </Button>
                                        <Button appearance="subtle" size="small" onClick={() => setEditingSlug(false)}>
                                            取消
                                        </Button>
                                    </form>
                                ) : (
                                    <span className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                                        <Input
                                            value={accountInfo.slug}
                                            readOnly
                                            size="small"
                                            style={{ minWidth: 320, fontFamily: "var(--font-mono)" }}
                                        />
                                        <Button
                                            appearance="subtle"
                                            size="small"
                                            icon={<Edit24Regular />}
                                            onClick={() => {
                                                setNewSlug(accountInfo.slug);
                                                setEditingSlug(true);
                                            }}
                                        >
                                            修改标识
                                        </Button>
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="detail-row">
                            <div className="detail-label">API Key</div>
                            <div className="detail-value flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                                <Input
                                    value={accountInfo.api_key}
                                    readOnly
                                    size="small"
                                    style={{ minWidth: 320, fontFamily: "var(--font-mono)" }}
                                />
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
                                <ConfirmPopover
                                    message="确定要重置 API Key 吗？旧 API Key 将立即失效。"
                                    onConfirm={handleRegenerateApiKey}
                                    confirmText="重新生成"
                                    disabled={saving}
                                >
                                    <Button
                                        appearance="subtle"
                                        size="small"
                                        icon={<ArrowClockwise24Regular />}
                                        disabled={saving}
                                    >
                                        重新生成
                                    </Button>
                                </ConfirmPopover>
                            </div>
                        </div>

                        <div className="detail-row">
                            <div className="detail-label">终端接入策略</div>
                            <div className="detail-value">
                                <Select
                                    size="small"
                                    value={accountInfo.registration_mode || "pairing"}
                                    onChange={(_, d) => handleRegModeChange(d.value as RegistrationMode)}
                                    disabled={saving}
                                    style={{ maxWidth: 320 }}
                                >
                                    {(Object.keys(REGISTRATION_MODE_LABELS) as RegistrationMode[]).map((m) => (
                                        <option key={m} value={m}>{REGISTRATION_MODE_LABELS[m]}</option>
                                    ))}
                                </Select>
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

            {accountInfo && quotas.length > 0 && (
                <div className="card mt-16">
                    <div className="flex items-center justify-between gap-8" style={{ marginBottom: 12, flexWrap: "wrap" }}>
                        <div className="card-title" style={{ margin: 0 }}>账户设备与功能配额</div>
                        <div className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                            <Button
                                appearance="secondary"
                                size="small"
                                icon={<Add24Regular />}
                                onClick={() => openApprovalDialog("quota")}
                            >
                                申请增开配额
                            </Button>
                            <Button
                                appearance="secondary"
                                size="small"
                                icon={<ShieldTask24Regular />}
                                onClick={() => openApprovalDialog("permission")}
                            >
                                申请开通权限
                            </Button>
                        </div>
                    </div>
                    <div>
                        {Object.entries(QUOTA_META).map(([key, meta]) => {
                            const q = quotas.find((item) => item.quota_key === key);
                            const maxVal = q?.max_value ?? meta.defaultMax;
                            const curVal = q?.current_value ?? 0;
                            const hasPending = approvalList.some(
                                (req) => req.target_key === key && req.status === "pending",
                            );
                            return (
                                <div className="settings-item" key={key}>
                                    <div className="settings-item-info">
                                        <div className="settings-item-label">{meta.label}</div>
                                        <div className="settings-item-hint">{meta.hint}</div>
                                    </div>
                                    <div className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                                        {meta.type === "boolean" ? (
                                            <>
                                                <span className={`badge ${maxVal >= 1 ? "badge-success" : "badge-danger"}`}>
                                                    {maxVal >= 1 ? "已启用" : "已禁用"}
                                                </span>
                                                {maxVal < 1 && (
                                                    hasPending ? (
                                                        <span className="badge badge-warning">审批中</span>
                                                    ) : (
                                                        <Button
                                                            appearance="subtle"
                                                            size="small"
                                                            onClick={() => openApprovalDialog("permission", key)}
                                                        >
                                                            申请开通
                                                        </Button>
                                                    )
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <span className="badge badge-info" style={{ fontSize: 13 }}>
                                                    已用 {curVal} / {maxVal < 0 ? "不限制" : maxVal}
                                                </span>
                                                {maxVal >= 0 && (
                                                    hasPending ? (
                                                        <span className="badge badge-warning">审批中</span>
                                                    ) : (
                                                        <Button
                                                            appearance="subtle"
                                                            size="small"
                                                            onClick={() => openApprovalDialog("quota", key)}
                                                        >
                                                            申请增开
                                                        </Button>
                                                    )
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {accountInfo && (
                <div className="card mt-16">
                    <div className="flex items-center justify-between gap-8" style={{ marginBottom: 12, flexWrap: "wrap" }}>
                        <div className="card-title" style={{ margin: 0 }}>配额与权限审批记录</div>
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                            共 {approvalList.length} 条记录
                        </span>
                    </div>
                    {approvalList.length === 0 ? (
                        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                            暂无审批申请记录，可点击上方按钮发起增开配额或开通权限申请。
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {approvalList.map((req) => {
                                const meta = QUOTA_META[req.target_key];
                                const label = meta?.label || req.target_key;
                                return (
                                    <div
                                        key={req.id}
                                        style={{
                                            padding: "12px 14px",
                                            borderRadius: "var(--radius-md)",
                                            border: "1px solid var(--border-color)",
                                            background: "var(--bg-secondary)",
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "flex-start",
                                            gap: 12,
                                            flexWrap: "wrap",
                                        }}
                                    >
                                        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 220 }}>
                                            <div className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                                                <span className="badge badge-info">
                                                    {APPROVAL_REQUEST_TYPE_LABELS[req.request_type] || req.request_type}
                                                </span>
                                                <strong style={{ fontSize: 13 }}>{label}</strong>
                                                <span className={`badge ${statusBadgeClass(req.status)}`}>
                                                    {APPROVAL_REQUEST_STATUS_LABELS[req.status] || req.status}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                                                {req.request_type === "quota" ? (
                                                    <>
                                                        当前上限：{formatQuotaVal(req.target_key, req.current_value)} → 申请目标：
                                                        <strong>{formatQuotaVal(req.target_key, req.requested_value)}</strong>
                                                        {req.status === "approved" && req.approved_value !== null && req.approved_value !== undefined && (
                                                            <> · 实际批准：<strong>{formatQuotaVal(req.target_key, req.approved_value)}</strong></>
                                                        )}
                                                    </>
                                                ) : (
                                                    <>申请开通「{label}」功能权限</>
                                                )}
                                            </div>
                                            <div style={{ fontSize: 12.5, whiteSpace: "pre-wrap" }}>
                                                申请理由：{req.reason}
                                            </div>
                                            {req.review_note && (
                                                <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                                                    审批备注：{req.review_note}
                                                </div>
                                            )}
                                            <div style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>
                                                提交于 {new Date(req.created_at).toLocaleString("zh-CN")}
                                                {req.reviewed_at && ` · 审批于 ${new Date(req.reviewed_at).toLocaleString("zh-CN")}`}
                                            </div>
                                        </div>
                                        {req.status === "pending" && (
                                            <ConfirmPopover
                                                message="确定要撤回该审批申请吗？"
                                                onConfirm={() => handleCancelApproval(req.id)}
                                                confirmText="撤回"
                                                disabled={cancellingId === req.id}
                                            >
                                                <Button
                                                    appearance="subtle"
                                                    size="small"
                                                    disabled={cancellingId === req.id}
                                                >
                                                    {cancellingId === req.id ? <Spinner size="tiny" /> : "撤回申请"}
                                                </Button>
                                            </ConfirmPopover>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            <Dialog
                open={approvalDialogOpen}
                onOpenChange={(_, data) => {
                    if (!approvalSubmitting) setApprovalDialogOpen(data.open);
                }}
            >
                <DialogSurface style={{ maxWidth: 480 }}>
                    <DialogBody>
                        <DialogTitle>
                            {approvalType === "quota" ? "申请增开配额" : "申请开通功能权限"}
                        </DialogTitle>
                        <DialogContent style={{ paddingTop: 8 }}>
                            <div className="form-group">
                                <label className="form-label">申请类型</label>
                                <Select
                                    value={approvalType}
                                    onChange={(_, d) => {
                                        const nextType = d.value as ApprovalRequestType;
                                        openApprovalDialog(nextType);
                                    }}
                                    style={{ width: "100%" }}
                                >
                                    <option value="quota">增开配额</option>
                                    <option value="permission">申请权限</option>
                                </Select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">
                                    {approvalType === "quota" ? "目标配额项" : "目标功能权限"}
                                </label>
                                <Select
                                    value={approvalTargetKey}
                                    onChange={(_, d) => {
                                        const nextKey = d.value;
                                        setApprovalTargetKey(nextKey);
                                        if (approvalType === "quota") {
                                            const cur = getCurrentQuotaMax(nextKey);
                                            setApprovalRequestedValue(cur >= 0 ? String(Math.max(cur + 1, cur * 2)) : "");
                                        }
                                    }}
                                    style={{ width: "100%" }}
                                >
                                    {(approvalType === "quota" ? QUOTA_KEYS : PERMISSION_KEYS).map((k) => (
                                        <option key={k} value={k}>
                                            {QUOTA_META[k]?.label || k}（当前：{formatQuotaVal(k, getCurrentQuotaMax(k))}）
                                        </option>
                                    ))}
                                </Select>
                                {QUOTA_META[approvalTargetKey]?.hint && (
                                    <div className="form-hint">{QUOTA_META[approvalTargetKey].hint}</div>
                                )}
                            </div>

                            {approvalType === "quota" && (
                                <div className="form-group">
                                    <div className="flex items-center justify-between gap-8" style={{ marginBottom: 6 }}>
                                        <label className="form-label" style={{ margin: 0 }}>期望配额上限</label>
                                        <div className="flex items-center gap-6">
                                            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>申请不限制</span>
                                            <Switch
                                                checked={approvalUnlimited}
                                                onChange={(_, d) => setApprovalUnlimited(d.checked)}
                                            />
                                        </div>
                                    </div>
                                    {!approvalUnlimited && (
                                        <Input
                                            type="number"
                                            min={Math.max(1, getCurrentQuotaMax(approvalTargetKey) + 1)}
                                            max={1000000}
                                            value={approvalRequestedValue}
                                            onChange={(_, d) => setApprovalRequestedValue(d.value)}
                                            placeholder="请输入大于当前上限的目标数值"
                                            style={{ width: "100%" }}
                                        />
                                    )}
                                </div>
                            )}

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">申请理由与使用场景</label>
                                <Textarea
                                    value={approvalReason}
                                    maxLength={2000}
                                    rows={4}
                                    onChange={(_, d) => setApprovalReason(d.value)}
                                    placeholder="请简要说明设备规模、使用场景或开通该权限的原因，以便管理员快速审批"
                                    style={{ width: "100%" }}
                                />
                            </div>
                        </DialogContent>
                        <DialogActions style={{ marginTop: 14 }}>
                            <Button
                                appearance="secondary"
                                onClick={() => setApprovalDialogOpen(false)}
                                disabled={approvalSubmitting}
                            >
                                取消
                            </Button>
                            <Button
                                appearance="primary"
                                icon={approvalSubmitting ? undefined : <Send24Regular />}
                                onClick={handleSubmitApproval}
                                disabled={
                                    approvalSubmitting ||
                                    !approvalReason.trim() ||
                                    (approvalType === "quota" && !approvalUnlimited && !approvalRequestedValue.trim())
                                }
                            >
                                {approvalSubmitting ? <Spinner size="tiny" /> : "提交审批申请"}
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>

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
                            placeholder="输入当前账户名称以确认"
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
