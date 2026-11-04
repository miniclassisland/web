"use client";

import React, { useState, useEffect, useRef } from "react";
import { twoFA, userInfo } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { TotpEnableResponse } from "@/lib/types";
import {
    Button, Input, Spinner,
    MessageBar, MessageBarBody,
} from "@fluentui/react-components";
import QRCode from "qrcode";
import { ShieldKeyhole24Regular, Person24Regular, Key24Regular } from "@fluentui/react-icons";

function QRCodeImage({ text }: { text: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (canvasRef.current) {
            QRCode.toCanvas(
                canvasRef.current,
                text,
                {
                    width: 180,
                    margin: 2,
                    color: {
                        dark: "#000000",
                        light: "#ffffff",
                    },
                },
                (error) => {
                    if (error) console.error("QR Code generation error:", error);
                }
            );
        }
    }, [text]);

    return (
        <div style={{ display: "flex", justifyContent: "center", margin: "16px 0" }}>
            <canvas
                ref={canvasRef}
                style={{
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                }}
            />
        </div>
    );
}

export default function SecurityPage() {
    const { user, refreshUser } = useAuth();
    const [step, setStep] = useState<"idle" | "setup" | "confirm" | "disable">("idle");
    const [setupData, setSetupData] = useState<TotpEnableResponse | null>(null);
    const [confirmCode, setConfirmCode] = useState("");
    const [disablePassword, setDisablePassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // 个人资料与密码修改
    const [displayName, setDisplayName] = useState("");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");

    useEffect(() => {
        if (user) {
            setDisplayName(user.display_name || "");
            setUsername(user.username || "");
            setEmail(user.email || "");
        }
    }, [user]);

    async function handleSaveProfile(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setMsg(null);
        try {
            if (displayName.trim() && displayName !== user?.display_name) {
                await userInfo.changeDisplayName({ display_name: displayName.trim() });
            }
            if (username.trim() && username !== user?.username) {
                await userInfo.changeUsername({ username: username.trim() });
            }
            if (email.trim() && email !== user?.email) {
                await userInfo.changeEmail({ email: email.trim() });
            }
            await refreshUser();
            setMsg({ type: "success", text: "个人资料已更新" });
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "更新失败" });
        }
        setLoading(false);
    }

    async function handleChangePassword(e: React.FormEvent) {
        e.preventDefault();
        if (!oldPassword || !newPassword) return;
        setLoading(true);
        setMsg(null);
        try {
            await userInfo.changePassword({ old_password: oldPassword, new_password: newPassword });
            setOldPassword("");
            setNewPassword("");
            setMsg({ type: "success", text: "密码修改成功" });
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "密码修改失败" });
        }
        setLoading(false);
    }

    async function handleEnable() {
        setLoading(true);
        setMsg(null);
        try {
            const res = await twoFA.enable();
            setSetupData(res);
            setStep("setup");
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "启用失败" });
        }
        setLoading(false);
    }

    async function handleConfirm() {
        setLoading(true);
        setMsg(null);
        try {
            await twoFA.confirm({ code: confirmCode });
            setMsg({ type: "success", text: "两步验证已成功启用！请妥善保管恢复码。" });
            setStep("idle");
            setSetupData(null);
            setConfirmCode("");
            await refreshUser();
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "确认失败" });
        }
        setLoading(false);
    }

    async function handleDisable() {
        setLoading(true);
        setMsg(null);
        try {
            await twoFA.disable({ password: disablePassword });
            setMsg({ type: "success", text: "两步验证已禁用" });
            setStep("idle");
            setDisablePassword("");
            await refreshUser();
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "禁用失败" });
        }
        setLoading(false);
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">个人资料与安全设置</h1>
                    <p className="page-subtitle">管理您的个人账号信息、登录密码与两步验证 (2FA)</p>
                </div>
            </div>

            {msg && (
                <MessageBar intent={msg.type} style={{ marginBottom: 16 }}>
                    <MessageBarBody>{msg.text}</MessageBarBody>
                </MessageBar>
            )}

            <div className="grid-2">
                {/* 个人资料卡片 */}
                <div className="card">
                    <div className="card-title flex items-center gap-8">
                        <Person24Regular />
                        个人资料
                    </div>
                    <form onSubmit={handleSaveProfile}>
                        <div className="form-group">
                            <label className="form-label">显示名称</label>
                            <Input
                                value={displayName}
                                onChange={(_, d) => setDisplayName(d.value)}
                                style={{ width: "100%" }}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">用户名</label>
                            <Input
                                value={username}
                                onChange={(_, d) => setUsername(d.value)}
                                style={{ width: "100%" }}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">绑定邮箱</label>
                            <Input
                                type="email"
                                value={email}
                                onChange={(_, d) => setEmail(d.value)}
                                style={{ width: "100%" }}
                            />
                        </div>
                        <Button appearance="primary" type="submit" disabled={loading}>
                            保存资料修改
                        </Button>
                    </form>
                </div>

                {/* 修改密码卡片 */}
                <div className="card">
                    <div className="card-title flex items-center gap-8">
                        <Key24Regular />
                        修改登录密码
                    </div>
                    <form onSubmit={handleChangePassword}>
                        <div className="form-group">
                            <label className="form-label">当前密码</label>
                            <Input
                                type="password"
                                value={oldPassword}
                                onChange={(_, d) => setOldPassword(d.value)}
                                style={{ width: "100%" }}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">新密码（至少 12 位）</label>
                            <Input
                                type="password"
                                value={newPassword}
                                onChange={(_, d) => setNewPassword(d.value)}
                                placeholder="至少 12 个字符"
                                style={{ width: "100%" }}
                            />
                        </div>
                        <Button
                            appearance="primary"
                            type="submit"
                            disabled={loading || !oldPassword || newPassword.length < 12}
                        >
                            更新密码
                        </Button>
                    </form>
                </div>
            </div>

            {/* 2FA 卡片 */}
            <div className="card">
                <div className="flex items-center justify-between mb-12">
                    <div className="card-title flex items-center gap-8" style={{ margin: 0 }}>
                        <ShieldKeyhole24Regular />
                        两步验证 (TOTP)
                    </div>
                    <span className={`badge ${user?.totp_enabled ? "badge-success" : "badge-warning"}`}>
                        {user?.totp_enabled ? "已启用 2FA" : "未启用"}
                    </span>
                </div>

                {step === "idle" && (
                    <div className="flex gap-12">
                        <Button appearance="primary" onClick={handleEnable} disabled={loading}>
                            {loading ? <Spinner size="tiny" /> : user?.totp_enabled ? "重新配置两步验证" : "启用两步验证"}
                        </Button>
                        {user?.totp_enabled && (
                            <Button appearance="secondary" onClick={() => setStep("disable")}>
                                禁用两步验证
                            </Button>
                        )}
                    </div>
                )}

                {step === "setup" && setupData && (
                    <div>
                        <div className="settings-section">
                            <div className="settings-section-title">1. 扫描二维码或手动输入密钥</div>
                            <QRCodeImage text={setupData.uri} />
                            <div className="form-group">
                                <label className="form-label">TOTP URI</label>
                                <Input
                                    value={setupData.uri}
                                    readOnly
                                    style={{ width: "100%", fontFamily: "var(--font-mono)", fontSize: 12 }}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">密钥 (Secret)</label>
                                <Input
                                    value={setupData.secret}
                                    readOnly
                                    style={{ width: "100%", fontFamily: "var(--font-mono)", letterSpacing: 2 }}
                                />
                                <div className="form-hint">
                                    请将此密钥添加到您的身份验证器应用（如 Google Authenticator、Microsoft Authenticator、Authy）
                                </div>
                            </div>
                        </div>

                        <div className="settings-section">
                            <div className="settings-section-title">2. 备份恢复码</div>
                            <div className="card warning-banner-card">
                                <p className="warning-banner-title">
                                    请妥善保管以下恢复码，每个恢复码只能使用一次
                                </p>
                                <div className="recovery-codes-grid">
                                    {setupData.recovery_codes.map((code, i) => (
                                        <div key={i} className="recovery-code-item">
                                            {code}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="settings-section">
                            <div className="settings-section-title">3. 输入验证码确认</div>
                            <div className="flex items-center gap-12">
                                <Input
                                    value={confirmCode}
                                    onChange={(_, d) => setConfirmCode(d.value)}
                                    placeholder="6 位动态验证码"
                                    style={{ width: 200 }}
                                />
                                <Button
                                    appearance="primary"
                                    onClick={handleConfirm}
                                    disabled={loading || confirmCode.length < 6}
                                >
                                    {loading ? <Spinner size="tiny" /> : "确认启用"}
                                </Button>
                                <Button
                                    appearance="secondary"
                                    onClick={() => {
                                        setStep("idle");
                                        setSetupData(null);
                                    }}
                                >
                                    取消
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {step === "disable" && (
                    <div>
                        <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
                            禁用两步验证需要验证当前账户密码。
                        </p>
                        <div className="flex items-center gap-12">
                            <Input
                                type="password"
                                value={disablePassword}
                                onChange={(_, d) => setDisablePassword(d.value)}
                                placeholder="请输入当前密码"
                                style={{ width: 300 }}
                            />
                            <Button
                                appearance="primary"
                                onClick={handleDisable}
                                disabled={loading || !disablePassword}
                                style={{ background: "var(--danger-color)" }}
                            >
                                {loading ? <Spinner size="tiny" /> : "禁用 2FA"}
                            </Button>
                            <Button appearance="secondary" onClick={() => setStep("idle")}>
                                取消
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
