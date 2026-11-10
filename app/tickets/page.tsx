"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { tickets as ticketApi } from "@/lib/api";
import {
    TICKET_CATEGORY_LABELS,
    TICKET_PRIORITY_LABELS,
    TICKET_STATUS_LABELS,
} from "@/lib/types";
import type {
    TicketCategory,
    TicketDetail,
    TicketItem,
    TicketPriority,
    TicketStatus,
} from "@/lib/types";
import { matchAdvancedQuery } from "@/lib/search-engine";
import {
    Badge,
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    Input,
    Popover,
    PopoverSurface,
    PopoverTrigger,
    Spinner,
    Textarea,
} from "@fluentui/react-components";
import { MessageBar, MessageBarBody } from "@/components/ToastMessageBar";
import { Select } from "@/components/CustomSelect";
import { ConfirmPopover } from "@/components/ConfirmPopover";
import {
    Add24Regular,
    ArrowLeft24Regular,
    ArrowSync24Regular,
    ChevronLeft16Regular,
    ChevronRight16Regular,
    Dismiss24Regular,
    Filter16Regular,
    Headset24Regular,
    Search24Regular,
    Send24Regular,
} from "@fluentui/react-icons";
import styles from "./tickets.module.css";

type BadgeColor =
    | "brand"
    | "danger"
    | "important"
    | "informative"
    | "success"
    | "warning"
    | "severe"
    | "subtle";

const STATUS_COLORS: Record<TicketStatus, BadgeColor> = {
    open: "warning",
    in_progress: "informative",
    resolved: "success",
    closed: "subtle",
};

const PRIORITY_COLORS: Record<TicketPriority, BadgeColor> = {
    low: "subtle",
    normal: "brand",
    high: "important",
    urgent: "danger",
};

const STATUS_FILTERS: Array<{ value: "" | TicketStatus; label: string }> = [
    { value: "", label: "全部状态" },
    { value: "open", label: "待处理" },
    { value: "in_progress", label: "处理中" },
    { value: "resolved", label: "已解决" },
    { value: "closed", label: "已关闭" },
];

function formatTime(value: string | null | undefined): string {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("zh-CN", { hour12: false });
}

export default function TicketsPage() {
    const [items, setItems] = useState<TicketItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"" | TicketStatus>("");
    const [priorityFilter, setPriorityFilter] = useState<"" | TicketPriority>("");
    const [categoryFilter, setCategoryFilter] = useState<"" | TicketCategory>("");
    const [pageSize, setPageSize] = useState<number>(20);
    const [currentPage, setCurrentPage] = useState<number>(1);

    const [createOpen, setCreateOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({
        subject: "",
        content: "",
        category: "other" as TicketCategory,
        priority: "normal" as TicketPriority,
    });

    const [detailOpen, setDetailOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detail, setDetail] = useState<TicketDetail | null>(null);
    const [replyText, setReplyText] = useState("");
    const [replying, setReplying] = useState(false);
    const [closing, setClosing] = useState(false);

    const loadTickets = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        setError(null);
        try {
            const data = await ticketApi.list({
                offset: 0,
                limit: 200,
                status: statusFilter || undefined,
            });
            setItems(Array.isArray(data.items) ? data.items : []);
        } catch (e) {
            setError(e instanceof Error ? e.message : "加载工单列表失败");
        } finally {
            if (!silent) setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        loadTickets();
    }, [loadTickets]);

    async function openDetail(ticketId: string) {
        setDetailOpen(true);
        setDetailLoading(true);
        setDetail(null);
        setReplyText("");
        setError(null);
        try {
            const data = await ticketApi.get(ticketId);
            setDetail(data);
            setItems((prev) =>
                prev.map((item) =>
                    item.id === data.id
                        ? { ...item, user_unread: false, status: data.status }
                        : item,
                ),
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : "加载工单详情失败");
            setDetailOpen(false);
        } finally {
            setDetailLoading(false);
        }
    }

    function closeDetailView() {
        if (replying || closing) return;
        setDetailOpen(false);
        setDetail(null);
        setReplyText("");
    }

    async function handleCreate() {
        if (!form.subject.trim() || !form.content.trim()) return;
        setCreating(true);
        setError(null);
        setNotice(null);
        try {
            const created = await ticketApi.create({
                subject: form.subject.trim(),
                content: form.content.trim(),
                category: form.category,
                priority: form.priority,
            });
            setCreateOpen(false);
            setForm({
                subject: "",
                content: "",
                category: "other",
                priority: "normal",
            });
            setNotice("工单已提交，管理员会尽快处理。");
            setStatusFilter("");
            setCurrentPage(1);
            setItems((prev) => [created, ...prev]);
            if (created?.id) {
                await openDetail(created.id);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "提交工单失败");
        } finally {
            setCreating(false);
        }
    }

    async function handleReply() {
        if (!detail || !replyText.trim()) return;
        setReplying(true);
        setError(null);
        setNotice(null);
        try {
            await ticketApi.reply(detail.id, replyText.trim());
            setReplyText("");
            const fresh = await ticketApi.get(detail.id);
            setDetail(fresh);
            await loadTickets(true);
            setNotice("回复已发送。");
        } catch (e) {
            setError(e instanceof Error ? e.message : "发送回复失败");
        } finally {
            setReplying(false);
        }
    }

    async function handleCloseTicket() {
        if (!detail) return;
        setClosing(true);
        setError(null);
        setNotice(null);
        try {
            await ticketApi.close(detail.id);
            const fresh = await ticketApi.get(detail.id);
            setDetail(fresh);
            await loadTickets(true);
            setNotice("工单已关闭。");
        } catch (e) {
            setError(e instanceof Error ? e.message : "关闭工单失败");
        } finally {
            setClosing(false);
        }
    }

    const filteredItems = useMemo(() => {
        return items.filter((item) => {
            if (statusFilter && item.status !== statusFilter) return false;
            if (priorityFilter && item.priority !== priorityFilter) return false;
            if (categoryFilter && item.category !== categoryFilter) return false;
            return matchAdvancedQuery(item, searchQuery, {
                fields: {
                    status: (t) => [t.status, TICKET_STATUS_LABELS[t.status] || ""],
                    priority: (t) => [t.priority, TICKET_PRIORITY_LABELS[t.priority] || ""],
                    category: (t) => [t.category, TICKET_CATEGORY_LABELS[t.category] || ""],
                    unread: (t) => Boolean(t.user_unread),
                    id: (t) => t.id,
                    subject: (t) => t.subject,
                },
                freeText: (t) => [
                    t.id,
                    t.subject,
                    TICKET_STATUS_LABELS[t.status],
                    TICKET_PRIORITY_LABELS[t.priority],
                    TICKET_CATEGORY_LABELS[t.category],
                ],
            });
        });
    }, [items, statusFilter, priorityFilter, categoryFilter, searchQuery]);

    const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const pagedItems = filteredItems.slice((safePage - 1) * pageSize, safePage * pageSize);

    if (detailOpen) {
        return (
            <div className="fade-in">
                <div className="page-header" style={{ marginBottom: 16 }}>
                    <div className="flex items-center gap-12" style={{ flexWrap: "wrap", minWidth: 0 }}>
                        <Button
                            appearance="secondary"
                            icon={<ArrowLeft24Regular />}
                            onClick={closeDetailView}
                            disabled={replying || closing}
                        >
                            返回工单列表
                        </Button>
                        <h1 className="page-title" style={{ fontSize: 20, margin: 0 }}>
                            {detail?.subject || "工单详情"}
                        </h1>
                        {detail && (
                            <Badge
                                appearance="filled"
                                color={STATUS_COLORS[detail.status]}
                            >
                                {TICKET_STATUS_LABELS[detail.status]}
                            </Badge>
                        )}
                    </div>
                </div>

                {error && (
                    <MessageBar intent="error" style={{ marginBottom: 12 }}>
                        <MessageBarBody>{error}</MessageBarBody>
                    </MessageBar>
                )}
                {notice && (
                    <MessageBar intent="success" style={{ marginBottom: 12 }}>
                        <MessageBarBody>{notice}</MessageBarBody>
                    </MessageBar>
                )}

                <div className="card" style={{ width: "100%", marginBottom: 0 }}>
                    {detailLoading || !detail ? (
                        <div
                            className="flex items-center justify-center"
                            style={{ height: 220 }}
                        >
                            <Spinner size="medium" />
                        </div>
                    ) : (
                        <>
                            <div className={styles.meta} style={{ marginTop: 0, marginBottom: 14 }}>
                                <span>{TICKET_CATEGORY_LABELS[detail.category]}</span>
                                <span>{TICKET_PRIORITY_LABELS[detail.priority]}优先级</span>
                                <span>提交于 {formatTime(detail.created_at)}</span>
                            </div>

                            <div className={styles.thread}>
                                <div className={styles.message}>
                                    <div className={styles.messageHead}>
                                        <span>我</span>
                                        <span>{formatTime(detail.created_at)}</span>
                                    </div>
                                    <div className={styles.messageBody}>
                                        {detail.content}
                                    </div>
                                </div>
                                {detail.messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={`${styles.message} ${
                                            message.author_role === "admin"
                                                ? styles.messageAdmin
                                                : ""
                                        }`}
                                    >
                                        <div className={styles.messageHead}>
                                            <span>
                                                {message.author_role === "admin"
                                                    ? "超级管理员"
                                                    : "我"}
                                            </span>
                                            <span>{formatTime(message.created_at)}</span>
                                        </div>
                                        <div className={styles.messageBody}>
                                            {message.content}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {detail.status === "closed" ? (
                                <div className={styles.muted} style={{ marginTop: 12 }}>
                                    该工单已关闭，无法继续回复。
                                </div>
                            ) : (
                                <>
                                    <div className={styles.composer}>
                                        <Textarea
                                            value={replyText}
                                            maxLength={5000}
                                            onChange={(_, d) => setReplyText(d.value)}
                                            rows={4}
                                            placeholder={
                                                detail.status === "resolved"
                                                    ? "回复后工单将重新打开"
                                                    : "补充说明或回复管理员"
                                            }
                                            style={{ width: "100%" }}
                                        />
                                    </div>

                                    <div className={styles.composerActions}>
                                        <ConfirmPopover
                                            message="确定要关闭该工单吗？关闭后将无法继续回复。"
                                            onConfirm={handleCloseTicket}
                                            confirmText="关闭工单"
                                            disabled={closing || replying}
                                        >
                                            <Button
                                                appearance="secondary"
                                                icon={<Dismiss24Regular />}
                                                disabled={closing || replying}
                                            >
                                                {closing ? "关闭中..." : "关闭工单"}
                                            </Button>
                                        </ConfirmPopover>
                                        <div className={styles.dialogFooterRight}>
                                            <Button
                                                appearance="primary"
                                                icon={<Send24Regular />}
                                                onClick={handleReply}
                                                disabled={replying || !replyText.trim()}
                                            >
                                                {replying ? <Spinner size="tiny" /> : "发送回复"}
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">我的工单</h1>
                    <p className="page-subtitle">
                        提交问题、跟踪处理进度，并与超级管理员沟通
                    </p>
                </div>
                <div className="flex gap-8">
                    <Button
                        appearance="secondary"
                        icon={<ArrowSync24Regular />}
                        onClick={() => loadTickets()}
                        disabled={loading}
                    >
                        刷新列表
                    </Button>
                    <Button
                        appearance="primary"
                        icon={<Add24Regular />}
                        onClick={() => setCreateOpen(true)}
                    >
                        提交工单
                    </Button>
                </div>
            </div>

            {error && (
                <MessageBar intent="error" style={{ marginBottom: 12 }}>
                    <MessageBarBody>{error}</MessageBarBody>
                </MessageBar>
            )}
            {notice && (
                <MessageBar intent="success" style={{ marginBottom: 12 }}>
                    <MessageBarBody>{notice}</MessageBarBody>
                </MessageBar>
            )}

            <div className="clients-main-pane">
                <div className="card" style={{ padding: "12px 16px", marginBottom: 0 }}>
                    <div className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                        <Input
                            placeholder="搜索工单标题、编号或高级过滤表达式"
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
                            <PopoverSurface style={{ padding: 12, width: 290 }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600 }}>状态筛选</div>
                                    <Select
                                        size="small"
                                        value={statusFilter}
                                        onChange={(_, d) => {
                                            setStatusFilter(d.value as "" | TicketStatus);
                                            setCurrentPage(1);
                                        }}
                                    >
                                        {STATUS_FILTERS.map((option) => (
                                            <option key={option.value || "all"} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </Select>

                                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>优先级筛选</div>
                                    <Select
                                        size="small"
                                        value={priorityFilter}
                                        onChange={(_, d) => {
                                            setPriorityFilter(d.value as "" | TicketPriority);
                                            setCurrentPage(1);
                                        }}
                                    >
                                        <option value="">全部优先级</option>
                                        {Object.entries(TICKET_PRIORITY_LABELS).map(([val, label]) => (
                                            <option key={val} value={val}>{label}</option>
                                        ))}
                                    </Select>

                                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>分类筛选</div>
                                    <Select
                                        size="small"
                                        value={categoryFilter}
                                        onChange={(_, d) => {
                                            setCategoryFilter(d.value as "" | TicketCategory);
                                            setCurrentPage(1);
                                        }}
                                    >
                                        <option value="">全部分类</option>
                                        {Object.entries(TICKET_CATEGORY_LABELS).map(([val, label]) => (
                                            <option key={val} value={val}>{label}</option>
                                        ))}
                                    </Select>

                                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>快捷表达式</div>
                                    <div className="flex gap-4" style={{ flexWrap: "wrap" }}>
                                        {[
                                            "status:open",
                                            "status:in_progress",
                                            "priority:high",
                                            "unread:true",
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
                                                setStatusFilter("");
                                                setPriorityFilter("");
                                                setCategoryFilter("");
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
                        <span>{items.length}个工单</span>
                        <span>{filteredItems.length}已筛选</span>
                    </div>
                </div>

                <div className="card" style={{ marginBottom: 0, padding: 0, overflow: "hidden" }}>
                    {loading ? (
                        <div className="empty-state">
                            <Spinner size="medium" />
                        </div>
                    ) : items.length === 0 ? (
                        <div className="empty-state">
                            <Headset24Regular style={{ fontSize: 32, marginBottom: 8, color: "var(--text-tertiary)" }} />
                            <div className="empty-state-text">暂无工单。遇到问题时可以提交工单联系管理员。</div>
                        </div>
                    ) : pagedItems.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-text">暂无符合筛选条件的工单</div>
                        </div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>状态</th>
                                    <th>标题</th>
                                    <th>分类</th>
                                    <th>优先级</th>
                                    <th>回复数</th>
                                    <th>更新时间</th>
                                    <th style={{ width: 44 }} aria-label="进入" />
                                </tr>
                            </thead>
                            <tbody>
                                {pagedItems.map((item) => (
                                    <tr
                                        key={item.id}
                                        style={{ cursor: "pointer" }}
                                        onClick={() => openDetail(item.id)}
                                    >
                                        <td>
                                            <Badge
                                                appearance="filled"
                                                color={STATUS_COLORS[item.status]}
                                            >
                                                {TICKET_STATUS_LABELS[item.status]}
                                            </Badge>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                                                <span style={{ fontWeight: item.user_unread ? 700 : 600, color: "var(--text-primary)" }}>
                                                    {item.subject}
                                                </span>
                                                {item.user_unread && (
                                                    <Badge appearance="filled" color="brand">
                                                        新回复
                                                    </Badge>
                                                )}
                                            </div>
                                            <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                                                #{item.id.slice(0, 8)}
                                            </div>
                                        </td>
                                        <td>
                                            <Badge appearance="tint" color="subtle">
                                                {TICKET_CATEGORY_LABELS[item.category]}
                                            </Badge>
                                        </td>
                                        <td>
                                            <Badge
                                                appearance="tint"
                                                color={PRIORITY_COLORS[item.priority]}
                                            >
                                                {TICKET_PRIORITY_LABELS[item.priority]}
                                            </Badge>
                                        </td>
                                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                            {item.message_count} 条回复
                                        </td>
                                        <td style={{ fontSize: 12 }}>
                                            {formatTime(item.updated_at)}
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

            <Dialog
                open={createOpen}
                onOpenChange={(_, data) => {
                    if (!creating) setCreateOpen(data.open);
                }}
            >
                <DialogSurface style={{ maxWidth: 600 }}>
                    <DialogBody>
                        <DialogTitle>提交工单</DialogTitle>
                        <DialogContent>
                            <div className="form-group">
                                <label className="form-label">标题</label>
                                <Input
                                    value={form.subject}
                                    maxLength={200}
                                    onChange={(_, d) => setForm({ ...form, subject: d.value })}
                                    placeholder="简要描述遇到的问题"
                                    style={{ width: "100%" }}
                                />
                            </div>
                            <div className="grid-2">
                                <div className="form-group">
                                    <label className="form-label">分类</label>
                                    <Select
                                        value={form.category}
                                        onChange={(_, d) =>
                                            setForm({
                                                ...form,
                                                category: d.value as TicketCategory,
                                            })
                                        }
                                        style={{ width: "100%" }}
                                    >
                                        {Object.entries(TICKET_CATEGORY_LABELS).map(
                                            ([value, label]) => (
                                                <option key={value} value={value}>
                                                    {label}
                                                </option>
                                            ),
                                        )}
                                    </Select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">优先级</label>
                                    <Select
                                        value={form.priority}
                                        onChange={(_, d) =>
                                            setForm({
                                                ...form,
                                                priority: d.value as TicketPriority,
                                            })
                                        }
                                        style={{ width: "100%" }}
                                    >
                                        {Object.entries(TICKET_PRIORITY_LABELS).map(
                                            ([value, label]) => (
                                                <option key={value} value={value}>
                                                    {label}
                                                </option>
                                            ),
                                        )}
                                    </Select>
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">问题描述</label>
                                <div className={styles.composer} style={{ marginTop: 0 }}>
                                    <Textarea
                                        value={form.content}
                                        maxLength={5000}
                                        onChange={(_, d) => setForm({ ...form, content: d.value })}
                                        rows={6}
                                        placeholder="请描述问题出现的场景、操作步骤和期望结果"
                                        style={{ width: "100%" }}
                                    />
                                </div>
                            </div>
                        </DialogContent>
                        <DialogActions style={{ marginTop: 14 }}>
                            <Button
                                appearance="secondary"
                                onClick={() => setCreateOpen(false)}
                                disabled={creating}
                            >
                                取消
                            </Button>
                            <Button
                                appearance="primary"
                                onClick={handleCreate}
                                disabled={
                                    creating || !form.subject.trim() || !form.content.trim()
                                }
                                icon={creating ? undefined : <Send24Regular />}
                            >
                                {creating ? <Spinner size="tiny" /> : "提交工单"}
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </div>
    );
}
