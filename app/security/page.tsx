"use client";

import React, { useState, useEffect, useRef } from "react";
import { twoFA, userInfo } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type {
    TotpEnableResponse,
    TotpDisableRequest,
    CertificateIssueResponse,
    LoginCertificateItem,
} from "@/lib/types";
import {
    Button, Input, Spinner,
} from "@fluentui/react-components";
import { MessageBar, MessageBarBody } from "@/components/ToastMessageBar";
import { Select } from "@/components/CustomSelect";
import QRCode from "qrcode";
import {
    ShieldKeyhole24Regular,
    Key24Regular,
    Copy24Regular,
    Certificate24Regular,
    QrCode24Regular,
    Open24Regular,
    Delete24Regular,
} from "@fluentui/react-icons";

type DisableMode = "pwd_totp" | "pwd_recovery" | "totp_recovery" | "two_recovery";

function QRCodeImage({ text, onCopy }: { text: string; onCopy?: () => void }) {
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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "16px 0", gap: 6 }}>
            <canvas
                ref={canvasRef}
                title="点击复制二维码链接"
                onClick={() => {
                    navigator.clipboard.writeText(text);
                    onCopy?.();
                }}
                style={{
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                    cursor: "pointer",
                }}
            />
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>点击二维码可复制对应链接</span>
        </div>
    );
}

export default function SecurityPage() {
    const { user, refreshUser } = useAuth();
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

    // 密码修改
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");

    // 登录安全证书签发与管理
    const [certPassword, setCertPassword] = useState("");
    const [cert2faMode, setCert2faMode] = useState<"totp" | "recovery">("totp");
    const [certTotpCode, setCertTotpCode] = useState("");
    const [certRecoveryCode, setCertRecoveryCode] = useState("");
    const [certDeviceName, setCertDeviceName] = useState("");
    const [certIssuing, setCertIssuing] = useState(false);
    const [issuedCert, setIssuedCert] = useState<CertificateIssueResponse | null>(null);
    const [certCountdown, setCertCountdown] = useState<number>(0);
    const [activeCerts, setActiveCerts] = useState<LoginCertificateItem[]>([]);
    const [certsLoading, setCertsLoading] = useState(false);

    async function loadCertificates() {
        setCertsLoading(true);
        try {
            const res = await userInfo.listCertificates();
            setActiveCerts(res.items || []);
        } catch {
            // ignore
        } finally {
            setCertsLoading(false);
        }
    }

    useEffect(() => {
        if (user) {
            void loadCertificates();
        }
    }, [user]);

    useEffect(() => {
        if (!issuedCert || certCountdown <= 0) return;
        const timer = window.setInterval(() => {
            setCertCountdown((prev) => {
                if (prev <= 1) {
                    window.clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => window.clearInterval(timer);
    }, [issuedCert, certCountdown]);

    async function handleIssueCertificate(e: React.FormEvent) {
        e.preventDefault();
        if (!certPassword) return;
        if (user?.totp_enabled) {
            if (cert2faMode === "totp" && certTotpCode.trim().length < 6) return;
            if (cert2faMode === "recovery" && !certRecoveryCode.trim()) return;
        }
        setCertIssuing(true);
        setMsg(null);
        try {
            const res = await userInfo.issueCertificate({
                password: certPassword,
                totp_code: user?.totp_enabled && cert2faMode === "totp" ? certTotpCode.trim() : undefined,
                recovery_code: user?.totp_enabled && cert2faMode === "recovery" ? certRecoveryCode.trim() : undefined,
                device_name: certDeviceName.trim() || undefined,
            });
            setIssuedCert(res);
            setCertCountdown(res.expires_in || 300);
            setCertPassword("");
            setCertTotpCode("");
            setCertRecoveryCode("");
            setMsg({
                type: "success",
                text: "已签发有效期 7 天的登录安全证书，请在 5 分钟内使用移动端扫描二维码或打开唤醒链接完成兑换",
            });
            await loadCertificates();
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "签发登录安全证书失败" });
        } finally {
            setCertIssuing(false);
        }
    }

    async function handleRevokeCertificate(certId?: string, revokeAll = false) {
        setCertsLoading(true);
        setMsg(null);
        try {
            await userInfo.revokeCertificate(certId, revokeAll);
            if (revokeAll || (issuedCert && issuedCert.cert_id === certId)) {
                setIssuedCert(null);
                setCertCountdown(0);
            }
            setMsg({ type: "success", text: revokeAll ? "已吊销全部登录安全证书" : "已吊销该登录安全证书" });
            await loadCertificates();
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "吊销证书失败" });
        } finally {
            setCertsLoading(false);
        }
    }

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
                text: "您刚刚使用了倒数第二个或最后一个有效恢复码登录账户。为防止账户锁定，系统已为您开启两步验证重置向导，请立即重新绑定身份验证器并备份新的恢复码！",
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
                    <h1 className="page-title">安全设置</h1>
                    <p className="page-subtitle">管理您的登录密码、两步验证与移动端登录安全证书</p>
                </div>
            </div>

            {msg && (
                <MessageBar intent={msg.type} style={{ marginBottom: 16 }}>
                    <MessageBarBody>{msg.text}</MessageBarBody>
                </MessageBar>
            )}

            {/* 修改密码卡片 */}
            <div className="card" style={{ width: "100%" }}>
                <form onSubmit={handleChangePassword}>
                    <div className="card-title flex items-center justify-between gap-8">
                        <span className="flex items-center gap-8">
                            <Key24Regular />
                            修改登录密码
                        </span>
                        <Button
                            appearance="primary"
                            size="small"
                            type="submit"
                            disabled={loading || !oldPassword || newPassword.length < 12}
                        >
                            更新密码
                        </Button>
                    </div>
                    <div className="form-group">
                        <label className="form-label">当前密码</label>
                        <Input
                            type="password"
                            value={oldPassword}
                            onChange={(_, d) => setOldPassword(d.value)}
                            placeholder="请输入当前登录密码"
                            style={{ width: "100%" }}
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">新密码</label>
                        <Input
                            type="password"
                            value={newPassword}
                            onChange={(_, d) => setNewPassword(d.value)}
                            placeholder="至少 12 个字符"
                            style={{ width: "100%" }}
                        />
                    </div>
                </form>
            </div>

            {/* 2FA 卡片 */}
            <div className="card" style={{ width: "100%" }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                    <div className="card-title flex items-center gap-8" style={{ margin: 0 }}>
                        <ShieldKeyhole24Regular />
                        两步验证
                    </div>
                    <span className={`badge ${user?.totp_enabled ? "badge-success" : "badge-warning"}`}>
                        {user?.totp_enabled ? "已启用两步验证" : "未启用"}
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
                            <QRCodeImage
                                text={setupData.uri}
                                onCopy={() => setMsg({ type: "success", text: "验证链接已复制到剪贴板" })}
                            />
                            <div className="form-group">
                                <label className="form-label">验证链接</label>
                                <Input
                                    value={setupData.uri}
                                    readOnly
                                    style={{ width: "100%", fontFamily: "var(--font-mono)", fontSize: 12 }}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">密钥</label>
                                <Input
                                    value={setupData.secret}
                                    readOnly
                                    style={{ width: "100%", fontFamily: "var(--font-mono)", letterSpacing: 2 }}
                                />
                                <div className="form-hint">
                                    请将此密钥添加到您的身份验证器应用
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
                        <div className="form-group">
                            <label className="form-label">验证方式</label>
                            <Select
                                value={disableMode}
                                onChange={(_, d) => setDisableMode(d.value as DisableMode)}
                                style={{ width: "100%" }}
                            >
                                <option value="pwd_totp">账户密码 + 1 个 TOTP 动态验证码</option>
                                <option value="pwd_recovery">账户密码 + 1 个有效恢复码</option>
                                <option value="totp_recovery">1 个 TOTP 动态验证码 + 1 个有效恢复码</option>
                                <option value="two_recovery">2 个不同的有效恢复码</option>
                            </Select>
                        </div>

                        {(disableMode === "pwd_totp" || disableMode === "pwd_recovery") && (
                            <div className="form-group">
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
                            <div className="form-group">
                                <label className="form-label">动态验证码</label>
                                <Input
                                    value={disableTotpCode}
                                    onChange={(_, d) => setDisableTotpCode(d.value)}
                                    placeholder="请输入 6 位动态验证码"
                                    style={{ width: "100%" }}
                                />
                            </div>
                        )}

                        {(disableMode === "pwd_recovery" || disableMode === "totp_recovery" || disableMode === "two_recovery") && (
                            <div className="form-group">
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
                            <div className="form-group">
                                <label className="form-label">第 2 个有效恢复码</label>
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
                                {loading ? <Spinner size="tiny" /> : "确认禁用两步验证"}
                            </Button>
                            <Button appearance="secondary" onClick={() => setStep("idle")}>
                                取消
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* 登录安全证书卡片 */}
            <div className="card" style={{ width: "100%", marginBottom: 0 }}>
                <div className="flex items-center justify-between gap-8" style={{ marginBottom: 12, flexWrap: "wrap" }}>
                    <div className="card-title flex items-center gap-8" style={{ margin: 0 }}>
                        <Certificate24Regular />
                        移动端登录安全证书
                    </div>
                    <div className="flex items-center gap-8">
                        <span className="badge badge-info">有效期 7 天 · 最多轮换 12 代</span>
                        {activeCerts.length > 0 && (
                            <Button
                                appearance="subtle"
                                size="small"
                                icon={<Delete24Regular />}
                                onClick={() => void handleRevokeCertificate(undefined, true)}
                                disabled={certsLoading}
                            >
                                吊销全部证书
                            </Button>
                        )}
                    </div>
                </div>

                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                    验证当前账户密码{user?.totp_enabled ? "与两步验证凭证" : ""}后，可签发一张有效期为 7 天的移动端登录安全证书，并生成有效期 5 分钟的单次兑换码。移动端通过扫码或唤醒链接下载安全证书后，可使用安全证书自动申请不超过 1 小时的短期会话令牌，且在剩余有效期低于 24 小时时支持自动轮换下一代证书，单条证书链最多轮换 12 代。
                </p>

                <div className="grid-2" style={{ alignItems: "start" }}>
                    <form onSubmit={handleIssueCertificate}>
                        <div className="settings-section-title" style={{ marginBottom: 12 }}>
                            签发新安全证书
                        </div>
                        <div className="form-group">
                            <label className="form-label">设备备注名称</label>
                            <Input
                                value={certDeviceName}
                                onChange={(_, d) => setCertDeviceName(d.value)}
                                placeholder="输入移动设备备注名称"
                                style={{ width: "100%" }}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">当前账户密码</label>
                            <Input
                                type="password"
                                value={certPassword}
                                onChange={(_, d) => setCertPassword(d.value)}
                                placeholder="请输入当前登录密码"
                                style={{ width: "100%" }}
                            />
                        </div>

                        {user?.totp_enabled && (
                            <>
                                <div className="form-group">
                                    <label className="form-label">两步验证方式</label>
                                    <Select
                                        value={cert2faMode}
                                        onChange={(_, d) => setCert2faMode(d.value as "totp" | "recovery")}
                                    >
                                        <option value="totp">6 位动态验证码</option>
                                        <option value="recovery">一次性恢复码</option>
                                    </Select>
                                </div>
                                {cert2faMode === "totp" ? (
                                    <div className="form-group">
                                        <label className="form-label">动态验证码</label>
                                        <Input
                                            value={certTotpCode}
                                            onChange={(_, d) => setCertTotpCode(d.value)}
                                            placeholder="请输入 6 位动态验证码"
                                            style={{ width: "100%" }}
                                        />
                                    </div>
                                ) : (
                                    <div className="form-group">
                                        <label className="form-label">一次性恢复码</label>
                                        <Input
                                            value={certRecoveryCode}
                                            onChange={(_, d) => setCertRecoveryCode(d.value)}
                                            placeholder="请输入未使用的恢复码"
                                            style={{ width: "100%" }}
                                        />
                                    </div>
                                )}
                            </>
                        )}

                        <Button
                            appearance="primary"
                            type="submit"
                            icon={<QrCode24Regular />}
                            disabled={
                                certIssuing ||
                                !certPassword ||
                                (Boolean(user?.totp_enabled) &&
                                    ((cert2faMode === "totp" && certTotpCode.trim().length < 6) ||
                                        (cert2faMode === "recovery" && !certRecoveryCode.trim())))
                            }
                        >
                            {certIssuing ? <Spinner size="tiny" /> : "验证并签发安全证书"}
                        </Button>
                    </form>

                    <div>
                        <div className="settings-section-title" style={{ marginBottom: 12 }}>
                            扫码或唤醒链接兑换
                        </div>
                        {issuedCert && certCountdown > 0 ? (
                            <div
                                style={{
                                    padding: 16,
                                    borderRadius: "var(--radius-md)",
                                    border: "1px solid var(--border-color)",
                                    background: "var(--bg-secondary)",
                                }}
                            >
                                <div className="flex items-center justify-between gap-8" style={{ marginBottom: 8 }}>
                                    <span className="badge badge-success">兑换码有效</span>
                                    <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                                        剩余 {Math.floor(certCountdown / 60)}:{String(certCountdown % 60).padStart(2, "0")}
                                    </span>
                                </div>
                                <QRCodeImage
                                    text={issuedCert.deeplink}
                                    onCopy={() => setMsg({ type: "success", text: "唤醒链接已复制到剪贴板" })}
                                />
                                <div className="form-group" style={{ marginBottom: 10 }}>
                                    <label className="form-label">兑换唤醒链接</label>
                                    <div className="flex items-center gap-8">
                                        <Input
                                            value={issuedCert.deeplink}
                                            readOnly
                                            style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 12 }}
                                        />
                                        <Button
                                            appearance="subtle"
                                            size="small"
                                            type="button"
                                            icon={<Copy24Regular />}
                                            onClick={() => {
                                                navigator.clipboard.writeText(issuedCert.deeplink);
                                                setMsg({ type: "success", text: "唤醒链接已复制到剪贴板" });
                                            }}
                                        >
                                            复制
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                                    <Button
                                        appearance="primary"
                                        size="small"
                                        icon={<Open24Regular />}
                                        onClick={() => {
                                            window.location.href = issuedCert.deeplink;
                                        }}
                                    >
                                        在当前设备唤醒客户端兑换
                                    </Button>
                                    <Button
                                        appearance="secondary"
                                        size="small"
                                        icon={<Copy24Regular />}
                                        onClick={() => {
                                            navigator.clipboard.writeText(issuedCert.code);
                                            setMsg({ type: "success", text: "单次兑换码已复制到剪贴板" });
                                        }}
                                    >
                                        仅复制兑换码
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div
                                style={{
                                    padding: 24,
                                    borderRadius: "var(--radius-md)",
                                    border: "1px dashed var(--border-color)",
                                    color: "var(--text-secondary)",
                                    fontSize: 13,
                                    textAlign: "center",
                                }}
                            >
                                左侧完成密码校验并签发后，此处将生成有效期 5 分钟的二维码与唤醒链接
                            </div>
                        )}
                    </div>
                </div>

                {/* 已签发安全证书列表 */}
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border-color)" }}>
                    <div className="settings-section-title" style={{ marginBottom: 12 }}>
                        当前有效安全证书 ({activeCerts.length})
                    </div>
                    {activeCerts.length === 0 ? (
                        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                            暂无处于有效期内的登录安全证书
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {activeCerts.map((item) => (
                                <div
                                    key={item.cert_id}
                                    className="flex items-center justify-between gap-12"
                                    style={{
                                        padding: "10px 14px",
                                        borderRadius: "var(--radius-md)",
                                        border: "1px solid var(--border-color)",
                                        background: "var(--bg-secondary)",
                                        flexWrap: "wrap",
                                    }}
                                >
                                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                        <div className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                                            <span style={{ fontWeight: 600, fontSize: 13 }}>
                                                {item.device_name || "移动端安全证书"}
                                            </span>
                                            <span className="badge badge-info">
                                                第 {item.generation} / {item.max_generation} 代
                                            </span>
                                            <span className={`badge ${item.redeemed ? "badge-success" : "badge-warning"}`}>
                                                {item.redeemed ? "已兑换激活" : "待兑换"}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                            签发于 {new Date(item.issued_at * 1000).toLocaleString()} · 到期于{" "}
                                            {new Date(item.expires_at * 1000).toLocaleString()}
                                        </div>
                                    </div>
                                    <Button
                                        appearance="subtle"
                                        size="small"
                                        icon={<Delete24Regular />}
                                        onClick={() => void handleRevokeCertificate(item.cert_id)}
                                        disabled={certsLoading}
                                    >
                                        吊销
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
