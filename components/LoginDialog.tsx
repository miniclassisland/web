"use client";

/**
 * 401 内联登录对话框。
 *
 * Token 失效时覆盖在当前页面上方，保留用户上下文。
 * 重新登录成功后自动关闭，页面数据可通过 retry 自动刷新。
 */

import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { twoFA } from "@/lib/api";
import {
    Dialog,
    DialogSurface,
    DialogTitle,
    DialogBody,
    DialogContent,
    DialogActions,
    Button, Input, Label, Spinner,
    MessageBar, MessageBarBody,
} from "@fluentui/react-components";

export default function LoginDialog() {
    const { requireReAuth, handleReAuth, dismissReAuth, pending2FA, complete2FA, loading, error, clearError } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [totpCode, setTotpCode] = useState("");
    const [twoFALoading, setTwoFALoading] = useState(false);
    const [twoFAError, setTwoFAError] = useState<string | null>(null);

    // We keep dialog rendered but closed when not needed, so state is maintained or we can conditionally render it.
    // However, conditional rendering is better to reset state on unmount.
    if (!requireReAuth) return null;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        clearError();
        await handleReAuth({ email, password });
    }

    async function handle2FAVerify(e: React.FormEvent) {
        e.preventDefault();
        if (!pending2FA) return;
        setTwoFALoading(true);
        setTwoFAError(null);
        try {
            const result = await twoFA.verify({
                temp_token: pending2FA.temp_token,
                code: totpCode,
            });
            if (result && typeof result === "object" && "token" in result) {
                complete2FA((result as { token: string }).token);
            }
        } catch (err: unknown) {
            setTwoFAError(err instanceof Error ? err.message : "验证失败");
        } finally {
            setTwoFALoading(false);
        }
    }

    return (
        <Dialog open={requireReAuth} modalType="alert">
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>会话已过期或权限不足</DialogTitle>
                    <DialogContent style={{ display: "flex", flexDirection: "column", gap: "16px", paddingTop: "8px" }}>
                        <div style={{ color: "var(--colorNeutralForeground2)" }}>
                            请重新登录以继续操作。
                        </div>
                        {pending2FA ? (
                            <form id="reauth-form" onSubmit={handle2FAVerify} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                <div>
                                    <Label htmlFor="reauth-totp" style={{ marginBottom: "4px", display: "block" }}>两步验证码</Label>
                                    <Input
                                        id="reauth-totp"
                                        value={totpCode}
                                        onChange={(_, d) => setTotpCode(d.value)}
                                        placeholder="请输入 6 位验证码"
                                        style={{ width: "100%" }}
                                        autoFocus
                                    />
                                </div>
                                {twoFAError && (
                                    <MessageBar intent="error">
                                        <MessageBarBody>{twoFAError}</MessageBarBody>
                                    </MessageBar>
                                )}
                            </form>
                        ) : (
                            <form id="reauth-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                <div>
                                    <Label htmlFor="reauth-email" style={{ marginBottom: "4px", display: "block" }}>邮箱</Label>
                                    <Input
                                        id="reauth-email"
                                        type="email"
                                        value={email}
                                        onChange={(_, d) => setEmail(d.value)}
                                        placeholder="user@example.com"
                                        style={{ width: "100%" }}
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="reauth-password" style={{ marginBottom: "4px", display: "block" }}>密码</Label>
                                    <Input
                                        id="reauth-password"
                                        type="password"
                                        value={password}
                                        onChange={(_, d) => setPassword(d.value)}
                                        placeholder="请输入密码"
                                        style={{ width: "100%" }}
                                    />
                                </div>
                                {error && (
                                    <MessageBar intent="error">
                                        <MessageBarBody>{error}</MessageBarBody>
                                    </MessageBar>
                                )}
                            </form>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button appearance="subtle" onClick={dismissReAuth}>
                            退出
                        </Button>
                        <Button
                            appearance="primary"
                            type="submit"
                            form="reauth-form"
                            disabled={pending2FA ? (twoFALoading || !totpCode) : (loading || !email || !password)}
                        >
                            {loading || twoFALoading ? <Spinner size="tiny" /> : (pending2FA ? "验证" : "重新登录")}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
}
