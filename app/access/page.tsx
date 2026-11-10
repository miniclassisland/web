"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { access } from "@/lib/api";
import { useAccount } from "@/lib/account-context";
import type { AccessMember } from "@/lib/types";
import { ACCOUNT_ROLE_LABELS } from "@/lib/types";
import { matchAdvancedQuery } from "@/lib/search-engine";
import {
    Button, Input, Spinner,
    Popover, PopoverTrigger, PopoverSurface,
} from "@fluentui/react-components";
import { MessageBar, MessageBarBody } from "@/components/ToastMessageBar";
import { Select } from "@/components/CustomSelect";
import { ConfirmPopover } from "@/components/ConfirmPopover";
import {
    Search24Regular, Delete24Regular, ArrowSync24Regular,
    Filter16Regular, ChevronLeft16Regular, ChevronRight16Regular,
} from "@fluentui/react-icons";

export default function AccessPage() {
    const { accountId } = useAccount();
    const [members, setMembers] = useState<AccessMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>("all");
    const [pageSize, setPageSize] = useState<number>(20);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const loadData = useCallback(async () => {
        if (!accountId) return;
        setLoading(true);
        try {
            const list = await access.list(accountId);
            setMembers(Array.isArray(list) ? list : []);
        } catch {
            setMembers([]);
        }
        setLoading(false);
    }, [accountId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    async function handleRoleChange(userId: string, newRole: string) {
        try {
            await access.update(accountId, userId, { role_in_account: newRole });
            setMsg({ type: "success", text: "成员角色已更新" });
            loadData();
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "更新失败" });
        }
    }

    async function handleDelete(userId: string) {
        try {
            await access.delete(accountId, userId);
            setMsg({ type: "success", text: "成员已移除" });
            loadData();
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "移除失败" });
        }
    }

    const filteredMembers = useMemo(() => {
        return members.filter((m) => {
            if (roleFilter !== "all" && m.role_in_account !== roleFilter) return false;
            return matchAdvancedQuery(m, searchQuery, {
                fields: {
                    role: (item) => [item.role_in_account, ACCOUNT_ROLE_LABELS[item.role_in_account] || ""],
                    name: (item) => [item.display_name || "", item.username || ""],
                    email: (item) => item.email || "",
                    id: (item) => item.user_id,
                },
                freeText: (item) => [
                    item.display_name,
                    item.username,
                    item.email,
                    item.user_id,
                    ACCOUNT_ROLE_LABELS[item.role_in_account] || item.role_in_account,
                ],
            });
        });
    }, [members, roleFilter, searchQuery]);

    const totalPages = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const pagedMembers = filteredMembers.slice((safePage - 1) * pageSize, safePage * pageSize);

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">访问控制</h1>
                    <p className="page-subtitle">管理当前账户下的协作成员与角色权限</p>
                </div>
                <div className="flex gap-8">
                    <Button appearance="secondary" icon={<ArrowSync24Regular />} onClick={loadData}>
                        刷新成员
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
                            placeholder="搜索成员名称、用户名、邮箱、用户编号或高级过滤表达式"
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
                                    <div style={{ fontSize: 12, fontWeight: 600 }}>按账户内角色筛选</div>
                                    <Select
                                        size="small"
                                        value={roleFilter}
                                        onChange={(_, d) => {
                                            setRoleFilter(d.value);
                                            setCurrentPage(1);
                                        }}
                                    >
                                        <option value="all">全部角色</option>
                                        {Object.entries(ACCOUNT_ROLE_LABELS).map(([k, v]) => (
                                            <option key={k} value={k}>{v}</option>
                                        ))}
                                    </Select>

                                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>快捷表达式</div>
                                    <div className="flex gap-4" style={{ flexWrap: "wrap" }}>
                                        {[
                                            "role:owner",
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
                        <span>{members.length}位成员</span>
                        <span>{filteredMembers.length}已筛选</span>
                    </div>
                </div>

                <div className="card" style={{ marginBottom: 0, padding: 0, overflow: "hidden" }}>
                    {loading ? (
                        <div className="empty-state"><Spinner size="medium" /></div>
                    ) : pagedMembers.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-text">暂无符合筛选条件的成员</div>
                        </div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>成员名称 / 用户名</th>
                                    <th>邮箱</th>
                                    <th>用户 ID</th>
                                    <th>账户内角色</th>
                                    <th>加入时间</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagedMembers.map((m) => (
                                    <tr key={m.id}>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{m.display_name || m.username || "用户"}</div>
                                            {m.username && (
                                                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>@{m.username}</div>
                                            )}
                                        </td>
                                        <td style={{ fontSize: 13 }}>{m.email || "-"}</td>
                                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{m.user_id}</td>
                                        <td>
                                            <Select
                                                size="small"
                                                value={m.role_in_account}
                                                onChange={(_, d) => handleRoleChange(m.user_id, d.value)}
                                                disabled={m.role_in_account === "owner"}
                                            >
                                                {Object.entries(ACCOUNT_ROLE_LABELS).map(([k, v]) => (
                                                    <option key={k} value={k}>{v}</option>
                                                ))}
                                            </Select>
                                        </td>
                                        <td style={{ fontSize: 12 }}>
                                            {new Date(m.joined_at).toLocaleString("zh-CN")}
                                        </td>
                                        <td>
                                            {m.role_in_account !== "owner" && (
                                                <ConfirmPopover
                                                    message="确定要移除此成员吗？移除后该用户将无法访问此账户。"
                                                    onConfirm={() => handleDelete(m.user_id)}
                                                    confirmText="移除"
                                                >
                                                    <Button
                                                        appearance="subtle"
                                                        size="small"
                                                        icon={<Delete24Regular />}
                                                        style={{ color: "var(--danger-color)" }}
                                                    >
                                                        移除
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
        </div>
    );
}
