"use client";

import React, { useState, useEffect, useCallback } from "react";
import { data, accounts } from "@/lib/api";
import { useAccount } from "@/lib/account-context";
import type { AppDefaultSettings } from "@/lib/types";
import {
    Button, Input, Select, Switch, Spinner,
    MessageBar, MessageBarBody,
    Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions,
} from "@fluentui/react-components";
import {
    Add24Regular, Delete24Regular, Save24Regular, ArrowSync24Regular,
    Code24Regular,
} from "@fluentui/react-icons";
import DownloadPresetPopoverButton from "@/components/DownloadPresetPopoverButton";

export default function SettingsPage() {
    const { accountId, currentAccount } = useAccount();
    const [fileList, setFileList] = useState<string[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [settings, setSettings] = useState<AppDefaultSettings>({});
    const [jsonMode, setJsonMode] = useState(false);
    const [jsonText, setJsonText] = useState("{}");

    // 引导文件生成参数
    const [presetIdentity, setPresetIdentity] = useState("");

    const [loading, setLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [newFileName, setNewFileName] = useState("");

    const selectFile = useCallback(async (name: string) => {
        if (!accountId) return;
        setSelectedFile(name);
        setDataLoading(true);
        setMsg(null);
        try {
            const content = await data.read(accountId, "DefaultSettings", name);
            const parsed = (content as AppDefaultSettings) || {};
            setSettings(parsed);
            setJsonText(JSON.stringify(parsed, null, 2));
        } catch {
            setSettings({});
            setJsonText("{}");
        }
        setDataLoading(false);
    }, [accountId]);

    const loadFiles = useCallback(async () => {
        setLoading(true);
        if (!accountId) return;
        try {
            const list = await data.list(accountId, "DefaultSettings");
            const arr = Array.isArray(list) ? list : [];
            setFileList(arr);
            if (arr.length > 0 && !selectedFile) {
                selectFile(arr[0]);
            }
        } catch {
            setFileList([]);
        }
        setLoading(false);
    }, [accountId, selectedFile, selectFile]);

    useEffect(() => {
        loadFiles();
    }, [loadFiles]);

    async function handleSave() {
        if (!selectedFile) return;
        setSaving(true);
        setMsg(null);
        try {
            let payloadToSave = settings;
            if (jsonMode) {
                payloadToSave = JSON.parse(jsonText) as AppDefaultSettings;
                setSettings(payloadToSave);
            } else {
                setJsonText(JSON.stringify(settings, null, 2));
            }
            await data.write(accountId, "DefaultSettings", selectedFile, payloadToSave);
            setMsg({ type: "success", text: "客户端默认应用设置 (DefaultSettings) 已保存并递增版本号" });
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "保存失败" });
        }
        setSaving(false);
    }

    async function handleCreateFile(e: React.FormEvent) {
        e.preventDefault();
        const name = newFileName.trim();
        if (!name) return;
        try {
            await data.create(accountId, "DefaultSettings", name);
            setShowCreate(false);
            setNewFileName("");
            await loadFiles();
            selectFile(name);
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "创建失败" });
        }
    }

    async function handleDeleteFile(name: string) {
        if (!confirm(`确定删除 "${name}"？`)) return;
        try {
            await data.deleteData(accountId, "DefaultSettings", name);
            if (selectedFile === name) setSelectedFile(null);
            await loadFiles();
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "删除失败" });
        }
    }

    function update<K extends keyof AppDefaultSettings>(key: K, value: AppDefaultSettings[K]) {
        const next = { ...settings, [key]: value };
        setSettings(next);
        setJsonText(JSON.stringify(next, null, 2));
    }

    const slugName = currentAccount?.slug || "account";

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">默认设置管理</h1>
                    <p className="page-subtitle">
                        管理下发至 ClassIsland 客户端的应用外观、窗口停靠、提醒与语音参数 (DefaultSettings)
                    </p>
                </div>
                <div className="flex gap-8">
                    <Button appearance="primary" icon={<Add24Regular />} onClick={() => setShowCreate(true)}>新建文件</Button>
                    <Button appearance="secondary" icon={<ArrowSync24Regular />} onClick={loadFiles}>刷新</Button>
                </div>
            </div>

            {msg && (
                <MessageBar intent={msg.type} style={{ marginBottom: 16 }}>
                    <MessageBarBody>{msg.text}</MessageBarBody>
                </MessageBar>
            )}

            {/* 快速生成客户端集控接入引导文件 */}
            <div className="card" style={{ padding: "14px 20px" }}>
                <div className="flex items-center justify-between" style={{ flexWrap: "wrap", gap: 12 }}>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>客户端集控接入引导文件</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                            点击下载按钮可在气泡中选择保存为具名区分文件或客户端默认加载名。
                        </div>
                    </div>
                    <div className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                        <DownloadPresetPopoverButton
                            buttonText="下载通用配置 (仅接口地址)"
                            appearance="primary"
                            defaultFileName={`ManagementPreset-${slugName}-generic.json`}
                            onFetchData={() => accounts.downloadPreset(accountId, "")}
                            onError={(text) => setMsg({ type: "error", text })}
                        />
                        <Input
                            placeholder="预设班级标识 (可选，如 class-101)"
                            value={presetIdentity}
                            onChange={(_, d) => setPresetIdentity(d.value)}
                            style={{ width: 220 }}
                        />
                        <DownloadPresetPopoverButton
                            buttonText="下载带标识配置"
                            appearance="secondary"
                            defaultFileName={`ManagementPreset-${slugName}-${presetIdentity.trim() || "custom"}.json`}
                            onFetchData={() => accounts.downloadPreset(accountId, presetIdentity.trim())}
                            onError={(text) => setMsg({ type: "error", text })}
                        />
                    </div>
                </div>
            </div>

            <div className="flex gap-24">
                <div style={{ width: 240, flexShrink: 0 }}>
                    <div className="card">
                        <div className="card-title">默认设置文件</div>
                        {loading ? (
                            <Spinner size="small" />
                        ) : (
                            fileList.map((f) => (
                                <div
                                    key={f}
                                    className={`sidebar-link ${selectedFile === f ? "active" : ""}`}
                                    onClick={() => selectFile(f)}
                                >
                                    <span style={{ flex: 1 }}>{f}</span>
                                    <Button
                                        appearance="subtle"
                                        size="small"
                                        icon={<Delete24Regular />}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteFile(f);
                                        }}
                                        style={{ color: "var(--danger-color)", minWidth: 24, padding: 2 }}
                                    />
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div style={{ flex: 1 }}>
                    {!selectedFile ? (
                        <div className="card"><div className="empty-state"><div className="empty-state-text">请选择默认设置文件</div></div></div>
                    ) : dataLoading ? (
                        <div className="card"><div className="empty-state"><Spinner size="medium" /></div></div>
                    ) : (
                        <div className="card">
                            <div className="flex items-center justify-between mb-16">
                                <div className="card-title" style={{ margin: 0 }}>编辑默认设置: {selectedFile}</div>
                                <div className="flex gap-8">
                                    <DownloadPresetPopoverButton
                                        buttonText="导出 JSON"
                                        appearance="secondary"
                                        defaultFileName={`DefaultSettings-${selectedFile}.json`}
                                        suggestedNames={[
                                            { label: "具名区分文件 (推荐)", fileName: `DefaultSettings-${selectedFile}.json` },
                                            { label: "档案原名", fileName: `${selectedFile}.json` },
                                            { label: "客户端标准资源名", fileName: "DefaultSettings.json" },
                                        ]}
                                        onFetchData={async () => (jsonMode ? JSON.parse(jsonText) : settings)}
                                        onError={(text) => setMsg({ type: "error", text })}
                                    />
                                    <Button
                                        appearance="subtle"
                                        icon={<Code24Regular />}
                                        onClick={() => {
                                            if (!jsonMode) setJsonText(JSON.stringify(settings, null, 2));
                                            else {
                                                try { setSettings(JSON.parse(jsonText)); } catch { /* ignore */ }
                                            }
                                            setJsonMode(!jsonMode);
                                        }}
                                    >
                                        {jsonMode ? "切换可视化编辑" : "JSON 源码"}
                                    </Button>
                                    <Button appearance="primary" icon={<Save24Regular />} onClick={handleSave} disabled={saving}>
                                        {saving ? <Spinner size="tiny" /> : "保存"}
                                    </Button>
                                </div>
                            </div>

                            {jsonMode ? (
                                <div className="json-editor">
                                    <textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} style={{ minHeight: 420 }} />
                                </div>
                            ) : (
                                <>
                                    <div className="settings-section">
                                        <div className="settings-section-title">主窗口与停靠位置</div>
                                        <div className="grid-3">
                                            <div className="form-group">
                                                <label className="form-label">窗口停靠位置 (WindowDockingLocation)</label>
                                                <Select
                                                    value={String(settings.WindowDockingLocation ?? 1)}
                                                    onChange={(_, d) => update("WindowDockingLocation", parseInt(d.value, 10))}
                                                    style={{ width: "100%" }}
                                                >
                                                    <option value={0}>顶部左侧 (TopLeft)</option>
                                                    <option value={1}>顶部居中 (TopCenter)</option>
                                                    <option value={2}>顶部右侧 (TopRight)</option>
                                                    <option value={3}>底部左侧 (BottomLeft)</option>
                                                    <option value={4}>底部居中 (BottomCenter)</option>
                                                    <option value={5}>底部右侧 (BottomRight)</option>
                                                </Select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">窗口层级 (WindowLayer)</label>
                                                <Select
                                                    value={String(settings.WindowLayer ?? 1)}
                                                    onChange={(_, d) => update("WindowLayer", parseInt(d.value, 10))}
                                                    style={{ width: "100%" }}
                                                >
                                                    <option value={0}>置底 (Bottom)</option>
                                                    <option value={1}>置顶 (Topmost)</option>
                                                </Select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">界面缩放比例 (Scale)</label>
                                                <Input
                                                    type="number"
                                                    step={0.05}
                                                    min={0.5}
                                                    max={3.0}
                                                    value={String(settings.Scale ?? 1.0)}
                                                    onChange={(_, d) => update("Scale", parseFloat(d.value) || 1.0)}
                                                    style={{ width: "100%" }}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid-2">
                                            <div className="form-group">
                                                <label className="form-label">水平偏移 X (WindowDockingOffsetX)</label>
                                                <Input
                                                    type="number"
                                                    value={String(settings.WindowDockingOffsetX ?? 0)}
                                                    onChange={(_, d) => update("WindowDockingOffsetX", parseInt(d.value, 10) || 0)}
                                                    style={{ width: "100%" }}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">垂直偏移 Y (WindowDockingOffsetY)</label>
                                                <Input
                                                    type="number"
                                                    value={String(settings.WindowDockingOffsetY ?? 0)}
                                                    onChange={(_, d) => update("WindowDockingOffsetY", parseInt(d.value, 10) || 0)}
                                                    style={{ width: "100%" }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="settings-section">
                                        <div className="settings-section-title">外观主题与色彩</div>
                                        <div className="grid-2">
                                            <div className="form-group">
                                                <label className="form-label">明暗主题模式 (Theme)</label>
                                                <Select
                                                    value={String(settings.Theme ?? 0)}
                                                    onChange={(_, d) => update("Theme", parseInt(d.value, 10))}
                                                    style={{ width: "100%" }}
                                                >
                                                    <option value={0}>跟随系统 (System)</option>
                                                    <option value={1}>浅色模式 (Light)</option>
                                                    <option value={2}>深色模式 (Dark)</option>
                                                </Select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">主强调色 (PrimaryColor)</label>
                                                <div className="flex items-center gap-8">
                                                    <input
                                                        type="color"
                                                        value={settings.PrimaryColor || "#0078D4"}
                                                        onChange={(e) => update("PrimaryColor", e.target.value)}
                                                        style={{ width: 40, height: 32, border: "1px solid var(--border-color)", borderRadius: 4 }}
                                                    />
                                                    <Input
                                                        value={settings.PrimaryColor || "#0078D4"}
                                                        onChange={(_, d) => update("PrimaryColor", d.value)}
                                                        style={{ flex: 1 }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="settings-section">
                                        <div className="settings-section-title">提醒、语音与时间偏移</div>
                                        <div className="settings-item">
                                            <div className="settings-item-info">
                                                <div className="settings-item-label">启用上下课与集控桌面提醒 (IsNotificationEnabled)</div>
                                            </div>
                                            <Switch
                                                checked={settings.IsNotificationEnabled !== false}
                                                onChange={(_, d) => update("IsNotificationEnabled", d.checked)}
                                            />
                                        </div>
                                        <div className="settings-item">
                                            <div className="settings-item-info">
                                                <div className="settings-item-label">启用提醒全屏视觉特效 (IsNotificationEffectEnabled)</div>
                                            </div>
                                            <Switch
                                                checked={settings.IsNotificationEffectEnabled !== false}
                                                onChange={(_, d) => update("IsNotificationEffectEnabled", d.checked)}
                                            />
                                        </div>
                                        <div className="settings-item">
                                            <div className="settings-item-info">
                                                <div className="settings-item-label">启用提醒音效 (IsNotificationSoundEnabled)</div>
                                            </div>
                                            <Switch
                                                checked={settings.IsNotificationSoundEnabled !== false}
                                                onChange={(_, d) => update("IsNotificationSoundEnabled", d.checked)}
                                            />
                                        </div>
                                        <div className="settings-item">
                                            <div className="settings-item-info">
                                                <div className="settings-item-label">启用 TTS 语音播报 (IsSpeechEnabled)</div>
                                            </div>
                                            <Switch
                                                checked={settings.IsSpeechEnabled !== false}
                                                onChange={(_, d) => update("IsSpeechEnabled", d.checked)}
                                            />
                                        </div>

                                        <div className="grid-2 mt-16">
                                            <div className="form-group">
                                                <label className="form-label">语音播报音量 (SpeechVolume, 0~1)</label>
                                                <Input
                                                    type="number"
                                                    step={0.1}
                                                    min={0}
                                                    max={1}
                                                    value={String(settings.SpeechVolume ?? 1.0)}
                                                    onChange={(_, d) => update("SpeechVolume", parseFloat(d.value) || 1.0)}
                                                    style={{ width: "100%" }}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">时间偏移秒数 (TimeOffsetSeconds)</label>
                                                <Input
                                                    type="number"
                                                    step={1}
                                                    value={String(settings.TimeOffsetSeconds ?? 0)}
                                                    onChange={(_, d) => update("TimeOffsetSeconds", parseFloat(d.value) || 0)}
                                                    style={{ width: "100%" }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {showCreate && (
                <Dialog open onOpenChange={() => setShowCreate(false)}>
                    <DialogSurface>
                        <DialogBody>
                            <DialogTitle>新建默认设置文件</DialogTitle>
                            <DialogContent>
                                <div className="form-group">
                                    <label className="form-label">文件名</label>
                                    <Input
                                        value={newFileName}
                                        onChange={(_, d) => setNewFileName(d.value)}
                                        placeholder="如 default"
                                        style={{ width: "100%" }}
                                    />
                                </div>
                            </DialogContent>
                            <DialogActions>
                                <Button appearance="secondary" onClick={() => setShowCreate(false)}>取消</Button>
                                <Button appearance="primary" onClick={handleCreateFile} disabled={!newFileName.trim()}>创建</Button>
                            </DialogActions>
                        </DialogBody>
                    </DialogSurface>
                </Dialog>
            )}
        </div>
    );
}
