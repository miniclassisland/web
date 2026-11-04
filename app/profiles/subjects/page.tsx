"use client";

import React, { useState, useEffect, useCallback } from "react";
import { data } from "@/lib/api";
import { useAccount } from "@/lib/account-context";
import type { Subject } from "@/lib/types";
import {
    Button, Input, Switch, Spinner,
    MessageBar, MessageBarBody,
    Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions,
} from "@fluentui/react-components";
import {
    Add24Regular, Delete24Regular, Save24Regular, ArrowSync24Regular,
    ArrowUp24Regular, ArrowDown24Regular, Code24Regular,
} from "@fluentui/react-icons";
import DownloadPresetPopoverButton from "@/components/DownloadPresetPopoverButton";

type SubjectsData = Record<string, Subject>;

export default function SubjectsPage() {
    const { accountId } = useAccount();
    const [fileList, setFileList] = useState<string[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [subjects, setSubjects] = useState<SubjectsData>({});
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
        setDataLoading(true);
        setMsg(null);
        try {
            const content = await data.read(accountId, "Subjects", name);
            let parsed: SubjectsData = {};
            if (content && typeof content === "object") {
                const obj = content as Record<string, unknown>;
                if (obj.Subjects && typeof obj.Subjects === "object") {
                    parsed = obj.Subjects as SubjectsData;
                } else {
                    parsed = obj as SubjectsData;
                }
            }
            setSubjects(parsed);
            setJsonText(JSON.stringify(parsed, null, 2));
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "加载失败" });
            setSubjects({});
            setJsonText("{}");
        }
        setDataLoading(false);
    }, [accountId]);

    const loadFiles = useCallback(async () => {
        setLoading(true);
        if (!accountId) return;
        try {
            const list = await data.list(accountId, "Subjects");
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
            let payloadToSave = subjects;
            if (jsonMode) {
                payloadToSave = JSON.parse(jsonText) as SubjectsData;
                setSubjects(payloadToSave);
            } else {
                setJsonText(JSON.stringify(subjects, null, 2));
            }
            const wrapperPayload =
                payloadToSave && typeof payloadToSave === "object" && "Subjects" in payloadToSave
                    ? payloadToSave
                    : { Subjects: payloadToSave };
            await data.write(accountId, "Subjects", selectedFile, wrapperPayload);
            setMsg({ type: "success", text: "科目数据已保存并递增版本号" });
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "保存失败，请检查 JSON 格式" });
        }
        setSaving(false);
    }

    async function handleCreateFile(e: React.FormEvent) {
        e.preventDefault();
        if (!newFileName.trim()) return;
        const name = newFileName.trim();
        try {
            await data.create(accountId, "Subjects", name);
            setMsg({ type: "success", text: `文件 "${name}" 已创建` });
            setShowCreate(false);
            setNewFileName("");
            await loadFiles();
            selectFile(name);
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "创建失败" });
        }
    }

    async function handleDeleteFile(name: string) {
        if (!confirm(`确定要删除科目文件 "${name}" 吗？`)) return;
        try {
            await data.deleteData(accountId, "Subjects", name);
            if (selectedFile === name) {
                setSelectedFile(null);
                setSubjects({});
            }
            await loadFiles();
            setMsg({ type: "success", text: "文件已删除" });
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "删除失败" });
        }
    }

    function addSubject() {
        const id = crypto.randomUUID();
        const next: SubjectsData = {
            ...subjects,
            [id]: { Name: "新科目", Initial: "新", TeacherName: "", IsOutDoor: false, AttachedObjects: {} },
        };
        setSubjects(next);
        setJsonText(JSON.stringify(next, null, 2));
    }

    function updateSubject(id: string, field: keyof Subject, value: string | boolean) {
        const copy = { ...subjects };
        copy[id] = { ...copy[id], [field]: value };
        if (field === "Name" && typeof value === "string" && value.length > 0 && !copy[id].Initial) {
            copy[id].Initial = value[0];
        }
        setSubjects(copy);
        setJsonText(JSON.stringify(copy, null, 2));
    }

    function moveSubject(id: string, dir: -1 | 1) {
        const entries = Object.entries(subjects);
        const idx = entries.findIndex(([k]) => k === id);
        if (idx < 0) return;
        const targetIdx = idx + dir;
        if (targetIdx < 0 || targetIdx >= entries.length) return;
        const temp = entries[idx];
        entries[idx] = entries[targetIdx];
        entries[targetIdx] = temp;
        const next = Object.fromEntries(entries);
        setSubjects(next);
        setJsonText(JSON.stringify(next, null, 2));
    }

    function deleteSubject(id: string) {
        const copy = { ...subjects };
        delete copy[id];
        setSubjects(copy);
        setJsonText(JSON.stringify(copy, null, 2));
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">科目管理</h1>
                    <p className="page-subtitle">管理 ClassIsland 科目档案 (Subjects)</p>
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

            <div className="flex gap-24">
                <div style={{ width: 240, flexShrink: 0 }}>
                    <div className="card">
                        <div className="card-title">科目文件</div>
                        {loading ? (
                            <Spinner size="small" />
                        ) : fileList.length === 0 ? (
                            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>暂无文件</div>
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
                </div>

                <div style={{ flex: 1 }}>
                    {!selectedFile ? (
                        <div className="card">
                            <div className="empty-state">
                                <div className="empty-state-text">请从左侧选择一个科目文件</div>
                            </div>
                        </div>
                    ) : dataLoading ? (
                        <div className="card">
                            <div className="empty-state"><Spinner size="medium" /></div>
                        </div>
                    ) : (
                        <div className="card">
                            <div className="flex items-center justify-between mb-16">
                                <div className="card-title" style={{ margin: 0 }}>
                                    编辑科目文件: {selectedFile} ({Object.keys(subjects).length} 门科目)
                                </div>
                                <div className="flex gap-8">
                                    <DownloadPresetPopoverButton
                                        buttonText="导出 JSON"
                                        appearance="secondary"
                                        defaultFileName={`Subjects-${selectedFile}.json`}
                                        suggestedNames={[
                                            { label: "具名区分文件 (推荐)", fileName: `Subjects-${selectedFile}.json` },
                                            { label: "档案原名", fileName: `${selectedFile}.json` },
                                            { label: "客户端标准资源名", fileName: "Subjects.json" },
                                        ]}
                                        onFetchData={async () => (jsonMode ? JSON.parse(jsonText) : subjects)}
                                        onError={(text) => setMsg({ type: "error", text })}
                                    />
                                    <Button
                                        appearance="subtle"
                                        icon={<Code24Regular />}
                                        onClick={() => {
                                            if (!jsonMode) {
                                                setJsonText(JSON.stringify(subjects, null, 2));
                                            } else {
                                                try {
                                                    setSubjects(JSON.parse(jsonText));
                                                } catch {
                                                    /* keep current */
                                                }
                                            }
                                            setJsonMode(!jsonMode);
                                        }}
                                    >
                                        {jsonMode ? "切换可视化编辑" : "JSON 源码"}
                                    </Button>
                                    {!jsonMode && (
                                        <Button appearance="secondary" icon={<Add24Regular />} onClick={addSubject}>
                                            添加科目
                                        </Button>
                                    )}
                                    <Button appearance="primary" icon={<Save24Regular />} onClick={handleSave} disabled={saving}>
                                        {saving ? <Spinner size="tiny" /> : "保存"}
                                    </Button>
                                </div>
                            </div>

                            {jsonMode ? (
                                <div className="json-editor">
                                    <textarea
                                        value={jsonText}
                                        onChange={(e) => setJsonText(e.target.value)}
                                        style={{ minHeight: 420 }}
                                    />
                                </div>
                            ) : Object.keys(subjects).length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-state-text">暂无科目，点击「添加科目」开始</div>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    {Object.entries(subjects).map(([id, sub], idx, arr) => (
                                        <div
                                            key={id}
                                            className="card"
                                            style={{ padding: 16, margin: 0, border: "1px solid var(--border-color)" }}
                                        >
                                            <div className="flex items-center gap-12" style={{ flexWrap: "wrap" }}>
                                                <div
                                                    style={{
                                                        width: 44,
                                                        height: 44,
                                                        borderRadius: 8,
                                                        background: sub.IsOutDoor ? "var(--success-color)" : "var(--accent-color)",
                                                        color: "white",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        fontWeight: 700,
                                                        fontSize: 18,
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    {sub.Initial || sub.Name?.[0] || "?"}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 150 }}>
                                                    <label className="form-label">科目名称 (Name)</label>
                                                    <Input
                                                        value={sub.Name || ""}
                                                        onChange={(_, d) => updateSubject(id, "Name", d.value)}
                                                        style={{ width: "100%" }}
                                                    />
                                                </div>
                                                <div style={{ width: 90 }}>
                                                    <label className="form-label">简称 (Initial)</label>
                                                    <Input
                                                        value={sub.Initial || ""}
                                                        onChange={(_, d) => updateSubject(id, "Initial", d.value)}
                                                        style={{ width: "100%" }}
                                                    />
                                                </div>
                                                <div style={{ flex: 1, minWidth: 150 }}>
                                                    <label className="form-label">任课教师 (TeacherName)</label>
                                                    <Input
                                                        value={sub.TeacherName || ""}
                                                        onChange={(_, d) => updateSubject(id, "TeacherName", d.value)}
                                                        placeholder="可选"
                                                        style={{ width: "100%" }}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="form-label">户外课程</label>
                                                    <Switch
                                                        checked={!!sub.IsOutDoor}
                                                        onChange={(_, d) => updateSubject(id, "IsOutDoor", d.checked)}
                                                    />
                                                </div>
                                                <div className="flex gap-4">
                                                    <Button
                                                        appearance="subtle"
                                                        size="small"
                                                        icon={<ArrowUp24Regular />}
                                                        disabled={idx === 0}
                                                        onClick={() => moveSubject(id, -1)}
                                                        title="上移"
                                                    />
                                                    <Button
                                                        appearance="subtle"
                                                        size="small"
                                                        icon={<ArrowDown24Regular />}
                                                        disabled={idx === arr.length - 1}
                                                        onClick={() => moveSubject(id, 1)}
                                                        title="下移"
                                                    />
                                                    <Button
                                                        appearance="subtle"
                                                        size="small"
                                                        icon={<Delete24Regular />}
                                                        onClick={() => deleteSubject(id)}
                                                        style={{ color: "var(--danger-color)" }}
                                                        title="删除科目"
                                                    />
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6 }}>
                                                科目 GUID: {id}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {showCreate && (
                <Dialog open onOpenChange={() => setShowCreate(false)}>
                    <DialogSurface>
                        <DialogBody>
                            <DialogTitle>新建科目文件</DialogTitle>
                            <DialogContent>
                                <div className="form-group">
                                    <label className="form-label">文件名</label>
                                    <Input
                                        value={newFileName}
                                        onChange={(_, d) => setNewFileName(d.value)}
                                        placeholder="如 default 或 senior-1"
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
