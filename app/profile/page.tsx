"use client";

import React, { useState, useEffect } from "react";
import { userInfo } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button, Input, Spinner } from "@fluentui/react-components";
import { MessageBar, MessageBarBody } from "@/components/ToastMessageBar";
import {
    Person24Regular,
    Copy24Regular,
    Mail24Regular,
    Fingerprint24Regular,
    ContactCard24Regular,
} from "@fluentui/react-icons";

export default function ProfilePage() {
    const { user, isSuperAdmin, refreshUser } = useAuth();
    const [displayName, setDisplayName] = useState("");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [savingDisplayName, setSavingDisplayName] = useState(false);
    const [savingUsername, setSavingUsername] = useState(false);
    const [savingEmail, setSavingEmail] = useState(false);
    const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        if (user) {
            setDisplayName(user.display_name || "");
            setUsername(user.username || "");
            setEmail(user.email || "");
        }
    }, [user]);

    const isPending = user?.role_code === "pending";

    async function handleSaveDisplayName(e: React.FormEvent) {
        e.preventDefault();
        if (!displayName.trim() || displayName.trim() === (user?.display_name || "")) return;
        setSavingDisplayName(true);
        setMsg(null);
        try {
            await userInfo.changeDisplayName({ display_name: displayName.trim() });
            await refreshUser();
            setMsg({ type: "success", text: "显示名称已更新" });
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "更新失败" });
        } finally {
            setSavingDisplayName(false);
        }
    }

    async function handleSaveUsername(e: React.FormEvent) {
        e.preventDefault();
        if (!username.trim() || username.trim() === (user?.username || "")) return;
        setSavingUsername(true);
        setMsg(null);
        try {
            await userInfo.changeUsername({ username: username.trim() });
            await refreshUser();
            setMsg({ type: "success", text: "用户名已更新" });
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "更新失败" });
        } finally {
            setSavingUsername(false);
        }
    }

    async function handleSaveEmail(e: React.FormEvent) {
        e.preventDefault();
        if (!isSuperAdmin || !email.trim() || email.trim() === (user?.email || "")) return;
        setSavingEmail(true);
        setMsg(null);
        try {
            await userInfo.changeEmail({ email: email.trim() });
            await refreshUser();
            setMsg({ type: "success", text: "绑定邮箱已更新" });
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "更新失败" });
        } finally {
            setSavingEmail(false);
        }
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">个人资料</h1>
                    <p className="page-subtitle">管理您的个人账号显示名称、用户名与绑定邮箱</p>
                </div>
            </div>

            {msg && (
                <MessageBar intent={msg.type} style={{ marginBottom: 16 }}>
                    <MessageBarBody>{msg.text}</MessageBarBody>
                </MessageBar>
            )}

            {/* 条目 1：用户唯一标识 */}
            <div className="card" style={{ width: "100%" }}>
                <div className="card-title flex items-center justify-between gap-8">
                    <span className="flex items-center gap-8">
                        <Fingerprint24Regular />
                        用户唯一标识
                    </span>
                    {user?.id && (
                        <Button
                            appearance="secondary"
                            size="small"
                            type="button"
                            icon={<Copy24Regular />}
                            onClick={() => {
                                navigator.clipboard.writeText(user.id);
                                setMsg({ type: "success", text: "用户唯一标识已复制到剪贴板" });
                            }}
                        >
                            复制标识
                        </Button>
                    )}
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <Input
                        value={user?.id || ""}
                        readOnly
                        style={{ width: "100%", fontFamily: "var(--font-mono)" }}
                    />
                    <div className="form-hint">系统分配的全局唯一身份标识，不可变更</div>
                </div>
            </div>

            {/* 条目 2：显示名称 */}
            <div className="card" style={{ width: "100%" }}>
                <form onSubmit={handleSaveDisplayName}>
                    <div className="card-title flex items-center justify-between gap-8">
                        <span className="flex items-center gap-8">
                            <ContactCard24Regular />
                            显示名称
                        </span>
                        {!isPending && (
                            <Button
                                appearance="primary"
                                size="small"
                                type="submit"
                                disabled={
                                    savingDisplayName ||
                                    !displayName.trim() ||
                                    displayName.trim() === (user?.display_name || "")
                                }
                            >
                                {savingDisplayName ? <Spinner size="tiny" /> : "保存显示名称"}
                            </Button>
                        )}
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <Input
                            value={displayName}
                            onChange={(_, d) => setDisplayName(d.value)}
                            placeholder="输入显示名称"
                            style={{ width: "100%" }}
                        />
                        <div className="form-hint">在工作台与协作列表中向其他成员展示的名称</div>
                    </div>
                </form>
            </div>

            {/* 条目 3：用户名 */}
            <div className="card" style={{ width: "100%" }}>
                <form onSubmit={handleSaveUsername}>
                    <div className="card-title flex items-center justify-between gap-8">
                        <span className="flex items-center gap-8">
                            <Person24Regular />
                            用户名
                        </span>
                        {!isPending && (
                            <Button
                                appearance="primary"
                                size="small"
                                type="submit"
                                disabled={
                                    savingUsername ||
                                    !username.trim() ||
                                    username.trim() === (user?.username || "")
                                }
                            >
                                {savingUsername ? <Spinner size="tiny" /> : "保存用户名"}
                            </Button>
                        )}
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <Input
                            value={username}
                            onChange={(_, d) => setUsername(d.value)}
                            placeholder="输入用户名"
                            style={{ width: "100%" }}
                        />
                        <div className="form-hint">用于账户登录与成员检索的账号名</div>
                    </div>
                </form>
            </div>

            {/* 条目 4：绑定邮箱 */}
            <div className="card" style={{ width: "100%", marginBottom: 0 }}>
                <form onSubmit={handleSaveEmail}>
                    <div className="card-title flex items-center justify-between gap-8">
                        <span className="flex items-center gap-8">
                            <Mail24Regular />
                            绑定邮箱
                        </span>
                        {isSuperAdmin && !isPending && (
                            <Button
                                appearance="primary"
                                size="small"
                                type="submit"
                                disabled={
                                    savingEmail ||
                                    !email.trim() ||
                                    email.trim() === (user?.email || "")
                                }
                            >
                                {savingEmail ? <Spinner size="tiny" /> : "保存绑定邮箱"}
                            </Button>
                        )}
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <Input
                            type="email"
                            value={email}
                            readOnly={!isSuperAdmin}
                            disabled={!isSuperAdmin}
                            onChange={(_, d) => {
                                if (isSuperAdmin) setEmail(d.value);
                            }}
                            placeholder="输入绑定邮箱"
                            style={{ width: "100%" }}
                        />
                        <div className="form-hint">
                            {isSuperAdmin
                                ? "用于接收系统通知与找回密码的电子邮箱地址"
                                : "绑定邮箱不支持自行修改，如需变更请联系超级管理员"}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
