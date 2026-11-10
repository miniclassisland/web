"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { invitations } from "@/lib/api";
import { useAccount } from "@/lib/account-context";
import type { InvitationOut, InvitationCreate } from "@/lib/types";
import { ACCOUNT_ROLE_LABELS } from "@/lib/types";
import { matchAdvancedQuery } from "@/lib/search-engine";
import {
    Button, Spinner, Input,
    Popover, PopoverTrigger, PopoverSurface,
    Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions,
} from "@fluentui/react-components";
import { MessageBar, MessageBarBody } from "@/components/ToastMessageBar";
import { Select } from "@/components/CustomSelect";
import { ConfirmPopover } from "@/components/ConfirmPopover";
import {
    Add24Regular, Dismiss24Regular, Copy24Regular, PeopleAdd24Regular,
    Search24Regular, Filter16Regular, ChevronLeft16Regular, ChevronRight16Regular,
} from "@fluentui/react-icons";

export default function InvitationsPage() {
    const { accountId, refreshAccounts } = useAccount();
    const [list, setList] = useState<InvitationOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "revoked">("all");
    const [roleFilter, setRoleFilter] = useState<string>("all");
    const [pageSize, setPageSize] = useState<number>(20);
    const [currentPage, setCurrentPage] = useState<number>(1);
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
            const res = await invitations.list(accountId);
            setList(Array.isArray(res) ? res : []);
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

    const filteredList = useMemo(() => {
        return list.filter((item) => {
            if (statusFilter === "active" && !item.is_active) return false;
            if (statusFilter === "revoked" && item.is_active) return false;
            if (roleFilter !== "all" && item.role_in_account !== roleFilter) return false;
            return matchAdvancedQuery(item, searchQuery, {
                fields: {
                    status: (i) => (i.is_active ? "active" : "revoked"),
                    role: (i) => [i.role_in_account, ACCOUNT_ROLE_LABELS[i.role_in_account] || ""],
                    code: (i) => i.code,
                },
                freeText: (i) => [
                    i.code,
                    i.role_in_account,
                    ACCOUNT_ROLE_LABELS[i.role_in_account] || "",
                ],
            });
        });
    }, [list, statusFilter, roleFilter, searchQuery]);

    const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const pagedList = filteredList.slice((safePage - 1) * pageSize, safePage * pageSize);

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

            <div className="clients-main-pane">
                <div className="card" style={{ padding: "12px 16px", marginBottom: 0 }}>
                    <div className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                        <Input
                            placeholder="搜索邀请码、授予角色或高级过滤表达式"
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
                                    <div style={{ fontSize: 12, fontWeight: 600 }}>按状态筛选</div>
                                    <Select
                                        size="small"
                                        value={statusFilter}
                                        onChange={(_, d) => {
                                            setStatusFilter(d.value as typeof statusFilter);
                                            setCurrentPage(1);
                                        }}
                                    >
                                        <option value="all">全部邀请码</option>
                                        <option value="active">活跃</option>
                                        <option value="revoked">已撤销</option>
                                    </Select>

                                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>按授予角色筛选</div>
                                    <Select
                                        size="small"
                                        value={roleFilter}
                                        onChange={(_, d) => {
                                            setRoleFilter(d.value);
                                            setCurrentPage(1);
                                        }}
                                    >
                                        <option value="all">全部角色</option>
                                        {Object.entries(ACCOUNT_ROLE_LABELS)
                                            .filter(([k]) => k !== "owner")
                                            .map(([k, v]) => (
                                                <option key={k} value={k}>{v}</option>
                                            ))}
                                    </Select>

                                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>快捷表达式</div>
                                    <div className="flex gap-4" style={{ flexWrap: "wrap" }}>
                                        {[
                                            "status:active",
                                            "status:revoked",
                                            "role:admin",
                                            "role:member",
                                            "role:viewer",
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
                                                setRoleFilter("all");
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
                        <span>{list.length}个邀请码</span>
                        <span>{filteredList.length}已筛选</span>
                    </div>
                </div>

                <div className="card" style={{ marginBottom: 0, padding: 0, overflow: "hidden" }}>
                    {loading ? (
                        <div className="empty-state"><Spinner size="medium" /></div>
                    ) : list.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-text">暂无邀请记录</div>
                            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 8 }}>
                                点击「创建邀请码」生成协作邀请码
                            </p>
                        </div>
                    ) : pagedList.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-text">暂无符合筛选条件的邀请码</div>
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
                                {pagedList.map((item) => (
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
                                                <ConfirmPopover
                                                    message="确定要撤销此邀请码吗？撤销后无法恢复。"
                                                    onConfirm={() => handleRevoke(item.id)}
                                                    confirmText="撤销"
                                                >
                                                    <Button
                                                        appearance="subtle"
                                                        size="small"
                                                        icon={<Dismiss24Regular />}
                                                        style={{ color: "var(--danger-color)" }}
                                                    >
                                                        撤销
                                                    </Button>
                                                </ConfirmPopover>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

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
                                    placeholder="输入管理员提供的邀请码"
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
