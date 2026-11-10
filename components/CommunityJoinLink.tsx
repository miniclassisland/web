"use client";

import React, { useEffect, useState } from "react";
import {
    Button,
    Dialog,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    Spinner,
} from "@fluentui/react-components";
import { MessageBar, MessageBarBody } from "@/components/ToastMessageBar";
import { Checkmark16Regular, Copy16Regular } from "@fluentui/react-icons";
import TurnstileWidget from "./TurnstileWidget";
import { community } from "@/lib/api";
import type { CommunityStatusResponse } from "@/lib/types";

const QQ_GROUP_URL = "https://qm.qq.com/q/4AsF0S1UNa";

export default function CommunityJoinLink() {
    const [open, setOpen] = useState(false);
    const [statusLoading, setStatusLoading] = useState(false);
    const [communityStatus, setCommunityStatus] = useState<CommunityStatusResponse | null>(null);
    const [turnstileToken, setTurnstileToken] = useState("");
    const [resetKey, setResetKey] = useState(0);
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setStatusLoading(true);
        setError("");
        community
            .getStatus()
            .then((res) => {
                if (!cancelled) setCommunityStatus(res);
            })
            .catch(() => {
                if (!cancelled) setCommunityStatus(null);
            })
            .finally(() => {
                if (!cancelled) setStatusLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [open]);

    useEffect(() => {
        if (!open || !turnstileToken || code || communityStatus?.bound) return;
        let cancelled = false;
        setLoading(true);
        setError("");
        community
            .getCode(turnstileToken)
            .then((res) => {
                if (!cancelled) setCode(res.code);
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : "获取入群密码失败");
                setTurnstileToken("");
                setResetKey((key) => key + 1);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [open, turnstileToken, code, communityStatus?.bound]);

    function openDialog() {
        setOpen(true);
        setCommunityStatus(null);
        setTurnstileToken("");
        setResetKey((key) => key + 1);
        setCode("");
        setLoading(false);
        setError("");
        setCopied(false);
    }

    function closeDialog() {
        setOpen(false);
        setCommunityStatus(null);
        setTurnstileToken("");
        setCode("");
        setError("");
        setCopied(false);
    }

    async function copyCode() {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            setError("复制失败，请手动选中文本复制");
        }
    }

    const maskedQq = communityStatus?.qq_masked || communityStatus?.masked_qq || "";
    const isManualPending = Boolean(
        communityStatus?.bound &&
        (communityStatus.status === "manual_pending" || (communityStatus.is_manual && !communityStatus.is_joined))
    );
    const isAlreadyBoundJoined = Boolean(communityStatus?.bound && !isManualPending);

    return (
        <>
            <button
                type="button"
                onClick={openDialog}
                className="sidebar-footer-link"
            >
                加入社区
            </button>

            <Dialog
                open={open}
                onOpenChange={(_, data) => {
                    if (data.open) setOpen(true);
                    else closeDialog();
                }}
            >
                <DialogSurface style={{ maxWidth: 420 }}>
                    <DialogBody>
                        <DialogTitle>加入交流社区</DialogTitle>
                        <DialogContent>
                            {error && (
                                <MessageBar intent="error" style={{ marginBottom: 12 }}>
                                    <MessageBarBody>{error}</MessageBarBody>
                                </MessageBar>
                            )}

                            {(statusLoading || loading) && (
                                <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}>
                                    <Spinner label={statusLoading ? "正在检查绑定状态..." : "正在获取入群密码..."} />
                                </div>
                            )}

                            {!statusLoading && isManualPending && (
                                <div>
                                    <MessageBar intent="info" style={{ marginBottom: 12 }}>
                                        <MessageBarBody>
                                            管理员已经将您的用户绑定到了 QQ（{maskedQq}），您可以直接使用这个号码加入群聊
                                        </MessageBarBody>
                                    </MessageBar>
                                    <div style={{ marginTop: 12, textAlign: "center", fontSize: 12 }}>
                                        <a
                                            href={QQ_GROUP_URL}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ color: "var(--accent-color)" }}
                                        >
                                            点击加入 QQ 群
                                        </a>
                                    </div>
                                </div>
                            )}

                            {!statusLoading && isAlreadyBoundJoined && (
                                <div>
                                    {maskedQq && (
                                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
                                            当前已绑定 QQ：<strong style={{ fontFamily: "var(--font-mono)" }}>{maskedQq}</strong>
                                        </div>
                                    )}
                                    <MessageBar inline intent="warning" style={{ marginBottom: 8 }}>
                                        <MessageBarBody>
                                            您已经绑定过一个 QQ 了，如果需要换绑，请直接退出群聊；如果需要继续加入群聊，您可以考虑新注册一个用户或者联系管理员
                                        </MessageBarBody>
                                    </MessageBar>
                                </div>
                            )}

                            {!statusLoading && !communityStatus?.bound && !code && !loading && !turnstileToken && (
                                <>
                                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
                                        密码有效期 15 分钟。加入后将自动绑定您的 QQ 到本用户
                                    </div>
                                    <TurnstileWidget
                                        action="community_code"
                                        resetKey={resetKey}
                                        onVerify={(token) => {
                                            setError("");
                                            setTurnstileToken(token);
                                        }}
                                    />
                                </>
                            )}

                            {!statusLoading && !communityStatus?.bound && code && (
                                <div>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            padding: "10px 12px",
                                            background: "var(--bg-subtle)",
                                            border: "1px solid var(--border-color)",
                                            borderRadius: 8,
                                        }}
                                    >
                                        <code
                                            style={{
                                                flex: 1,
                                                fontFamily: "var(--font-mono)",
                                                fontSize: 14,
                                                whiteSpace: "pre-wrap",
                                                wordBreak: "break-all",
                                            }}
                                        >
                                            {code}
                                        </code>
                                        <Button
                                            appearance="subtle"
                                            icon={copied ? <Checkmark16Regular /> : <Copy16Regular />}
                                            onClick={copyCode}
                                            aria-label={copied ? "已复制入群密码" : "复制入群密码"}
                                        />
                                    </div>
                                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                                        密码有效期 15 分钟。加入后将自动绑定您的 QQ 到本用户
                                    </div>
                                    <div style={{ marginTop: 12, textAlign: "center", fontSize: 12 }}>
                                        <a
                                            href={QQ_GROUP_URL}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ color: "var(--accent-color)" }}
                                        >
                                            点击加入 QQ 群
                                        </a>
                                    </div>
                                </div>
                            )}
                        </DialogContent>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </>
    );
}
