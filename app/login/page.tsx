"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { auth as authApi, twoFA, token as tokenApi, ApiError } from "@/lib/api";
import {
    Button, Input, Label, Spinner,
    MessageBar, MessageBarBody,
} from "@fluentui/react-components";
import { QrCodeRegular, ArrowSyncRegular } from "@fluentui/react-icons";
import QRCode from "qrcode";
import Link from "next/link";
import SponsorBanner from "@/components/SponsorBanner";
import TurnstileWidget from "@/components/TurnstileWidget";

type AuthStep = "email" | "login" | "register" | "2fa" | "qr";

export default function LoginPage() {
    const { login, register, isAuthenticated, pending2FA, complete2FA, cancel2FA, loading: contextLoading, error: contextError, clearError, registerSuccess } = useAuth();
    const router = useRouter();

    const [step, setStep] = useState<AuthStep>("email");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [username, setUsername] = useState("");
    const [displayName, setDisplayName] = useState("");

    const [totpCode, setTotpCode] = useState("");
    const [recoveryMode, setRecoveryMode] = useState(false);
    const [recoveryCode, setRecoveryCode] = useState("");

    const [localLoading, setLocalLoading] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const [twoFAError, setTwoFAError] = useState<string | null>(null);
    const [twoFALoading, setTwoFALoading] = useState(false);
    const [sessionExpired, setSessionExpired] = useState(false);
    const [redirectTarget, setRedirectTarget] = useState("/");
    const [forceResetTotp, setForceResetTotp] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState("");
    const [turnstileResetKey, setTurnstileResetKey] = useState(0);

    const [qrCodeStr, setQrCodeStr] = useState("");
    const [qrDataUrl, setQrDataUrl] = useState("");
    const [qrLocalExpiresAtMs, setQrLocalExpiresAtMs] = useState(0);
    const [qrRemainingSec, setQrRemainingSec] = useState(0);
    const [qrLoading, setQrLoading] = useState(false);

    async function startQrLoginSession() {
        setLocalError(null);
        clearError();
        setQrLoading(true);
        try {
            const res = await tokenApi.createQrLogin();
            const ttlSec = Math.max(1, Number(res.expires_in) || 300);
            setQrCodeStr(res.code);
            setQrLocalExpiresAtMs(Date.now() + ttlSec * 1000);
            setQrRemainingSec(ttlSec);
            const dataUrl = await QRCode.toDataURL(res.deeplink, {
                width: 220,
                margin: 1,
            });
            setQrDataUrl(dataUrl);
            setStep("qr");
        } catch (err: unknown) {
            setLocalError(err instanceof Error ? err.message : "创建扫码登录会话失败");
        } finally {
            setQrLoading(false);
        }
    }

    useEffect(() => {
        if (step !== "qr" || !qrLocalExpiresAtMs) return;
        const tick = setInterval(() => {
            const rem = Math.max(0, Math.ceil((qrLocalExpiresAtMs - Date.now()) / 1000));
            setQrRemainingSec(rem);
            if (rem <= 0) {
                clearInterval(tick);
            }
        }, 1000);
        return () => clearInterval(tick);
    }, [step, qrLocalExpiresAtMs]);

    useEffect(() => {
        if (step !== "qr" || !qrCodeStr || !qrLocalExpiresAtMs) return;
        const pollTimer = setInterval(async () => {
            if (Date.now() >= qrLocalExpiresAtMs) {
                setQrRemainingSec(0);
                clearInterval(pollTimer);
                return;
            }
            try {
                const p = await tokenApi.pollQrLogin(qrCodeStr);
                if (p.status === "authorized" && p.token) {
                    clearInterval(pollTimer);
                    complete2FA(p.token);
                } else if (p.status === "expired") {
                    setQrRemainingSec(0);
                    clearInterval(pollTimer);
                }
            } catch {
                // ignore transient network errors during poll
            }
        }, 2000);
        return () => clearInterval(pollTimer);
    }, [step, qrCodeStr, qrLocalExpiresAtMs, complete2FA]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const fromQuery = params.get("expired") === "1";
            const rawRedirect = params.get("redirect");
            if (rawRedirect && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") && !rawRedirect.startsWith("/login")) {
                setRedirectTarget(rawRedirect);
            }
            let fromStorage = false;
            try {
                fromStorage = sessionStorage.getItem("miniclassisland_session_expired") === "1";
                if (fromStorage) {
                    sessionStorage.removeItem("miniclassisland_session_expired");
                }
            } catch { /* ignore */ }
            if (fromQuery || fromStorage) {
                setSessionExpired(true);
            }
        }
    }, []);

    useEffect(() => {
        if (pending2FA) setStep("2fa");
    }, [pending2FA]);

    useEffect(() => {
        if (isAuthenticated) {
            if (forceResetTotp) {
                router.push("/security?reset_totp=1");
            } else {
                router.push(redirectTarget || "/");
            }
        }
    }, [isAuthenticated, forceResetTotp, redirectTarget, router]);

    const loading = contextLoading || localLoading || twoFALoading;
    const error = localError || contextError || twoFAError;

    if (isAuthenticated) return null;

    async function handleEmailCheck(e: React.FormEvent) {
        e.preventDefault();
        setLocalError(null);
        clearError();
        if (!email) return;
        if (!turnstileToken) {
            setLocalError("请先完成 Turnstile 人机验证");
            return;
        }

        let autoFilledPassword = password;
        // 尝试从隐藏的占位密码输入框中继承浏览器自动填充的密码作为兜底
        if (typeof document !== "undefined") {
            const hiddenPwdInput = document.getElementById("placeholder-password") as HTMLInputElement | null;
            if (hiddenPwdInput && hiddenPwdInput.value) {
                autoFilledPassword = hiddenPwdInput.value;
                setPassword(autoFilledPassword);
            }
        }

        setLocalLoading(true);
        try {
            const res = await authApi.checkMailAvailability(email, turnstileToken) as { available?: boolean };
            if (res && res.available === false) {
                setStep("login");
            } else {
                setStep("register");
            }
        } catch (err: unknown) {
            // 不再盲目进入登录页，而是将 API 检查的真实报错反馈给用户并保持在第一步
            const msg = err instanceof Error ? err.message : "检查邮箱可用性失败";
            setLocalError(msg);
        } finally {
            setTurnstileToken("");
            setTurnstileResetKey((k) => k + 1);
            setLocalLoading(false);
        }
    }

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        clearError();
        setLocalError(null);
        if (!turnstileToken) {
            setLocalError("请先完成 Turnstile 人机验证");
            return;
        }
        await login({
            email,
            password,
            cf_turnstile_response: turnstileToken,
        });
        setTurnstileToken("");
        setTurnstileResetKey((k) => k + 1);
    }

    async function handleRegister(e: React.FormEvent) {
        e.preventDefault();
        clearError();
        setLocalError(null);
        if (!turnstileToken) {
            setLocalError("请先完成 Turnstile 人机验证");
            return;
        }
        await register({
            email,
            password,
            username: username.trim() || undefined,
            display_name: displayName || undefined,
            cf_turnstile_response: turnstileToken,
        });
        setTurnstileToken("");
        setTurnstileResetKey((k) => k + 1);
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

    async function handle2FARecover(e: React.FormEvent) {
        e.preventDefault();
        if (!pending2FA) return;
        setTwoFALoading(true);
        setTwoFAError(null);
        try {
            const result = await twoFA.recover({
                temp_token: pending2FA.temp_token,
                recovery_code: recoveryCode,
            });
            if (result && typeof result === "object" && "token" in result) {
                const tr = result as { token: string; require_totp_reset?: boolean; remaining_recovery_codes?: number };
                if (tr.require_totp_reset || (typeof tr.remaining_recovery_codes === "number" && tr.remaining_recovery_codes <= 1)) {
                    setForceResetTotp(true);
                    try {
                        sessionStorage.setItem("miniclassisland_force_reset_totp", "1");
                    } catch { /* ignore */ }
                }
                complete2FA(tr.token);
            }
        } catch (err: unknown) {
            setTwoFAError(err instanceof Error ? err.message : "恢复失败");
        } finally {
            setTwoFALoading(false);
        }
    }

    const resetFlow = () => {
        setStep("email");
        clearError();
        setLocalError(null);
        setTwoFAError(null);
        setTurnstileToken("");
        setTurnstileResetKey((k) => k + 1);
        if (pending2FA) cancel2FA();
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/icon.svg"
                        alt="MINI ClassIsland Logo"
                        style={{ width: 64, height: 64, marginBottom: 12, display: "block" }}
                    />
                    <div className="login-title" style={{ margin: 0 }}>欢迎来到 MINI ClassIsland</div>
                </div>
                <div className="login-subtitle">
                    {step === "email" && "输入您的邮箱以继续"}
                    {step === "login" && "欢迎回来，请登录"}
                    {step === "register" && "创建一个新账户"}
                    {step === "2fa" && "安全验证"}
                    {step === "qr" && "使用移动端 App 扫码登录"}
                </div>

                {sessionExpired && (
                    <MessageBar intent="warning" style={{ marginBottom: 12 }}>
                        <MessageBarBody>您的登录会话已过期，请重新登录。</MessageBarBody>
                    </MessageBar>
                )}

                {error && (
                    <MessageBar intent="error" style={{ marginBottom: 12 }}>
                        <MessageBarBody>{error}</MessageBarBody>
                    </MessageBar>
                )}

                {registerSuccess && step === "register" ? (
                    <div>
                        <MessageBar intent="success" style={{ marginBottom: 16 }}>
                            <MessageBarBody>{registerSuccess}</MessageBarBody>
                        </MessageBar>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                            您的注册申请已提交，请等待管理员审核后再登录。
                        </p>
                        <Button appearance="primary" style={{ width: "100%" }} onClick={resetFlow}>
                            返回
                        </Button>
                    </div>
                ) : (
                    <div>
                        {step === "email" && (
                            <form onSubmit={handleEmailCheck}>
                                <div className="form-group">
                                    <Label htmlFor="email">邮箱</Label>
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        value={email}
                                        onChange={(_, d) => setEmail(d.value)}
                                        placeholder="user@example.com"
                                        style={{ width: "100%" }}
                                        autoComplete="username email"
                                        autoFocus
                                    />
                                </div>
                                {/* 隐藏密码框：仅作为辅助浏览器收集填充，采用无障碍物理隐藏以防止密码管理器产生定位死循环 */}
                                <input
                                    id="placeholder-password"
                                    type="password"
                                    name="password"
                                    autoComplete="current-password"
                                    style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden", pointerEvents: "none", zIndex: -1 }}
                                    tabIndex={-1}
                                />
                                <TurnstileWidget
                                    action="email_availability"
                                    resetKey={turnstileResetKey}
                                    onVerify={(tok) => setTurnstileToken(tok)}
                                />
                                <Button
                                    appearance="primary"
                                    type="submit"
                                    disabled={loading || !email || !turnstileToken}
                                    style={{ width: "100%", marginTop: 8 }}
                                >
                                    {loading ? <Spinner size="tiny" /> : "继续"}
                                </Button>
                                <Button
                                    appearance="secondary"
                                    type="button"
                                    icon={<QrCodeRegular />}
                                    disabled={loading || qrLoading}
                                    style={{ width: "100%", marginTop: 10 }}
                                    onClick={startQrLoginSession}
                                >
                                    {qrLoading ? "正在生成二维码..." : "移动端扫码登录"}
                                </Button>
                            </form>
                        )}

                        {step === "qr" && (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                                {qrDataUrl && qrRemainingSec > 0 ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={qrDataUrl}
                                        alt="扫码登录二维码"
                                        style={{ width: 200, height: 200, borderRadius: 8, border: "1px solid var(--border-color)", padding: 8, background: "#fff" }}
                                    />
                                ) : (
                                    <div style={{ width: 200, height: 200, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "1px dashed var(--border-color)", color: "var(--text-secondary)", fontSize: 13 }}>
                                        二维码已过期
                                    </div>
                                )}
                                <div style={{ fontSize: 12, color: "var(--text-secondary)", textAlign: "center" }}>
                                    {qrRemainingSec > 0
                                        ? `二维码将在 ${qrRemainingSec >= 60 ? `${Math.ceil(qrRemainingSec / 60)} 分钟` : `${qrRemainingSec} 秒`}后过期。`
                                        : "二维码已过期。"}
                                </div>
                                <div style={{ display: "flex", gap: 8, width: "100%", marginTop: 4 }}>
                                    <Button
                                        appearance="secondary"
                                        icon={<ArrowSyncRegular />}
                                        style={{ flex: 1 }}
                                        onClick={startQrLoginSession}
                                    >
                                        刷新二维码
                                    </Button>
                                    <Button
                                        appearance="subtle"
                                        style={{ flex: 1 }}
                                        onClick={resetFlow}
                                    >
                                        返回邮箱登录
                                    </Button>
                                </div>
                            </div>
                        )}

                        {step === "login" && (
                            <form onSubmit={handleLogin}>
                                <div className="form-group">
                                    <Label htmlFor="login-email">邮箱</Label>
                                    <Input
                                        id="login-email"
                                        name="email"
                                        type="email"
                                        value={email}
                                        readOnly
                                        style={{ width: "100%" }}
                                        autoComplete="username email"
                                    />
                                </div>
                                <div className="form-group">
                                    <Label htmlFor="password">密码</Label>
                                    <Input
                                        id="password"
                                        name="password"
                                        type="password"
                                        value={password}
                                        onChange={(_, d) => setPassword(d.value)}
                                        placeholder="请输入密码"
                                        style={{ width: "100%" }}
                                        autoComplete="current-password"
                                        autoFocus
                                    />
                                </div>
                                <TurnstileWidget
                                    action="login"
                                    resetKey={turnstileResetKey}
                                    onVerify={(tok) => setTurnstileToken(tok)}
                                />
                                <Button
                                    appearance="primary"
                                    type="submit"
                                    disabled={loading || !password || !turnstileToken}
                                    style={{ width: "100%", marginTop: 8 }}
                                >
                                    {loading ? <Spinner size="tiny" /> : "登录"}
                                </Button>
                                <div className="text-center mt-16">
                                    <Button appearance="subtle" size="small" onClick={resetFlow}>
                                        使用其他邮箱
                                    </Button>
                                </div>
                            </form>
                        )}

                        {step === "register" && (
                            <form onSubmit={handleRegister}>
                                <div className="form-group">
                                    <Label htmlFor="reg-email">邮箱</Label>
                                    <Input
                                        id="reg-email"
                                        name="email"
                                        type="email"
                                        value={email}
                                        readOnly
                                        style={{ width: "100%" }}
                                        autoComplete="username email"
                                    />
                                </div>
                                <div className="form-group">
                                    <Label htmlFor="reg-username">用户名（可选）</Label>
                                    <Input
                                        id="reg-username"
                                        value={username}
                                        onChange={(_, d) => setUsername(d.value)}
                                        placeholder="留空则随机生成，如 user_1234abcd"
                                        style={{ width: "100%" }}
                                        autoFocus
                                    />
                                    <div className="form-hint" style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>3-64 位小写字母、数字或下划线</div>
                                </div>
                                <div className="form-group">
                                    <Label htmlFor="displayName">显示名称（可选）</Label>
                                    <Input
                                        id="displayName"
                                        value={displayName}
                                        onChange={(_, d) => setDisplayName(d.value)}
                                        placeholder="显示名称"
                                        style={{ width: "100%" }}
                                    />
                                </div>
                                <div className="form-group">
                                    <Label htmlFor="reg-password">密码</Label>
                                    <Input
                                        id="reg-password"
                                        name="password"
                                        type="password"
                                        value={password}
                                        onChange={(_, d) => setPassword(d.value)}
                                        placeholder="至少 12 个字符"
                                        style={{ width: "100%" }}
                                        autoComplete="new-password"
                                    />
                                    <div className="form-hint" style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>密码长度至少为 12 个字符，包含大小写字母与数字</div>
                                </div>
                                <TurnstileWidget
                                    action="register"
                                    resetKey={turnstileResetKey}
                                    onVerify={(tok) => setTurnstileToken(tok)}
                                />
                                <Button
                                    appearance="primary"
                                    type="submit"
                                    disabled={loading || password.length < 12 || !turnstileToken}
                                    style={{ width: "100%", marginTop: 8 }}
                                >
                                    {loading ? <Spinner size="tiny" /> : "完成注册"}
                                </Button>
                                <div className="text-center mt-16">
                                    <Button appearance="subtle" size="small" onClick={resetFlow}>
                                        使用其他邮箱
                                    </Button>
                                </div>
                            </form>
                        )}

                        {step === "2fa" && (
                            <div>
                                {!recoveryMode ? (
                                    <form onSubmit={handle2FAVerify}>
                                        <div className="form-group">
                                            <Label htmlFor="totp">两步验证码</Label>
                                            <Input
                                                id="totp"
                                                value={totpCode}
                                                onChange={(_, d) => setTotpCode(d.value)}
                                                placeholder="请输入 6 位验证码"
                                                style={{ width: "100%" }}
                                                autoFocus
                                            />
                                        </div>
                                        <Button
                                            appearance="primary"
                                            type="submit"
                                            disabled={loading || !totpCode}
                                            style={{ width: "100%", marginTop: 8 }}
                                        >
                                            {loading ? <Spinner size="tiny" /> : "验证"}
                                        </Button>
                                        <div className="flex justify-between mt-16">
                                            <Button appearance="subtle" size="small" onClick={() => setRecoveryMode(true)}>
                                                使用恢复码
                                            </Button>
                                            <Button appearance="subtle" size="small" onClick={resetFlow}>
                                                返回
                                            </Button>
                                        </div>
                                    </form>
                                ) : (
                                    <form onSubmit={handle2FARecover}>
                                        <div className="form-group">
                                            <Label htmlFor="recovery">恢复码</Label>
                                            <Input
                                                id="recovery"
                                                value={recoveryCode}
                                                onChange={(_, d) => setRecoveryCode(d.value)}
                                                placeholder="请输入恢复码"
                                                style={{ width: "100%" }}
                                                autoFocus
                                            />
                                        </div>
                                        <Button
                                            appearance="primary"
                                            type="submit"
                                            disabled={loading || !recoveryCode}
                                            style={{ width: "100%", marginTop: 8 }}
                                        >
                                            {loading ? <Spinner size="tiny" /> : "恢复"}
                                        </Button>
                                        <div className="flex justify-between mt-16">
                                            <Button appearance="subtle" size="small" onClick={() => setRecoveryMode(false)}>
                                                使用验证码
                                            </Button>
                                            <Button appearance="subtle" size="small" onClick={resetFlow}>
                                                返回
                                            </Button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid var(--border-color)", textAlign: "center", fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    <div>本项目与 ClassIsland 官方无关，ClassIsland 是由 ClassIsland 社区开发和维护的开源软件</div>
                    <div>本项目由 MINIOpenSource 开发和维护，并开源在 GitHub</div>
                </div>
            </div>
            <SponsorBanner variant="card" dismissible={false} />
        </div>
    );
}
