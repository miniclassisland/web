"use client";

import React, { useEffect, useState } from "react";
import {
    Button,
    Dialog,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    MessageBar,
    MessageBarBody,
    Spinner,
} from "@fluentui/react-components";
import { Checkmark16Regular, Copy16Regular } from "@fluentui/react-icons";
import TurnstileWidget from "./TurnstileWidget";
import { community } from "@/lib/api";

const QQ_GROUP_URL = "https://qm.qq.com/q/4AsF0S1UNa";

export default function CommunityJoinLink() {
    const [open, setOpen] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState("");
    const [resetKey, setResetKey] = useState(0);
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!open || !turnstileToken || code) return;
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
    }, [open, turnstileToken, code]);

    function openDialog() {
        setOpen(true);
        setTurnstileToken("");
        setResetKey((key) => key + 1);
        setCode("");
        setLoading(false);
        setError("");
        setCopied(false);
    }

    function closeDialog() {
        setOpen(false);
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

    return (
        <>
            <button
                type="button"
                onClick={openDialog}
                style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "var(--accent-color)",
                    fontSize: 11,
                    cursor: "pointer",
                }}
            >
                加入交流群
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

                            {loading && (
                                <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}>
                                    <Spinner label="正在获取入群密码..." />
                                </div>
                            )}

                            {!code && !loading && !turnstileToken && (
                                <>
                                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
                                        完成人机验证后显示 QQ 群入群密码。
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

                            {code && (
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
