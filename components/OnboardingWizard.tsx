"use client";

import React, { useState, useRef } from "react";
import { accounts as accountsApi, data as dataApi, credentials as credApi } from "@/lib/api";
import { useAccount } from "@/lib/account-context";
import { useRouter } from "next/navigation";
import {
    Button,
    Input,
    Spinner,
    Dialog,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    DialogActions,
    MessageBar,
    MessageBarBody,
    Badge,
} from "@fluentui/react-components";
import { Select } from "./CustomSelect";
import {
    PersonAccounts24Regular,
    ArrowUpload24Regular,
    Settings24Regular,
    Key24Regular,
    CheckmarkCircle24Regular,
    CheckmarkCircle16Regular,
    ArrowRight16Regular,
    ArrowLeft16Regular,
    Apps24Regular,
} from "@fluentui/react-icons";
import type { AuthorizeLevel, ManagementCredentialConfig, ComponentProfile } from "@/lib/types";
import { AUTHORIZE_LEVEL_LABELS } from "@/lib/types";

interface OnboardingWizardProps {
    open: boolean;
    onClose: () => void;
    initialStep?: 1 | 2 | 3 | 4;
    targetAccountId?: string;
    mode?: "onboarding" | "import";
    onCompleted?: (accountId: string) => void;
}

interface ParsedProfileStats {
    fileName: string;
    subjectCount: number;
    timeLayoutCount: number;
    classPlanCount: number;
    classPlanGroupCount: number;
    subjectsPayload: Record<string, unknown>;
    timeLayoutPayload: Record<string, unknown>;
    classPlanPayload: Record<string, unknown>;
}

function normalizeUploadedComponentProfile(raw: unknown): ComponentProfile {
    if (!raw || typeof raw !== "object") {
        return { Lines: [{ Children: [], IslandSeparationMode: 0, IsMainLine: true, IsEnabled: true }] };
    }
    if (Array.isArray(raw)) {
        const hasChildren = raw.length > 0 && raw[0] && typeof raw[0] === "object" && "Children" in raw[0];
        if (hasChildren) {
            return { Lines: raw as ComponentProfile["Lines"] };
        }
        return {
            Lines: [
                {
                    Children: raw as ComponentProfile["Lines"][number]["Children"],
                    IslandSeparationMode: 0,
                    IsMainLine: true,
                    IsEnabled: true,
                },
            ],
        };
    }
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.Lines)) {
        return { Lines: obj.Lines as ComponentProfile["Lines"] };
    }
    return { Lines: [{ Children: [], IslandSeparationMode: 0, IsMainLine: true, IsEnabled: true }] };
}

export default function OnboardingWizard({
    open,
    onClose,
    initialStep = 1,
    targetAccountId,
    mode = "onboarding",
    onCompleted,
}: OnboardingWizardProps) {
    const { accounts, accountId: currentContextAccountId, refreshAccounts, switchAccount } = useAccount();
    const router = useRouter();

    const isImportMode = mode === "import" || initialStep >= 2;
    const minStep: 1 | 2 = isImportMode ? 2 : 1;

    const [step, setStep] = useState<1 | 2 | 3 | 4>(initialStep);
    const [activeAccountId, setActiveAccountId] = useState<string>(
        targetAccountId || currentContextAccountId || ""
    );
    const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

    React.useEffect(() => {
        if (open) {
            setStep(initialStep);
            if (targetAccountId) {
                setActiveAccountId(targetAccountId);
            } else if (currentContextAccountId) {
                setActiveAccountId(currentContextAccountId);
            }
            setMsg(null);
        }
    }, [open, initialStep, targetAccountId, currentContextAccountId]);

    // Step 1 state: Create or select first account
    const [acctName, setAcctName] = useState("");
    const [acctSlug, setAcctSlug] = useState("");
    const [creatingAcct, setCreatingAcct] = useState(false);

    // Step 2 state: Upload & split full Profile.json
    const [profileGroupName, setProfileGroupName] = useState("default");
    const [profileStats, setProfileStats] = useState<ParsedProfileStats | null>(null);
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileSaved, setProfileSaved] = useState(false);
    const profileInputRef = useRef<HTMLInputElement>(null);

    // Step 3 state: Upload Settings.json & Components.json
    const [settingsFileName, setSettingsFileName] = useState<string | null>(null);
    const [settingsPayload, setSettingsPayload] = useState<Record<string, unknown> | null>(null);
    const [componentsFileName, setComponentsFileName] = useState<string | null>(null);
    const [componentsPayload, setComponentsPayload] = useState<ComponentProfile | null>(null);
    const [savingSettingsComp, setSavingSettingsComp] = useState(false);
    const [settingsCompSaved, setSettingsCompSaved] = useState(false);
    const settingsInputRef = useRef<HTMLInputElement>(null);
    const componentsInputRef = useRef<HTMLInputElement>(null);

    // Step 4 state: Credentials configuration
    const [userPassword, setUserPassword] = useState("");
    const [adminPassword, setAdminPassword] = useState("");
    const [credLevels, setCredLevels] = useState<ManagementCredentialConfig>({
        ExitManagementAuthorizeLevel: 2,
        EditPolicyAuthorizeLevel: 2,
        EditAuthorizeSettingsAuthorizeLevel: 2,
        EditProfileAuthorizeLevel: 1,
        EditSettingsAuthorizeLevel: 1,
        EditComponentsAuthorizeLevel: 1,
        ExitApplicationAuthorizeLevel: 1,
        PluginManagementAuthorizeLevel: 2,
        ChangeLessonsAuthorizeLevel: 0,
    });
    const [savingCreds, setSavingCreds] = useState(false);

    const effectiveAccountId = activeAccountId || targetAccountId || currentContextAccountId || (accounts[0]?.id ?? "");

    async function ensureResourceAndWrite(
        acctId: string,
        type: "Subjects" | "TimeLayout" | "ClassPlan" | "DefaultSettings" | "Components" | "Credentials",
        name: string,
        payload: unknown
    ) {
        try {
            const existing = await dataApi.list(acctId, type);
            if (!Array.isArray(existing) || !existing.includes(name)) {
                await dataApi.create(acctId, type, name);
            }
        } catch {
            try {
                await dataApi.create(acctId, type, name);
            } catch {
                /* already exists */
            }
        }
        await dataApi.write(acctId, type, name, payload);
    }

    // Step 1 handler
    async function handleStep1Continue() {
        setMsg(null);
        if (effectiveAccountId && !acctName.trim()) {
            switchAccount(effectiveAccountId);
            setStep(2);
            return;
        }
        if (!acctName.trim()) {
            setMsg({ type: "error", text: "请输入您的第一个集控账户（学校/组织）名称" });
            return;
        }
        setCreatingAcct(true);
        try {
            const created = await accountsApi.apply({
                name: acctName.trim(),
                slug: acctSlug.trim() || undefined,
            });
            await refreshAccounts();
            switchAccount(created.id);
            setActiveAccountId(created.id);
            setMsg({ type: "success", text: `集控账户「${created.name}」(${created.slug}) 已创建！` });
            setStep(2);
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "创建账户失败" });
        }
        setCreatingAcct(false);
    }

    // Step 2: Parse local ClassIsland Profile.json
    function handleProfileFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setMsg(null);
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const raw = JSON.parse(String(reader.result || "{}"));
                if (!raw || typeof raw !== "object") {
                    throw new Error("无效的 JSON 对象");
                }
                const obj = raw as Record<string, unknown>;
                const subjects = (obj.Subjects && typeof obj.Subjects === "object" ? obj.Subjects : {}) as Record<string, unknown>;
                const timeLayouts = (obj.TimeLayouts && typeof obj.TimeLayouts === "object" ? obj.TimeLayouts : {}) as Record<string, unknown>;
                const classPlans = (obj.ClassPlans && typeof obj.ClassPlans === "object" ? obj.ClassPlans : {}) as Record<string, unknown>;
                const classPlanGroups = (obj.ClassPlanGroups && typeof obj.ClassPlanGroups === "object" ? obj.ClassPlanGroups : {}) as Record<string, unknown>;

                const subjectCount = Object.keys(subjects).length;
                const timeLayoutCount = Object.keys(timeLayouts).length;
                const classPlanCount = Object.keys(classPlans).length;
                const classPlanGroupCount = Object.keys(classPlanGroups).length;

                if (subjectCount === 0 && timeLayoutCount === 0 && classPlanCount === 0) {
                    setMsg({
                        type: "error",
                        text: "未在所选 JSON 中检测到 Subjects、TimeLayouts 或 ClassPlans 字段，请确认上传的是 ClassIsland 本地档案文件",
                    });
                    return;
                }

                setProfileStats({
                    fileName: file.name,
                    subjectCount,
                    timeLayoutCount,
                    classPlanCount,
                    classPlanGroupCount,
                    subjectsPayload: { Subjects: subjects },
                    timeLayoutPayload: { TimeLayouts: timeLayouts },
                    classPlanPayload: {
                        ClassPlans: classPlans,
                        ClassPlanGroups: classPlanGroups,
                        ...(typeof obj.SelectedClassPlanGroupId === "string"
                            ? { SelectedClassPlanGroupId: obj.SelectedClassPlanGroupId }
                            : {}),
                        ...(typeof obj.IsOverlayClassPlanEnabled === "boolean"
                            ? { IsOverlayClassPlanEnabled: obj.IsOverlayClassPlanEnabled }
                            : {}),
                    },
                });
                setProfileSaved(false);
            } catch (err: unknown) {
                setMsg({
                    type: "error",
                    text: err instanceof Error ? `解析档案 JSON 失败: ${err.message}` : "解析档案 JSON 失败",
                });
            }
        };
        reader.readAsText(file, "utf-8");
        e.target.value = "";
    }

    async function handleStep2SaveAndNext() {
        if (!effectiveAccountId) {
            setMsg({ type: "error", text: "请先在第一步创建或选择集控账户" });
            return;
        }
        if (!profileStats) {
            setStep(3);
            return;
        }
        const targetGroup = profileGroupName.trim() || "default";
        setSavingProfile(true);
        setMsg(null);
        try {
            await ensureResourceAndWrite(effectiveAccountId, "Subjects", targetGroup, profileStats.subjectsPayload);
            await ensureResourceAndWrite(effectiveAccountId, "TimeLayout", targetGroup, profileStats.timeLayoutPayload);
            await ensureResourceAndWrite(effectiveAccountId, "ClassPlan", targetGroup, profileStats.classPlanPayload);
            setProfileSaved(true);
            setMsg({
                type: "success",
                text: `已将完整档案自动拆分为 Subjects/${targetGroup}（${profileStats.subjectCount} 科）、TimeLayout/${targetGroup}（${profileStats.timeLayoutCount} 套时间表）、ClassPlan/${targetGroup}（${profileStats.classPlanCount} 张课表）！`,
            });
            setStep(3);
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "拆分写入配置组失败" });
        }
        setSavingProfile(false);
    }

    // Step 3: Parse Settings.json & Components.json
    function handleSettingsFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setMsg(null);
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(String(reader.result || "{}"));
                if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                    throw new Error("Settings.json 应为 JSON 对象");
                }
                setSettingsFileName(file.name);
                setSettingsPayload(parsed as Record<string, unknown>);
                setSettingsCompSaved(false);
            } catch (err: unknown) {
                setMsg({
                    type: "error",
                    text: err instanceof Error ? `解析 Settings.json 失败: ${err.message}` : "解析 Settings.json 失败",
                });
            }
        };
        reader.readAsText(file, "utf-8");
        e.target.value = "";
    }

    function handleComponentsFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setMsg(null);
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(String(reader.result || "{}"));
                const normalized = normalizeUploadedComponentProfile(parsed);
                setComponentsFileName(file.name);
                setComponentsPayload(normalized);
                setSettingsCompSaved(false);
            } catch (err: unknown) {
                setMsg({
                    type: "error",
                    text: err instanceof Error ? `解析组件配置 JSON 失败: ${err.message}` : "解析组件配置 JSON 失败",
                });
            }
        };
        reader.readAsText(file, "utf-8");
        e.target.value = "";
    }

    async function handleStep3SaveAndNext() {
        if (!effectiveAccountId) return;
        if (!settingsPayload && !componentsPayload) {
            setStep(4);
            return;
        }
        const targetGroup = profileGroupName.trim() || "default";
        setSavingSettingsComp(true);
        setMsg(null);
        try {
            if (settingsPayload) {
                await ensureResourceAndWrite(effectiveAccountId, "DefaultSettings", targetGroup, settingsPayload);
            }
            if (componentsPayload) {
                await ensureResourceAndWrite(effectiveAccountId, "Components", targetGroup, componentsPayload);
            }
            setSettingsCompSaved(true);
            setMsg({
                type: "success",
                text: "应用默认设置与组件布局配置已写入服务端！",
            });
            setStep(4);
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "上传应用/组件设置失败" });
        }
        setSavingSettingsComp(false);
    }

    // Step 4: Save Credentials & Complete Onboarding
    async function handleStep4Complete() {
        if (!effectiveAccountId) return;
        const targetGroup = profileGroupName.trim() || "default";
        setSavingCreds(true);
        setMsg(null);
        try {
            const payloadToSave: ManagementCredentialConfig = { ...credLevels };
            if (userPassword.trim()) {
                const encodedUser = await credApi.encode(effectiveAccountId, userPassword.trim());
                payloadToSave.UserCredential = encodedUser.credential;
            }
            if (adminPassword.trim()) {
                const encodedAdmin = await credApi.encode(effectiveAccountId, adminPassword.trim());
                payloadToSave.AdminCredential = encodedAdmin.credential;
            }
            await ensureResourceAndWrite(effectiveAccountId, "Credentials", targetGroup, payloadToSave);
            if (typeof window !== "undefined") {
                localStorage.setItem("miniclassisland_onboarding_completed", "1");
            }
            onCompleted?.(effectiveAccountId);
            onClose();
            router.push("/dashboard");
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "保存管理凭据失败" });
        }
        setSavingCreds(false);
    }

    function handleSkipFinish() {
        if (typeof window !== "undefined") {
            localStorage.setItem("miniclassisland_onboarding_completed", "1");
        }
        onClose();
        if (effectiveAccountId) {
            onCompleted?.(effectiveAccountId);
            router.push("/dashboard");
        }
    }

    const stepsMeta = isImportMode
        ? [
              { num: 2, displayNum: 1, title: "导入并拆分档案", icon: <ArrowUpload24Regular /> },
              { num: 3, displayNum: 2, title: "上载应用与组件设置", icon: <Settings24Regular /> },
              { num: 4, displayNum: 3, title: "配置管理密码凭据", icon: <Key24Regular /> },
          ]
        : [
              { num: 1, displayNum: 1, title: "创建集控账户", icon: <PersonAccounts24Regular /> },
              { num: 2, displayNum: 2, title: "导入并拆分档案", icon: <ArrowUpload24Regular /> },
              { num: 3, displayNum: 3, title: "上载应用与组件设置", icon: <Settings24Regular /> },
              { num: 4, displayNum: 4, title: "配置管理密码凭据", icon: <Key24Regular /> },
          ];

    const currentDisplayStep = isImportMode ? Math.max(1, step - 1) : step;
    const totalDisplaySteps = stepsMeta.length;

    return (
        <Dialog open={open} onOpenChange={(_, d) => !d.open && onClose()}>
            <DialogSurface style={{ maxWidth: 740, width: "94vw" }}>
                <DialogBody style={{ display: "block" }}>
                    <DialogTitle style={{ marginBottom: 12 }}>
                        <div className="flex items-center justify-between" style={{ width: "100%" }}>
                            <span>{isImportMode ? "从本地上传配置与档案拆分" : "新用户集控快速上手向导"}</span>
                            <Badge appearance="tint" color="brand" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                                步骤 {currentDisplayStep} / {totalDisplaySteps}
                            </Badge>
                        </div>
                    </DialogTitle>
                    <DialogContent style={{ overflowX: "hidden" }}>
                        {/* 步骤条 */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: `repeat(${stepsMeta.length}, minmax(0, 1fr))`,
                                gap: 10,
                                marginBottom: 20,
                                paddingBottom: 14,
                                borderBottom: "1px solid var(--border-color)",
                            }}
                        >
                            {stepsMeta.map((s) => {
                                const isActive = step === s.num;
                                const isDone = step > s.num;
                                return (
                                    <div
                                        key={s.num}
                                        onClick={() => {
                                            if (s.num === 1 || effectiveAccountId) {
                                                setStep(s.num as 1 | 2 | 3 | 4);
                                            }
                                        }}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            padding: "10px 12px",
                                            borderRadius: 8,
                                            cursor: s.num === 1 || effectiveAccountId ? "pointer" : "not-allowed",
                                            background: isActive
                                                ? "rgba(0, 120, 212, 0.12)"
                                                : isDone
                                                ? "rgba(16, 124, 16, 0.08)"
                                                : "var(--bg-subtle)",
                                            border: `1px solid ${
                                                isActive
                                                    ? "var(--accent-color)"
                                                    : isDone
                                                    ? "var(--success-color)"
                                                    : "var(--border-color)"
                                            }`,
                                        }}
                                    >
                                        <span
                                            style={{
                                                color: isActive
                                                    ? "var(--accent-color)"
                                                    : isDone
                                                    ? "var(--success-color)"
                                                    : "var(--text-secondary)",
                                                display: "inline-flex",
                                                flexShrink: 0,
                                            }}
                                        >
                                            {isDone ? <CheckmarkCircle24Regular /> : s.icon}
                                        </span>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                                                Step {s.displayNum}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 12.5,
                                                    fontWeight: isActive ? 600 : 500,
                                                    whiteSpace: "nowrap",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                }}
                                            >
                                                {s.title}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {msg && (
                            <MessageBar intent={msg.type} style={{ marginBottom: 16 }}>
                                <MessageBarBody>{msg.text}</MessageBarBody>
                            </MessageBar>
                        )}

                        {/* Step 1: 创建或选择首个集控账户 */}
                        {step === 1 && (
                            <div>
                                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.6 }}>
                                    欢迎使用 MINI ClassIsland 集控平台！首先请创建您的第一个集控账户（对应学校、年级或电教中心），后续我们将引导您一键导入本地 ClassIsland 档案、应用设置与管理密码。
                                </p>

                                {accounts.length > 0 && (
                                    <div className="form-group">
                                        <label className="form-label">使用已有集控账户</label>
                                        <Select
                                            value={effectiveAccountId}
                                            onChange={(_, d) => setActiveAccountId(d.value)}
                                            style={{ width: "100%" }}
                                        >
                                            {accounts.map((a) => (
                                                <option key={a.id} value={a.id}>
                                                    {a.name}
                                                </option>
                                            ))}
                                        </Select>
                                        <div className="form-hint">或者在下方填写新账户名称以创建全新的集控账户</div>
                                    </div>
                                )}

                                <div className="form-group">
                                    <label className="form-label">
                                        {accounts.length > 0 ? "新建集控账户名称（留空则使用上方所选账户）" : "首个集控账户 / 学校组织名称 *"}
                                    </label>
                                    <Input
                                        value={acctName}
                                        onChange={(_, d) => setAcctName(d.value)}
                                        placeholder="例如：第一中学电教中心"
                                        style={{ width: "100%" }}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">子域名标识 Slug（可选）</label>
                                    <Input
                                        value={acctSlug}
                                        onChange={(_, d) => setAcctSlug(d.value)}
                                        placeholder="例如：no1-school (留空自动生成)"
                                        style={{ width: "100%" }}
                                    />
                                    <div className="form-hint">用于生成班级终端专属接入地址与 ManagementPreset.json</div>
                                </div>
                            </div>
                        )}

                        {/* Step 2: 导入完整档案并自动拆分为第一个配置组 */}
                        {step === 2 && (
                            <div>
                                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.6 }}>
                                    您可以直接上传单机版 ClassIsland 的完整档案文件（通常位于客户端程序目录 <code>Profiles/default.json</code>），向导会自动将其中的 <strong>科目</strong>、<strong>时间表</strong> 与 <strong>课表</strong> 拆分为集控端的首个配置组。
                                </p>

                                <div className="grid-2 mb-16">
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">目标配置组名称</label>
                                        <Input
                                            value={profileGroupName}
                                            onChange={(_, d) => setProfileGroupName(d.value)}
                                            placeholder="default"
                                            style={{ width: "100%" }}
                                        />
                                        <div className="form-hint">默认为 default（所有接入终端默认拉取的配置组）</div>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">选择本地完整档案 JSON</label>
                                        <input
                                            ref={profileInputRef}
                                            type="file"
                                            accept=".json,application/json"
                                            style={{ display: "none" }}
                                            onChange={handleProfileFileChange}
                                        />
                                        <Button
                                            appearance="secondary"
                                            icon={<ArrowUpload24Regular />}
                                            onClick={() => profileInputRef.current?.click()}
                                            style={{ width: "100%" }}
                                        >
                                            {profileStats ? `重新选择 (${profileStats.fileName})` : "选择本地 Profile.json 文件..."}
                                        </Button>
                                    </div>
                                </div>

                                {profileStats && (
                                    <div
                                        style={{
                                            padding: 14,
                                            borderRadius: 8,
                                            background: "var(--bg-subtle)",
                                            border: "1px solid var(--border-color)",
                                        }}
                                    >
                                        <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>
                                            档案解析预览：{profileStats.fileName} → 配置组 <code>{profileGroupName || "default"}</code>
                                        </div>
                                        <div className="grid-3">
                                            <div className="stat-card" style={{ padding: 12 }}>
                                                <div className="stat-value" style={{ fontSize: 22 }}>{profileStats.subjectCount}</div>
                                                <div className="stat-label">科目 (Subjects/{profileGroupName || "default"})</div>
                                            </div>
                                            <div className="stat-card" style={{ padding: 12 }}>
                                                <div className="stat-value" style={{ fontSize: 22 }}>{profileStats.timeLayoutCount}</div>
                                                <div className="stat-label">时间表 (TimeLayout/{profileGroupName || "default"})</div>
                                            </div>
                                            <div className="stat-card" style={{ padding: 12 }}>
                                                <div className="stat-value" style={{ fontSize: 22 }}>{profileStats.classPlanCount}</div>
                                                <div className="stat-label">
                                                    课表 (含 {profileStats.classPlanGroupCount} 个课表群)
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Step 3: 上载应用设置 与组件设置 (Components/*.json) */}
                        {step === 3 && (
                            <div>
                                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.6 }}>
                                    接下来您可以上传客户端本地的 <code>Settings.json</code>（作为集控默认设置 <code>DefaultSettings/{profileGroupName || "default"}</code>）以及组件配置文件 <code>Config/Components/Default.json</code>（作为集控组件设置 <code>Components/{profileGroupName || "default"}</code>）。如暂不上传，系统将使用内置标准配置。
                                </p>

                                <div className="grid-2">
                                    <div
                                        style={{
                                            padding: 16,
                                            borderRadius: 8,
                                            border: "1px solid var(--border-color)",
                                            background: "var(--bg-subtle)",
                                        }}
                                    >
                                        <div className="flex items-center gap-8 mb-8">
                                            <Settings24Regular style={{ color: "var(--accent-color)" }} />
                                            <span style={{ fontWeight: 600, fontSize: 14 }}>应用设置</span>
                                        </div>
                                        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
                                            包含窗口停靠、主题缩放、提醒特效、TTS 语音、天气与时间同步等全量客户端设置。
                                        </p>
                                        <input
                                            ref={settingsInputRef}
                                            type="file"
                                            accept=".json,application/json"
                                            style={{ display: "none" }}
                                            onChange={handleSettingsFileChange}
                                        />
                                        <Button
                                            appearance="secondary"
                                            icon={<ArrowUpload24Regular />}
                                            onClick={() => settingsInputRef.current?.click()}
                                            style={{ width: "100%" }}
                                        >
                                            {settingsFileName ? `已选择: ${settingsFileName}` : "上传 Settings.json"}
                                        </Button>
                                        {settingsPayload && (
                                            <div className="flex items-center gap-6" style={{ fontSize: 12, color: "var(--success-color)", marginTop: 8 }}>
                                                <CheckmarkCircle16Regular /> 已识别 {Object.keys(settingsPayload).length} 项客户端设置字段
                                            </div>
                                        )}
                                    </div>

                                    <div
                                        style={{
                                            padding: 16,
                                            borderRadius: 8,
                                            border: "1px solid var(--border-color)",
                                            background: "var(--bg-subtle)",
                                        }}
                                    >
                                        <div className="flex items-center gap-8 mb-8">
                                            <Apps24Regular style={{ color: "var(--accent-color)" }} />
                                            <span style={{ fontWeight: 600, fontSize: 14 }}>组件设置</span>
                                        </div>
                                        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
                                            包含 ClassIsland 主界面多行组件布局 (Lines) 及各子组件样式参数。
                                        </p>
                                        <input
                                            ref={componentsInputRef}
                                            type="file"
                                            accept=".json,application/json"
                                            style={{ display: "none" }}
                                            onChange={handleComponentsFileChange}
                                        />
                                        <Button
                                            appearance="secondary"
                                            icon={<ArrowUpload24Regular />}
                                            onClick={() => componentsInputRef.current?.click()}
                                            style={{ width: "100%" }}
                                        >
                                            {componentsFileName ? `已选择: ${componentsFileName}` : "上传组件设置 JSON"}
                                        </Button>
                                        {componentsPayload && (
                                            <div className="flex items-center gap-6" style={{ fontSize: 12, color: "var(--success-color)", marginTop: 8 }}>
                                                <CheckmarkCircle16Regular /> 已识别 {componentsPayload.Lines.length} 行主界面布局（共{" "}
                                                {componentsPayload.Lines.reduce((acc, l) => acc + (l.Children?.length || 0), 0)} 个组件）
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 4: 配置管理密码凭据与操作权限等级 */}
                        {step === 4 && (
                            <div>
                                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.6 }}>
                                    最后一步：配置班级终端的解锁密码与敏感操作授权等级（保存至 <code>Credentials/{profileGroupName || "default"}</code>）。设置后可防止学生随意退出集控、篡改课表或关闭 ClassIsland。
                                </p>

                                <div className="grid-2 mb-16">
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">终端用户密码</label>
                                        <Input
                                            type="password"
                                            value={userPassword}
                                            onChange={(_, d) => setUserPassword(d.value)}
                                            placeholder="用于值日生/教师日常换课或调整设置（留空不设密码）"
                                            style={{ width: "100%" }}
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">终端管理员密码</label>
                                        <Input
                                            type="password"
                                            value={adminPassword}
                                            onChange={(_, d) => setAdminPassword(d.value)}
                                            placeholder="用于退出集控或修改核心策略（留空不设密码）"
                                            style={{ width: "100%" }}
                                        />
                                    </div>
                                </div>

                                <div className="grid-2">
                                    {(
                                        [
                                            { key: "ExitManagementAuthorizeLevel", label: "退出集控管理权限" },
                                            { key: "ExitApplicationAuthorizeLevel", label: "关闭/退出应用权限" },
                                            { key: "EditProfileAuthorizeLevel", label: "编辑本地档案权限" },
                                            { key: "EditSettingsAuthorizeLevel", label: "修改应用设置权限" },
                                            { key: "EditComponentsAuthorizeLevel", label: "编辑组件布局权限" },
                                            { key: "ChangeLessonsAuthorizeLevel", label: "主界面临时换课权限" },
                                        ] as { key: keyof ManagementCredentialConfig; label: string }[]
                                    ).map((item) => (
                                        <div key={item.key} className="form-group" style={{ marginBottom: 8 }}>
                                            <label className="form-label">{item.label}</label>
                                            <Select
                                                value={String((credLevels[item.key] as number | undefined) ?? 0)}
                                                onChange={(_, d) =>
                                                    setCredLevels((prev) => ({
                                                        ...prev,
                                                        [item.key]: Number(d.value) as AuthorizeLevel,
                                                    }))
                                                }
                                                style={{ width: "100%" }}
                                            >
                                                {Object.entries(AUTHORIZE_LEVEL_LABELS).map(([k, v]) => (
                                                    <option key={k} value={k}>
                                                        {v}
                                                    </option>
                                                ))}
                                            </Select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </DialogContent>

                    <DialogActions
                        style={{
                            marginTop: 16,
                            paddingTop: 12,
                            borderTop: "1px solid var(--border-color)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            width: "100%",
                            flexWrap: "wrap",
                            gap: 8,
                        }}
                    >
                        <div>
                            <Button
                                appearance="subtle"
                                onClick={handleSkipFinish}
                                style={{ whiteSpace: "nowrap" }}
                            >
                                {isImportMode ? "关闭" : "稍后配置 / 跳过向导"}
                            </Button>
                        </div>
                        <div className="flex gap-8" style={{ flexWrap: "wrap" }}>
                            {step > minStep && (
                                <Button
                                    appearance="secondary"
                                    icon={<ArrowLeft16Regular />}
                                    onClick={() => setStep((s) => (s > minStep ? ((s - 1) as 1 | 2 | 3 | 4) : s))}
                                    style={{ whiteSpace: "nowrap" }}
                                >
                                    上一步
                                </Button>
                            )}

                            {step === 1 && (
                                <Button
                                    appearance="primary"
                                    icon={<ArrowRight16Regular />}
                                    iconPosition="after"
                                    disabled={creatingAcct}
                                    onClick={handleStep1Continue}
                                    style={{ whiteSpace: "nowrap" }}
                                >
                                    {creatingAcct ? <Spinner size="tiny" /> : "下一步：导入并拆分档案"}
                                </Button>
                            )}

                            {step === 2 && (
                                <Button
                                    appearance="primary"
                                    icon={<ArrowRight16Regular />}
                                    iconPosition="after"
                                    disabled={savingProfile}
                                    onClick={handleStep2SaveAndNext}
                                    style={{ whiteSpace: "nowrap" }}
                                >
                                    {savingProfile ? (
                                        <Spinner size="tiny" />
                                    ) : profileStats && !profileSaved ? (
                                        "拆分写入并进入下一步"
                                    ) : (
                                        "下一步：应用与组件设置"
                                    )}
                                </Button>
                            )}

                            {step === 3 && (
                                <Button
                                    appearance="primary"
                                    icon={<ArrowRight16Regular />}
                                    iconPosition="after"
                                    disabled={savingSettingsComp}
                                    onClick={handleStep3SaveAndNext}
                                    style={{ whiteSpace: "nowrap" }}
                                >
                                    {savingSettingsComp ? (
                                        <Spinner size="tiny" />
                                    ) : (settingsPayload || componentsPayload) && !settingsCompSaved ? (
                                        "上传设置并进入下一步"
                                    ) : (
                                        "下一步：配置管理凭据"
                                    )}
                                </Button>
                            )}

                            {step === 4 && (
                                <Button
                                    appearance="primary"
                                    icon={<CheckmarkCircle24Regular />}
                                    disabled={savingCreds}
                                    onClick={handleStep4Complete}
                                    style={{ whiteSpace: "nowrap" }}
                                >
                                    {savingCreds ? <Spinner size="tiny" /> : "保存凭据并进入集控仪表盘"}
                                </Button>
                            )}
                        </div>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
}
