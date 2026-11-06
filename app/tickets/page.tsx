"use client";

import React, { useCallback, useEffect, useState } from "react";
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
    MessageBar,
    MessageBarBody,
    Spinner,
    Textarea,
} from "@fluentui/react-components";
import { Select } from "@/components/CustomSelect";
import {
    Add24Regular,
    ArrowLeft24Regular,
    ArrowRight24Regular,
    Dismiss24Regular,
    Headset24Regular,
    Send24Regular,
} from "@fluentui/react-icons";
import styles from "./tickets.module.css";

const PAGE_SIZE = 20;

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
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<"" | TicketStatus>("");
    const [offset, setOffset] = useState(0);

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
                offset,
                limit: PAGE_SIZE,
                status: statusFilter || undefined,
            });
            setItems(Array.isArray(data.items) ? data.items : []);
            setTotal(Number(data.total) || 0);
        } catch (e) {
            setError(e instanceof Error ? e.message : "加载工单列表失败");
        } finally {
            if (!silent) setLoading(false);
        }
    }, [offset, statusFilter]);

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
            setOffset(0);
            setItems((prev) => [created, ...prev]);
            setTotal((prev) => prev + 1);
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
        if (!window.confirm("确定要关闭该工单吗？关闭后将无法继续回复。")) return;
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

    const page = Math.floor(offset / PAGE_SIZE) + 1;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">我的工单</h1>
                    <p className="page-subtitle">
                        提交问题、跟踪处理进度，并与超级管理员沟通
                    </p>
                </div>
                <Button
                    appearance="primary"
                    icon={<Add24Regular />}
                    onClick={() => setCreateOpen(true)}
                >
                    提交工单
                </Button>
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

            <div className={styles.toolbar}>
                <Select
                    value={statusFilter}
                    onChange={(_, d) => {
                        setStatusFilter(d.value as "" | TicketStatus);
                        setOffset(0);
                    }}
                    style={{ width: 160 }}
                >
                    {STATUS_FILTERS.map((option) => (
                        <option key={option.value || "all"} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </Select>
                <span className={styles.muted}>共 {total} 个工单</span>
            </div>

            {loading ? (
                <div className="flex items-center justify-center" style={{ height: 200 }}>
                    <Spinner size="medium" />
                </div>
            ) : items.length === 0 ? (
                <div className={`card ${styles.empty}`}>
                    <Headset24Regular style={{ fontSize: 28, marginBottom: 8 }} />
                    <div>暂无工单。遇到问题时可以提交工单联系管理员。</div>
                </div>
            ) : (
                <>
                    <div className={styles.list}>
                        {items.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                className={styles.ticket}
                                onClick={() => openDetail(item.id)}
                            >
                                {item.user_unread && <span className={styles.dot} />}
                                <div className={styles.ticketMain}>
                                    <div className={styles.subjectRow}>
                                        <span className={styles.subject}>{item.subject}</span>
                                    </div>
                                    <div className={styles.meta}>
                                        <span>更新于 {formatTime(item.updated_at)}</span>
                                        <span>{item.message_count} 条回复</span>
                                    </div>
                                    <div className={styles.badges}>
                                        <Badge
                                            appearance="filled"
                                            color={STATUS_COLORS[item.status]}
                                        >
                                            {TICKET_STATUS_LABELS[item.status]}
                                        </Badge>
                                        <Badge appearance="tint" color="subtle">
                                            {TICKET_CATEGORY_LABELS[item.category]}
                                        </Badge>
                                        <Badge
                                            appearance="tint"
                                            color={PRIORITY_COLORS[item.priority]}
                                        >
                                            {TICKET_PRIORITY_LABELS[item.priority]}优先级
                                        </Badge>
                                        {item.user_unread && (
                                            <Badge appearance="filled" color="brand">
                                                新回复
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className={styles.pager}>
                            <Button
                                size="small"
                                icon={<ArrowLeft24Regular />}
                                disabled={offset === 0}
                                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                            >
                                上一页
                            </Button>
                            <span className={styles.muted}>
                                第 {page} / {totalPages} 页
                            </span>
                            <Button
                                size="small"
                                icon={<ArrowRight24Regular />}
                                iconPosition="after"
                                disabled={offset + PAGE_SIZE >= total}
                                onClick={() => setOffset(offset + PAGE_SIZE)}
                            >
                                下一页
                            </Button>
                        </div>
                    )}
                </>
            )}

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
                            <div className="form-group">
                                <label className="form-label">问题描述</label>
                                <Textarea
                                    value={form.content}
                                    maxLength={5000}
                                    onChange={(_, d) => setForm({ ...form, content: d.value })}
                                    rows={6}
                                    placeholder="请描述问题出现的场景、操作步骤和期望结果"
                                    style={{ width: "100%" }}
                                />
                            </div>
                        </DialogContent>
                        <DialogActions>
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

            <Dialog
                open={detailOpen}
                onOpenChange={(_, data) => {
                    if (!data.open && !replying && !closing) {
                        setDetailOpen(false);
                        setDetail(null);
                    }
                }}
            >
                <DialogSurface style={{ maxWidth: 720, width: "100%" }}>
                    <DialogBody>
                        <DialogTitle style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ flex: 1, minWidth: 0 }}>
                                {detail?.subject || "工单详情"}
                            </span>
                            {detail && (
                                <Badge
                                    appearance="filled"
                                    color={STATUS_COLORS[detail.status]}
                                >
                                    {TICKET_STATUS_LABELS[detail.status]}
                                </Badge>
                            )}
                        </DialogTitle>
                        <DialogContent>
                            {detailLoading || !detail ? (
                                <div
                                    className="flex items-center justify-center"
                                    style={{ height: 180 }}
                                >
                                    <Spinner size="medium" />
                                </div>
                            ) : (
                                <>
                                    <div className={styles.meta} style={{ marginBottom: 10 }}>
                                        <span>{TICKET_CATEGORY_LABELS[detail.category]}</span>
                                        <span>
                                            {TICKET_PRIORITY_LABELS[detail.priority]}优先级
                                        </span>
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
                                        <div className={styles.muted}>
                                            该工单已关闭，无法继续回复。
                                        </div>
                                    ) : (
                                        <div className={styles.composer}>
                                            <Textarea
                                                value={replyText}
                                                maxLength={5000}
                                                onChange={(_, d) => setReplyText(d.value)}
                                                rows={3}
                                                placeholder={
                                                    detail.status === "resolved"
                                                        ? "回复后工单将重新打开"
                                                        : "补充说明或回复管理员"
                                                }
                                                style={{ width: "100%" }}
                                            />
                                            <div className={styles.composerActions}>
                                                <Button
                                                    size="small"
                                                    appearance="subtle"
                                                    icon={<Dismiss24Regular />}
                                                    onClick={handleCloseTicket}
                                                    disabled={closing || replying}
                                                >
                                                    {closing ? "关闭中..." : "关闭工单"}
                                                </Button>
                                                <Button
                                                    appearance="primary"
                                                    size="small"
                                                    icon={<Send24Regular />}
                                                    onClick={handleReply}
                                                    disabled={
                                                        replying || !replyText.trim()
                                                    }
                                                >
                                                    {replying ? <Spinner size="tiny" /> : "发送回复"}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </DialogContent>
                        <DialogActions>
                            <Button
                                appearance="secondary"
                                onClick={() => {
                                    setDetailOpen(false);
                                    setDetail(null);
                                }}
                                disabled={replying || closing}
                            >
                                关闭
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </div>
    );
}
