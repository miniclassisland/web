"use client";

import React, { useState, useEffect, useCallback } from "react";
import { data } from "@/lib/api";
import { useAccount } from "@/lib/account-context";
import type {
    ComponentProfile,
    ComponentLineSettings,
    ComponentSettingsItem,
    HorizontalAlignmentType,
} from "@/lib/types";
import { HORIZONTAL_ALIGNMENT_LABELS, BUILTIN_COMPONENTS } from "@/lib/types";
import {
    Button, Input, Select, Switch, Spinner, Textarea,
    MessageBar, MessageBarBody,
    Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions,
} from "@fluentui/react-components";
import {
    Add24Regular, Delete24Regular, Save24Regular, ArrowSync24Regular,
    ArrowUp24Regular, ArrowDown24Regular, Code24Regular,
} from "@fluentui/react-icons";
import DownloadPresetPopoverButton from "@/components/DownloadPresetPopoverButton";
import FileHistoryButton from "@/components/FileHistoryButton";

/** 将任意后端读取的组件配置标准化为上游 ComponentProfile ({ Lines: [...] }) */
function normalizeComponentProfile(raw: unknown): ComponentProfile {
    if (!raw || typeof raw !== "object") {
        return { Lines: [{ Children: [], IslandSeparationMode: 0, IsMainLine: true, IsEnabled: true }] };
    }
    if (Array.isArray(raw)) {
        // 兼容旧版扁平数组
        const hasChildren = raw.length > 0 && raw[0] && typeof raw[0] === "object" && "Children" in raw[0];
        if (hasChildren) {
            return { Lines: raw as ComponentLineSettings[] };
        }
        return {
            Lines: [
                {
                    Children: raw as ComponentSettingsItem[],
                    IslandSeparationMode: 0,
                    IsMainLine: true,
                    IsEnabled: true,
                },
            ],
        };
    }
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.Lines)) {
        const lines = (obj.Lines as Array<Record<string, unknown>>).map((line, i) => ({
            Children: Array.isArray(line.Children) ? (line.Children as ComponentSettingsItem[]) : [],
            IslandSeparationMode: typeof line.IslandSeparationMode === "number" ? line.IslandSeparationMode : 0,
            IsMainLine: typeof line.IsMainLine === "boolean" ? line.IsMainLine : i === 0,
            IsEnabled: typeof line.IsEnabled === "boolean" ? line.IsEnabled : true,
            HideOnRule: !!line.HideOnRule,
        }));
        return { Lines: lines.length > 0 ? lines : [{ Children: [], IslandSeparationMode: 0, IsMainLine: true, IsEnabled: true }] };
    }
    return { Lines: [{ Children: [], IslandSeparationMode: 0, IsMainLine: true, IsEnabled: true }] };
}

export default function ComponentsPage() {
    const { accountId } = useAccount();
    const [fileList, setFileList] = useState<string[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [profile, setProfile] = useState<ComponentProfile>({
        Lines: [{ Children: [], IslandSeparationMode: 0, IsMainLine: true, IsEnabled: true }],
    });
    const [selectedLineIdx, setSelectedLineIdx] = useState<number>(0);
    const [selectedCompIdx, setSelectedCompIdx] = useState<number>(-1);
    const [jsonMode, setJsonMode] = useState(false);
    const [jsonText, setJsonText] = useState("{}");

    const [loading, setLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [newFileName, setNewFileName] = useState("");

    const selectFile = useCallback(async (name: string) => {
        if (!accountId) return;
        setSelectedFile(name);
        setSelectedLineIdx(0);
        setSelectedCompIdx(-1);
        setDataLoading(true);
        try {
            const content = await data.read(accountId, "Components", name);
            const normalized = normalizeComponentProfile(content);
            setProfile(normalized);
            setJsonText(JSON.stringify(normalized, null, 2));
            if ((normalized.Lines[0]?.Children?.length || 0) > 0) {
                setSelectedCompIdx(0);
            }
        } catch {
            const fallback = normalizeComponentProfile(null);
            setProfile(fallback);
            setJsonText(JSON.stringify(fallback, null, 2));
        }
        setDataLoading(false);
    }, [accountId]);

    const loadFiles = useCallback(async () => {
        setLoading(true);
        if (!accountId) return;
        try {
            const list = await data.list(accountId, "Components");
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
            let payloadToSave = profile;
            if (jsonMode) {
                payloadToSave = normalizeComponentProfile(JSON.parse(jsonText));
                setProfile(payloadToSave);
            } else {
                setJsonText(JSON.stringify(profile, null, 2));
            }
            await data.write(accountId, "Components", selectedFile, payloadToSave);
            setMsg({ type: "success", text: "组件布局配置 (ComponentProfile) 已保存并递增版本号" });
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "保存失败，请检查 JSON 格式" });
        }
        setSaving(false);
    }

    async function handleCreateFile(e: React.FormEvent) {
        e.preventDefault();
        const name = newFileName.trim();
        if (!name) return;
        try {
            await data.create(accountId, "Components", name);
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
            await data.deleteData(accountId, "Components", name);
            if (selectedFile === name) setSelectedFile(null);
            await loadFiles();
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "删除失败" });
        }
    }

    function addLine() {
        const nextLines: ComponentLineSettings[] = [
            ...profile.Lines,
            {
                Children: [],
                IslandSeparationMode: 0,
                IsMainLine: profile.Lines.length === 0,
                IsEnabled: true,
            },
        ];
        const next = { Lines: nextLines };
        setProfile(next);
        setJsonText(JSON.stringify(next, null, 2));
        setSelectedLineIdx(nextLines.length - 1);
        setSelectedCompIdx(-1);
    }

    function deleteLine(lineIdx: number) {
        if (profile.Lines.length <= 1) {
            setMsg({ type: "error", text: "至少需要保留一行主界面组件行" });
            return;
        }
        const nextLines = profile.Lines.filter((_, i) => i !== lineIdx);
        const next = { Lines: nextLines };
        setProfile(next);
        setJsonText(JSON.stringify(next, null, 2));
        setSelectedLineIdx(0);
        setSelectedCompIdx(-1);
    }

    function updateLine(lineIdx: number, updater: (line: ComponentLineSettings) => ComponentLineSettings) {
        const nextLines = [...profile.Lines];
        nextLines[lineIdx] = updater(nextLines[lineIdx]);
        const next = { Lines: nextLines };
        setProfile(next);
        setJsonText(JSON.stringify(next, null, 2));
    }

    function addComponentToLine(templateId: string, templateName: string) {
        const currentLine = profile.Lines[selectedLineIdx];
        if (!currentLine) return;
        const newComp: ComponentSettingsItem = {
            Id: templateId,
            NameCache: templateName,
            HideOnRule: false,
            IsResourceOverridingEnabled: false,
            MainWindowSecondaryFontSize: 14,
            MainWindowBodyFontSize: 16,
            MainWindowEmphasizedFontSize: 18,
            MainWindowLargeFontSize: 20,
            Opacity: 1,
            HorizontalAlignment: 1,
        };
        updateLine(selectedLineIdx, (line) => ({
            ...line,
            Children: [...(line.Children || []), newComp],
        }));
        setSelectedCompIdx((currentLine.Children || []).length);
    }

    function moveComponent(compIdx: number, dir: -1 | 1) {
        const currentLine = profile.Lines[selectedLineIdx];
        if (!currentLine) return;
        const children = [...(currentLine.Children || [])];
        const target = compIdx + dir;
        if (target < 0 || target >= children.length) return;
        const tmp = children[compIdx];
        children[compIdx] = children[target];
        children[target] = tmp;
        updateLine(selectedLineIdx, (line) => ({ ...line, Children: children }));
        setSelectedCompIdx(target);
    }

    function deleteComponent(compIdx: number) {
        const currentLine = profile.Lines[selectedLineIdx];
        if (!currentLine) return;
        const children = (currentLine.Children || []).filter((_, i) => i !== compIdx);
        updateLine(selectedLineIdx, (line) => ({ ...line, Children: children }));
        setSelectedCompIdx(-1);
    }

    function updateComp<K extends keyof ComponentSettingsItem>(
        compIdx: number,
        key: K,
        value: ComponentSettingsItem[K]
    ) {
        updateLine(selectedLineIdx, (line) => {
            const children = [...(line.Children || [])];
            children[compIdx] = { ...children[compIdx], [key]: value };
            return { ...line, Children: children };
        });
    }

    const currentLine = profile.Lines[selectedLineIdx] || null;
    const currentComp =
        currentLine && selectedCompIdx >= 0 && selectedCompIdx < (currentLine.Children || []).length
            ? currentLine.Children[selectedCompIdx]
            : null;

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">组件设置管理</h1>
                    <p className="page-subtitle">
                        管理 ClassIsland 主界面多行组件布局与样式 (ComponentProfile / Lines)
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

            <div className="profile-split-layout">
                {/* 左侧文件与组件行列表 */}
                <div className="profile-split-sidebar">
                    <div className="card mb-16">
                        <div className="card-title">组件文件</div>
                        {loading ? (
                            <Spinner size="small" />
                        ) : (
                            fileList.map((f) => (
                                <div
                                    key={f}
                                    className={`sidebar-link ${selectedFile === f ? "active" : ""}`}
                                    onClick={() => selectFile(f)}
                                >
                                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{f}</span>
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

                    {selectedFile && !dataLoading && !jsonMode && (
                        <div className="card">
                            <div className="flex items-center justify-between mb-8">
                                <div className="card-title" style={{ margin: 0 }}>主界面行 (Lines)</div>
                                <Button appearance="subtle" size="small" icon={<Add24Regular />} onClick={addLine} title="新增组件行" />
                            </div>
                            {profile.Lines.map((line, lIdx) => (
                                <div key={lIdx} style={{ marginBottom: 12 }}>
                                    <div
                                        className={`sidebar-link ${selectedLineIdx === lIdx ? "active" : ""}`}
                                        onClick={() => {
                                            setSelectedLineIdx(lIdx);
                                            setSelectedCompIdx((line.Children || []).length > 0 ? 0 : -1);
                                        }}
                                    >
                                        <span style={{ flex: 1, fontWeight: 600 }}>
                                            第 {lIdx + 1} 行 {line.IsMainLine ? "(主行)" : ""}
                                        </span>
                                        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                                            {(line.Children || []).length} 个组件
                                        </span>
                                        {profile.Lines.length > 1 && (
                                            <Button
                                                appearance="subtle"
                                                size="small"
                                                icon={<Delete24Regular />}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteLine(lIdx);
                                                }}
                                                style={{ color: "var(--danger-color)", minWidth: 22, padding: 0 }}
                                            />
                                        )}
                                    </div>
                                    {selectedLineIdx === lIdx && (
                                        <div style={{ paddingLeft: 12, marginTop: 4 }}>
                                            {(line.Children || []).map((comp, cIdx) => {
                                                const builtin = BUILTIN_COMPONENTS.find((b) => b.id === comp.Id);
                                                return (
                                                    <div
                                                        key={cIdx}
                                                        className={`sidebar-link ${selectedCompIdx === cIdx ? "active" : ""}`}
                                                        onClick={() => setSelectedCompIdx(cIdx)}
                                                        style={{ padding: "6px 10px" }}
                                                    >
                                                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                                                            {comp.NameCache || builtin?.name || `组件 #${cIdx + 1}`}
                                                        </span>
                                                        <div className="flex gap-4">
                                                            <Button
                                                                appearance="subtle"
                                                                size="small"
                                                                icon={<ArrowUp24Regular />}
                                                                disabled={cIdx === 0}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    moveComponent(cIdx, -1);
                                                                }}
                                                                style={{ minWidth: 20, padding: 0 }}
                                                            />
                                                            <Button
                                                                appearance="subtle"
                                                                size="small"
                                                                icon={<ArrowDown24Regular />}
                                                                disabled={cIdx === (line.Children || []).length - 1}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    moveComponent(cIdx, 1);
                                                                }}
                                                                style={{ minWidth: 20, padding: 0 }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 右侧编辑区 */}
                <div style={{ flex: 1 }}>
                    {!selectedFile ? (
                        <div className="card"><div className="empty-state"><div className="empty-state-text">请选择组件配置文件</div></div></div>
                    ) : dataLoading ? (
                        <div className="card"><div className="empty-state"><Spinner size="medium" /></div></div>
                    ) : (
                        <div className="card">
                            <div className="flex items-center justify-between mb-16">
                                <div className="card-title" style={{ margin: 0 }}>
                                    编辑组件档案: {selectedFile}
                                </div>
                                <div className="flex gap-8" style={{ flexWrap: "wrap" }}>
                                    <FileHistoryButton
                                        accountId={accountId}
                                        resourceType="Components"
                                        fileName={selectedFile}
                                        onLoadVersion={(content, version, isCurrent) => {
                                            const normalized = normalizeComponentProfile(content);
                                            setProfile(normalized);
                                            setJsonText(JSON.stringify(normalized, null, 2));
                                            setSelectedLineIdx(0);
                                            setSelectedCompIdx((normalized.Lines[0]?.Children?.length || 0) > 0 ? 0 : -1);
                                            setMsg({
                                                type: "success",
                                                text: isCurrent
                                                    ? `已加载当前最新版本 v${version}`
                                                    : `已加载历史版本 v${version} 到编辑器（点击「保存」将创建一个新版本，不会覆盖历史版本）`,
                                            });
                                        }}
                                        onError={(text) => setMsg({ type: "error", text })}
                                    />
                                    <DownloadPresetPopoverButton
                                        buttonText="导出 JSON"
                                        appearance="secondary"
                                        defaultFileName={`Components-${selectedFile}.json`}
                                        suggestedNames={[
                                            { label: "具名区分文件 (推荐)", fileName: `Components-${selectedFile}.json` },
                                            { label: "档案原名", fileName: `${selectedFile}.json` },
                                            { label: "客户端标准资源名", fileName: "Components.json" },
                                        ]}
                                        onFetchData={async () => (jsonMode ? JSON.parse(jsonText) : profile)}
                                        onError={(text) => setMsg({ type: "error", text })}
                                    />
                                    <Button
                                        appearance="subtle"
                                        icon={<Code24Regular />}
                                        onClick={() => {
                                            if (!jsonMode) setJsonText(JSON.stringify(profile, null, 2));
                                            else {
                                                try {
                                                    setProfile(normalizeComponentProfile(JSON.parse(jsonText)));
                                                } catch { /* ignore */ }
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
                                    <textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} style={{ minHeight: 440 }} />
                                </div>
                            ) : (
                                <>
                                    {/* 当前行属性与内置组件快速添加栏 */}
                                    {currentLine && (
                                        <div className="card" style={{ background: "var(--bg-subtle)", marginBottom: 16 }}>
                                            <div className="flex items-center justify-between mb-12" style={{ flexWrap: "wrap", gap: 12 }}>
                                                <div style={{ fontWeight: 600 }}>
                                                    第 {selectedLineIdx + 1} 行设置
                                                </div>
                                                <div className="flex items-center gap-16">
                                                    <Switch
                                                        checked={currentLine.IsEnabled !== false}
                                                        onChange={(_, d) =>
                                                            updateLine(selectedLineIdx, (l) => ({ ...l, IsEnabled: d.checked }))
                                                        }
                                                        label="启用本行"
                                                    />
                                                    <Switch
                                                        checked={!!currentLine.IsMainLine}
                                                        onChange={(_, d) =>
                                                            updateLine(selectedLineIdx, (l) => ({ ...l, IsMainLine: d.checked }))
                                                        }
                                                        label="设为主行 (IsMainLine)"
                                                    />
                                                    <Select
                                                        value={String(currentLine.IslandSeparationMode ?? 0)}
                                                        onChange={(_, d) =>
                                                            updateLine(selectedLineIdx, (l) => ({
                                                                ...l,
                                                                IslandSeparationMode: parseInt(d.value, 10),
                                                            }))
                                                        }
                                                    >
                                                        <option value={0}>岛分离模式：默认 (0)</option>
                                                        <option value={1}>岛分离模式：继承 (1)</option>
                                                        <option value={2}>岛分离模式：整体停靠 (2)</option>
                                                        <option value={3}>岛分离模式：按组件分离 (3)</option>
                                                    </Select>
                                                </div>
                                            </div>

                                            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
                                                点击添加 ClassIsland 内置组件至第 {selectedLineIdx + 1} 行：
                                            </div>
                                            <div className="flex gap-8" style={{ flexWrap: "wrap" }}>
                                                {BUILTIN_COMPONENTS.map((b) => (
                                                    <Button
                                                        key={b.id}
                                                        size="small"
                                                        appearance="secondary"
                                                        icon={<Add24Regular />}
                                                        onClick={() => addComponentToLine(b.id, b.name)}
                                                        title={b.desc}
                                                    >
                                                        {b.name}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 选中组件详情编辑器 */}
                                    {!currentComp ? (
                                        <div className="empty-state" style={{ padding: 32 }}>
                                            <div className="empty-state-text">
                                                请从左侧点击某个组件进行详细参数编辑，或点击上方按钮向当前行添加组件
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="flex items-center justify-between mb-16">
                                                <div className="flex items-center gap-12">
                                                    <Input
                                                        value={currentComp.NameCache || ""}
                                                        onChange={(_, d) => updateComp(selectedCompIdx, "NameCache", d.value)}
                                                        placeholder="组件显示名称备注"
                                                        style={{ fontWeight: 600 }}
                                                    />
                                                    <Select
                                                        value={currentComp.Id || ""}
                                                        onChange={(_, d) => {
                                                            const found = BUILTIN_COMPONENTS.find((b) => b.id === d.value);
                                                            updateComp(selectedCompIdx, "Id", d.value);
                                                            if (found) updateComp(selectedCompIdx, "NameCache", found.name);
                                                        }}
                                                    >
                                                        <option value="">-- 自定义组件 GUID --</option>
                                                        {BUILTIN_COMPONENTS.map((b) => (
                                                            <option key={b.id} value={b.id}>{b.name} ({b.id.slice(0, 8)}...)</option>
                                                        ))}
                                                    </Select>
                                                </div>
                                                <Button
                                                    appearance="subtle"
                                                    icon={<Delete24Regular />}
                                                    onClick={() => deleteComponent(selectedCompIdx)}
                                                    style={{ color: "var(--danger-color)" }}
                                                >
                                                    移除此组件
                                                </Button>
                                            </div>

                                            <div className="grid-2 mb-16">
                                                <div className="form-group">
                                                    <label className="form-label">组件类型 GUID (Id)</label>
                                                    <Input
                                                        value={currentComp.Id || ""}
                                                        onChange={(_, d) => updateComp(selectedCompIdx, "Id", d.value)}
                                                        style={{ width: "100%" }}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">水平对齐方式 (HorizontalAlignment)</label>
                                                    <Select
                                                        value={String(currentComp.HorizontalAlignment ?? 1)}
                                                        onChange={(_, d) =>
                                                            updateComp(
                                                                selectedCompIdx,
                                                                "HorizontalAlignment",
                                                                parseInt(d.value, 10) as HorizontalAlignmentType
                                                            )
                                                        }
                                                        style={{ width: "100%" }}
                                                    >
                                                        {([0, 1, 2, 3] as HorizontalAlignmentType[]).map((v) => (
                                                            <option key={v} value={v}>{HORIZONTAL_ALIGNMENT_LABELS[v]}</option>
                                                        ))}
                                                    </Select>
                                                </div>
                                            </div>

                                            <div className="settings-section">
                                                <div className="settings-section-title">样式与布局覆盖</div>
                                                <div className="settings-item">
                                                    <div className="settings-item-info">
                                                        <div className="settings-item-label">启用字体大小覆盖 (IsResourceOverridingEnabled)</div>
                                                    </div>
                                                    <Switch
                                                        checked={!!currentComp.IsResourceOverridingEnabled}
                                                        onChange={(_, d) =>
                                                            updateComp(selectedCompIdx, "IsResourceOverridingEnabled", d.checked)
                                                        }
                                                    />
                                                </div>
                                                {currentComp.IsResourceOverridingEnabled && (
                                                    <div className="grid-4 mt-8 mb-16">
                                                        {([
                                                            ["MainWindowSecondaryFontSize", "次要字号", 14],
                                                            ["MainWindowBodyFontSize", "正文字号", 16],
                                                            ["MainWindowEmphasizedFontSize", "强调字号", 18],
                                                            ["MainWindowLargeFontSize", "大号字号", 20],
                                                        ] as [keyof ComponentSettingsItem, string, number][]).map(([key, label, def]) => (
                                                            <div className="form-group" key={key}>
                                                                <label className="form-label">{label}</label>
                                                                <Input
                                                                    type="number"
                                                                    value={String((currentComp[key] as number) ?? def)}
                                                                    onChange={(_, d) =>
                                                                        updateComp(selectedCompIdx, key, parseFloat(d.value) || def)
                                                                    }
                                                                    style={{ width: "100%" }}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="grid-2 mt-8">
                                                    <div className="settings-item">
                                                        <div className="settings-item-info">
                                                            <div className="settings-item-label">自定义前景色</div>
                                                        </div>
                                                        <div className="flex items-center gap-8">
                                                            <Switch
                                                                checked={!!currentComp.IsCustomForegroundColorEnabled}
                                                                onChange={(_, d) =>
                                                                    updateComp(selectedCompIdx, "IsCustomForegroundColorEnabled", d.checked)
                                                                }
                                                            />
                                                            {currentComp.IsCustomForegroundColorEnabled && (
                                                                <input
                                                                    type="color"
                                                                    value={currentComp.ForegroundColor || "#0078d4"}
                                                                    onChange={(e) =>
                                                                        updateComp(selectedCompIdx, "ForegroundColor", e.target.value)
                                                                    }
                                                                    style={{ width: 36, height: 28, border: "1px solid var(--border-color)", borderRadius: 4 }}
                                                                />
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="settings-item">
                                                        <div className="settings-item-info">
                                                            <div className="settings-item-label">自定义背景色</div>
                                                        </div>
                                                        <div className="flex items-center gap-8">
                                                            <Switch
                                                                checked={!!currentComp.IsCustomBackgroundColorEnabled}
                                                                onChange={(_, d) =>
                                                                    updateComp(selectedCompIdx, "IsCustomBackgroundColorEnabled", d.checked)
                                                                }
                                                            />
                                                            {currentComp.IsCustomBackgroundColorEnabled && (
                                                                <input
                                                                    type="color"
                                                                    value={currentComp.BackgroundColor || "#000000"}
                                                                    onChange={(e) =>
                                                                        updateComp(selectedCompIdx, "BackgroundColor", e.target.value)
                                                                    }
                                                                    style={{ width: 36, height: 28, border: "1px solid var(--border-color)", borderRadius: 4 }}
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid-3 mt-8">
                                                    <div className="form-group">
                                                        <label className="form-label">整体不透明度 (Opacity)</label>
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            max={1}
                                                            step={0.05}
                                                            value={String(currentComp.Opacity ?? 1)}
                                                            onChange={(_, d) =>
                                                                updateComp(selectedCompIdx, "Opacity", parseFloat(d.value) || 1)
                                                            }
                                                            style={{ width: "100%" }}
                                                        />
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="form-label">固定宽度 (px, 0=自动)</label>
                                                        <Input
                                                            type="number"
                                                            value={String(currentComp.FixedWidth ?? 0)}
                                                            onChange={(_, d) => {
                                                                const v = parseFloat(d.value) || 0;
                                                                updateComp(selectedCompIdx, "IsFixedWidthEnabled", v > 0);
                                                                updateComp(selectedCompIdx, "FixedWidth", v);
                                                            }}
                                                            style={{ width: "100%" }}
                                                        />
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="form-label">按规则隐藏 (HideOnRule)</label>
                                                        <Switch
                                                            checked={!!currentComp.HideOnRule}
                                                            onChange={(_, d) =>
                                                                updateComp(selectedCompIdx, "HideOnRule", d.checked)
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="settings-section">
                                                <div className="settings-section-title">组件专属参数 (Settings JSON)</div>
                                                <div className="json-editor">
                                                    <Textarea
                                                        value={currentComp.Settings ? JSON.stringify(currentComp.Settings, null, 2) : "{}"}
                                                        onChange={(_, d) => {
                                                            try {
                                                                updateComp(selectedCompIdx, "Settings", JSON.parse(d.value));
                                                            } catch { /* ignore while typing */ }
                                                        }}
                                                        style={{ width: "100%", minHeight: 120 }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
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
                            <DialogTitle>新建组件配置文件</DialogTitle>
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
