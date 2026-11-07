"use client";

import React, { useState, useEffect, useRef } from "react";
import { twoFA, userInfo, invitations } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useAccount } from "@/lib/account-context";
import { useRouter } from "next/navigation";
import type { TotpEnableResponse, TotpDisableRequest } from "@/lib/types";
import {
    Button, Input, Spinner,
    MessageBar, MessageBarBody,
} from "@fluentui/react-components";
import { Select } from "@/components/CustomSelect";
import QRCode from "qrcode";
import { ShieldKeyhole24Regular, Person24Regular, Key24Regular, PeopleAdd24Regular, Copy24Regular } from "@fluentui/react-icons";

type DisableMode = "pwd_totp" | "pwd_recovery" | "totp_recovery" | "two_recovery";

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
    const { user, isSuperAdmin, refreshUser } = useAuth();
    const { refreshAccounts, switchAccount } = useAccount();
    const router = useRouter();
    const [step, setStep] = useState<"idle" | "setup" | "confirm" | "disable">("idle");
    const [setupData, setSetupData] = useState<TotpEnableResponse | null>(null);
    const [confirmCode, setConfirmCode] = useState("");
    const [disableMode, setDisableMode] = useState<DisableMode>("pwd_totp");
    const [disablePassword, setDisablePassword] = useState("");
    const [disableTotpCode, setDisableTotpCode] = useState("");
    const [disableRecoveryCode1, setDisableRecoveryCode1] = useState("");
    const [disableRecoveryCode2, setDisableRecoveryCode2] = useState("");
    const [resetPromptTriggered, setResetPromptTriggered] = useState(false);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);

    // 个人资料与密码修改
    const [displayName, setDisplayName] = useState("");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");

    // 使用邀请码加入账户
    const [inviteCode, setInviteCode] = useState("");
    const [joining, setJoining] = useState(false);

    async function handleJoinByCode(e: React.FormEvent) {
        e.preventDefault();
        if (!inviteCode.trim()) return;
        setJoining(true);
        setMsg(null);
        try {
            const res = await invitations.accept(inviteCode.trim());
            await refreshAccounts();
            setInviteCode("");
            switchAccount(res.account_id);
            router.push("/dashboard");
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "加入账户失败" });
        } finally {
            setJoining(false);
        }
    }

    useEffect(() => {
        if (user) {
            setDisplayName(user.display_name || "");
            setUsername(user.username || "");
            setEmail(user.email || "");
        }
    }, [user]);

    useEffect(() => {
        if (typeof window === "undefined" || resetPromptTriggered) return;
        const params = new URLSearchParams(window.location.search);
        const fromQuery = params.get("reset_totp") === "1";
        let fromStorage = false;
        try {
            fromStorage = sessionStorage.getItem("miniclassisland_force_reset_totp") === "1";
            if (fromStorage) {
                sessionStorage.removeItem("miniclassisland_force_reset_totp");
            }
        } catch { /* ignore */ }
        if (fromQuery || fromStorage) {
            setResetPromptTriggered(true);
            setMsg({
                type: "warning",
                text: "您刚刚使用了倒数第二个（或最后一个）有效恢复码登录账户。为防止账户锁定，系统已为您开启两步验证 (TOTP) 重置向导，请立即重新绑定身份验证器并备份新的恢复码！",
            });
            void (async () => {
                setLoading(true);
                try {
                    const res = await twoFA.enable(true);
                    setSetupData(res);
                    setStep("setup");
                } catch (err: unknown) {
                    setMsg({ type: "error", text: err instanceof Error ? err.message : "开启 TOTP 重置向导失败" });
                } finally {
                    setLoading(false);
                }
            })();
        }
    }, [resetPromptTriggered]);

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
            if (isSuperAdmin && email.trim() && email !== user?.email) {
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
            const res = await twoFA.enable(Boolean(user?.totp_enabled));
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

    function canSubmitDisable(): boolean {
        if (disableMode === "pwd_totp") {
            return Boolean(disablePassword && disableTotpCode.trim().length >= 6);
        }
        if (disableMode === "pwd_recovery") {
            return Boolean(disablePassword && disableRecoveryCode1.trim());
        }
        if (disableMode === "totp_recovery") {
            return Boolean(disableTotpCode.trim().length >= 6 && disableRecoveryCode1.trim());
        }
        if (disableMode === "two_recovery") {
            const c1 = disableRecoveryCode1.trim().toUpperCase();
            const c2 = disableRecoveryCode2.trim().toUpperCase();
            return Boolean(c1 && c2 && c1 !== c2);
        }
        return false;
    }

    async function handleDisable() {
        setLoading(true);
        setMsg(null);
        try {
            const payload: TotpDisableRequest = {};
            if (disableMode === "pwd_totp") {
                payload.password = disablePassword;
                payload.totp_code = disableTotpCode.trim();
            } else if (disableMode === "pwd_recovery") {
                payload.password = disablePassword;
                payload.recovery_code = disableRecoveryCode1.trim();
            } else if (disableMode === "totp_recovery") {
                payload.totp_code = disableTotpCode.trim();
                payload.recovery_code = disableRecoveryCode1.trim();
            } else if (disableMode === "two_recovery") {
                payload.recovery_code = disableRecoveryCode1.trim();
                payload.second_recovery_code = disableRecoveryCode2.trim();
                payload.recovery_codes = [disableRecoveryCode1.trim(), disableRecoveryCode2.trim()];
            }
            await twoFA.disable(payload);
            setMsg({ type: "success", text: "两步验证已禁用" });
            setStep("idle");
            setDisablePassword("");
            setDisableTotpCode("");
            setDisableRecoveryCode1("");
            setDisableRecoveryCode2("");
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
                            <label className="form-label">用户 ID (UUID)</label>
                            <div className="flex items-center gap-8">
                                <Input
                                    value={user?.id || ""}
                                    readOnly
                                    disabled
                                    style={{ flex: 1, fontFamily: "var(--font-mono)" }}
                                />
                                {user?.id && (
                                    <Button
                                        appearance="subtle"
                                        size="small"
                                        type="button"
                                        icon={<Copy24Regular />}
                                        onClick={() => {
                                            navigator.clipboard.writeText(user.id);
                                            setMsg({ type: "success", text: "用户 UUID 已复制到剪贴板" });
                                        }}
                                    >
                                        复制
                                    </Button>
                                )}
                            </div>
                            <div className="form-hint">用户唯一标识 (UUID) 在生成时已锁定，不可修改</div>
                        </div>
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
                                readOnly={!isSuperAdmin}
                                disabled={!isSuperAdmin}
                                onChange={(_, d) => {
                                    if (isSuperAdmin) setEmail(d.value);
                                }}
                                style={{ width: "100%" }}
                            />
                            {!isSuperAdmin && (
                                <div className="form-hint">
                                    绑定邮箱不支持自行修改，如需变更请联系超级管理员
                                </div>
                            )}
                        </div>
                        <div className="form-group">
                            <label className="form-label">绑定 QQ (交流群)</label>
                            <Input
                                value={
                                    user?.bound_qq_masked
                                        ? `${user.bound_qq_masked}${
                                              user.qq_bound_manual && user.qq_joined_group === false
                                                  ? "（管理员已绑定，待加入群聊）"
                                                  : "（已绑定）"
                                          }`
                                        : "未绑定"
                                }
                                readOnly
                                disabled
                                style={{ width: "100%", fontFamily: "var(--font-mono)" }}
                            />
                            <div className="form-hint">
                                {user?.bound_qq_masked
                                    ? "不支持手动解绑；如需换绑请直接退出交流群，或联系超级管理员"
                                    : "可通过主页底部「加入交流群」获取入群密码并自动绑定"}
                            </div>
                        </div>
                        {user?.role_code !== "pending" && (
                            <Button appearance="primary" type="submit" disabled={loading}>
                                保存资料修改
                            </Button>
                        )}
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

            {/* 使用邀请码加入账户卡片 */}
            <div className="card">
                <div className="card-title flex items-center gap-8">
                    <PeopleAdd24Regular />
                    使用邀请码加入集控账户
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
                    如果您收到了其他组织或学校的集控账户邀请码，可在此输入邀请码加入该账户中心。
                </p>
                <form onSubmit={handleJoinByCode} className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                    <Input
                        value={inviteCode}
                        onChange={(_, d) => setInviteCode(d.value)}
                        placeholder="请输入邀请码..."
                        style={{ width: 320, maxWidth: "100%" }}
                    />
                    <Button
                        appearance="primary"
                        type="submit"
                        disabled={joining || !inviteCode.trim()}
                    >
                        {joining ? <Spinner size="tiny" /> : "加入账户"}
                    </Button>
                </form>
            </div>

            {/* 2FA 卡片 */}
            <div className="card">
                <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
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
                        <p style={{ marginBottom: 12, color: "var(--text-secondary)", fontSize: 13 }}>
                            禁用两步验证需要完成双重凭证校验，请选择以下任一组合：
                        </p>
                        <div className="form-group" style={{ maxWidth: 420 }}>
                            <label className="form-label">验证方式</label>
                            <Select
                                value={disableMode}
                                onChange={(_, d) => setDisableMode(d.value as DisableMode)}
                            >
                                <option value="pwd_totp">账户密码 + 1 个 TOTP 动态验证码</option>
                                <option value="pwd_recovery">账户密码 + 1 个有效恢复码</option>
                                <option value="totp_recovery">1 个 TOTP 动态验证码 + 1 个有效恢复码</option>
                                <option value="two_recovery">2 个不同的有效恢复码</option>
                            </Select>
                        </div>

                        {(disableMode === "pwd_totp" || disableMode === "pwd_recovery") && (
                            <div className="form-group" style={{ maxWidth: 420 }}>
                                <label className="form-label">当前账户密码</label>
                                <Input
                                    type="password"
                                    value={disablePassword}
                                    onChange={(_, d) => setDisablePassword(d.value)}
                                    placeholder="请输入当前登录密码"
                                    style={{ width: "100%" }}
                                />
                            </div>
                        )}

                        {(disableMode === "pwd_totp" || disableMode === "totp_recovery") && (
                            <div className="form-group" style={{ maxWidth: 420 }}>
                                <label className="form-label">TOTP 动态验证码 (6 位)</label>
                                <Input
                                    value={disableTotpCode}
                                    onChange={(_, d) => setDisableTotpCode(d.value)}
                                    placeholder="请输入 6 位动态验证码"
                                    style={{ width: "100%" }}
                                />
                            </div>
                        )}

                        {(disableMode === "pwd_recovery" || disableMode === "totp_recovery" || disableMode === "two_recovery") && (
                            <div className="form-group" style={{ maxWidth: 420 }}>
                                <label className="form-label">
                                    {disableMode === "two_recovery" ? "第 1 个有效恢复码" : "有效恢复码"}
                                </label>
                                <Input
                                    value={disableRecoveryCode1}
                                    onChange={(_, d) => setDisableRecoveryCode1(d.value)}
                                    placeholder="请输入未使用的恢复码"
                                    style={{ width: "100%" }}
                                />
                            </div>
                        )}

                        {disableMode === "two_recovery" && (
                            <div className="form-group" style={{ maxWidth: 420 }}>
                                <label className="form-label">第 2 个有效恢复码（需与第 1 个不同）</label>
                                <Input
                                    value={disableRecoveryCode2}
                                    onChange={(_, d) => setDisableRecoveryCode2(d.value)}
                                    placeholder="请输入另一个未使用的恢复码"
                                    style={{ width: "100%" }}
                                />
                            </div>
                        )}

                        <div className="flex items-center gap-12" style={{ marginTop: 12 }}>
                            <Button
                                appearance="primary"
                                onClick={handleDisable}
                                disabled={loading || !canSubmitDisable()}
                                style={{ background: "var(--danger-color)" }}
                            >
                                {loading ? <Spinner size="tiny" /> : "确认禁用 2FA"}
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
