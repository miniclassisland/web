"use client";

import React, { useState, useEffect, useCallback } from "react";
import { data } from "@/lib/api";
import { useAccount } from "@/lib/account-context";
import type { TimeLayout, TimeLayoutItem, TimeType, Subject } from "@/lib/types";
import { TIME_TYPE_LABELS } from "@/lib/types";
import {
    Button, Input, Select, Switch, Spinner,
    MessageBar, MessageBarBody,
    Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions,
} from "@fluentui/react-components";
import {
    Add24Regular, Delete24Regular, Save24Regular, ArrowSync24Regular,
    ArrowUp24Regular, ArrowDown24Regular, Code24Regular, ArrowSort24Regular,
} from "@fluentui/react-icons";
import DownloadPresetPopoverButton from "@/components/DownloadPresetPopoverButton";

type TimeLayoutsData = Record<string, TimeLayout>;
type SubjectsData = Record<string, Subject>;

/** 从 StartSecond (ISO) 或 StartTime (HH:mm:ss) 提取 HH:mm */
function extractHHMM(item: TimeLayoutItem, field: "start" | "end"): string {
    const raw = field === "start" ? (item.StartSecond || item.StartTime || "") : (item.EndSecond || item.EndTime || "");
    if (!raw) return "08:00";
    const tIndex = raw.indexOf("T");
    const timePart = tIndex >= 0 ? raw.slice(tIndex + 1) : raw;
    const parts = timePart.split(":");
    return `${(parts[0] || "08").padStart(2, "0")}:${(parts[1] || "00").padStart(2, "0")}`;
}

/** 将 HH:mm 转为上游兼容的 StartSecond (1970-01-01THH:mm:00) 和 StartTime (HH:mm:00) */
function toTimeStrings(hhmm: string): { iso: string; span: string } {
    const [h, m] = (hhmm || "08:00").split(":").map((v) => parseInt(v, 10) || 0);
    const span = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
    return {
        iso: `1970-01-01T${span}`,
        span,
    };
}

function addMinutesToHHMM(hhmm: string, mins: number): string {
    const [h, m] = (hhmm || "08:00").split(":").map((v) => parseInt(v, 10) || 0);
    const total = Math.min(23 * 60 + 59, Math.max(0, h * 60 + m + mins));
    const nh = Math.floor(total / 60);
    const nm = total % 60;
    return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

export default function TimeLayoutPage() {
    const { accountId } = useAccount();
    const [fileList, setFileList] = useState<string[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [layouts, setLayouts] = useState<TimeLayoutsData>({});
    const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);

    // 关联科目参考文件（供默认科目选择）
    const [subjectFiles, setSubjectFiles] = useState<string[]>([]);
    const [selectedSubjectFile, setSelectedSubjectFile] = useState<string>("");
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
        setSelectedLayoutId(null);
        setDataLoading(true);
        try {
            const content = await data.read(accountId, "TimeLayout", name);
            let parsed: TimeLayoutsData = {};
            if (content && typeof content === "object") {
                const obj = content as Record<string, unknown>;
                if (obj.TimeLayouts && typeof obj.TimeLayouts === "object") {
                    parsed = obj.TimeLayouts as TimeLayoutsData;
                } else {
                    parsed = obj as TimeLayoutsData;
                }
            }
            setLayouts(parsed);
            setJsonText(JSON.stringify(parsed, null, 2));
            const firstId = Object.keys(parsed)[0] || null;
            setSelectedLayoutId(firstId);
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "加载失败" });
            setLayouts({});
            setJsonText("{}");
        }
        setDataLoading(false);
    }, [accountId]);

    const loadFiles = useCallback(async () => {
        setLoading(true);
        if (!accountId) return;
        try {
            const [tlList, subList] = await Promise.all([
                data.list(accountId, "TimeLayout"),
                data.list(accountId, "Subjects"),
            ]);
            const tlArr = Array.isArray(tlList) ? tlList : [];
            const subArr = Array.isArray(subList) ? subList : [];
            setFileList(tlArr);
            setSubjectFiles(subArr);
            if (tlArr.length > 0 && !selectedFile) {
                selectFile(tlArr[0]);
            }
            if (subArr.length > 0 && !selectedSubjectFile) {
                setSelectedSubjectFile(subArr[0]);
            }
        } catch {
            setFileList([]);
        }
        setLoading(false);
    }, [accountId, selectedFile, selectedSubjectFile, selectFile]);

    useEffect(() => {
        loadFiles();
    }, [loadFiles]);

    useEffect(() => {
        if (!accountId || !selectedSubjectFile) return;
        data.read(accountId, "Subjects", selectedSubjectFile)
            .then((res) => {
                if (res && typeof res === "object") {
                    const obj = res as Record<string, unknown>;
                    setSubjects((obj.Subjects as SubjectsData) || (obj as SubjectsData) || {});
                }
            })
            .catch(() => setSubjects({}));
    }, [accountId, selectedSubjectFile]);

    async function handleSave() {
        if (!selectedFile) return;
        setSaving(true);
        setMsg(null);
        try {
            let payloadToSave = layouts;
            if (jsonMode) {
                payloadToSave = JSON.parse(jsonText) as TimeLayoutsData;
                setLayouts(payloadToSave);
            } else {
                // 规范化所有时间点，同时携带 StartSecond/EndSecond 与 StartTime/EndTime
                const normalized: TimeLayoutsData = {};
                for (const [id, tl] of Object.entries(layouts)) {
                    normalized[id] = {
                        ...tl,
                        Layouts: (tl.Layouts || []).map((item) => {
                            const s = toTimeStrings(extractHHMM(item, "start"));
                            const e = toTimeStrings(extractHHMM(item, "end"));
                            return {
                                ...item,
                                StartSecond: s.iso,
                                EndSecond: e.iso,
                                StartTime: s.span,
                                EndTime: e.span,
                            };
                        }),
                    };
                }
                payloadToSave = normalized;
                setLayouts(normalized);
                setJsonText(JSON.stringify(normalized, null, 2));
            }
            const wrapperPayload =
                payloadToSave && typeof payloadToSave === "object" && "TimeLayouts" in payloadToSave
                    ? payloadToSave
                    : { TimeLayouts: payloadToSave };
            await data.write(accountId, "TimeLayout", selectedFile, wrapperPayload);
            setMsg({ type: "success", text: "时间表数据已保存并递增版本号" });
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
            await data.create(accountId, "TimeLayout", name);
            setShowCreate(false);
            setNewFileName("");
            await loadFiles();
            selectFile(name);
            setMsg({ type: "success", text: "文件已创建" });
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "创建失败" });
        }
    }

    async function handleDeleteFile(name: string) {
        if (!confirm(`确定删除文件 "${name}"？`)) return;
        try {
            await data.deleteData(accountId, "TimeLayout", name);
            if (selectedFile === name) {
                setSelectedFile(null);
                setLayouts({});
            }
            await loadFiles();
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "删除失败" });
        }
    }

    function addLayout() {
        const id = crypto.randomUUID();
        const next = { ...layouts, [id]: { Name: "新时间表", Layouts: [] } };
        setLayouts(next);
        setJsonText(JSON.stringify(next, null, 2));
        setSelectedLayoutId(id);
    }

    function deleteLayout(id: string) {
        const copy = { ...layouts };
        delete copy[id];
        setLayouts(copy);
        setJsonText(JSON.stringify(copy, null, 2));
        if (selectedLayoutId === id) {
            setSelectedLayoutId(Object.keys(copy)[0] || null);
        }
    }

    function addTimePoint(layoutId: string, timeType: TimeType = 0) {
        const copy = { ...layouts };
        const layout = copy[layoutId];
        if (!layout) return;
        const lastItem = layout.Layouts[layout.Layouts.length - 1];
        const startHHMM = lastItem ? extractHHMM(lastItem, "end") : "08:00";
        const duration = timeType === 0 ? 45 : timeType === 1 ? 10 : 0;
        const endHHMM = addMinutesToHHMM(startHHMM, duration);
        const s = toTimeStrings(startHHMM);
        const e = toTimeStrings(endHHMM);
        const newItem: TimeLayoutItem = {
            StartSecond: s.iso,
            EndSecond: e.iso,
            StartTime: s.span,
            EndTime: e.span,
            TimeType: timeType,
            BreakName: timeType === 1 ? "课间休息" : "",
            DefaultClassId: "",
            IsHideDefault: false,
        };
        copy[layoutId] = { ...layout, Layouts: [...layout.Layouts, newItem] };
        setLayouts(copy);
        setJsonText(JSON.stringify(copy, null, 2));
    }

    function updateTimePoint(layoutId: string, idx: number, updater: (prev: TimeLayoutItem) => TimeLayoutItem) {
        const copy = { ...layouts };
        const items = [...copy[layoutId].Layouts];
        items[idx] = updater(items[idx]);
        copy[layoutId] = { ...copy[layoutId], Layouts: items };
        setLayouts(copy);
        setJsonText(JSON.stringify(copy, null, 2));
    }

    function moveTimePoint(layoutId: string, idx: number, dir: -1 | 1) {
        const copy = { ...layouts };
        const items = [...copy[layoutId].Layouts];
        const target = idx + dir;
        if (target < 0 || target >= items.length) return;
        const tmp = items[idx];
        items[idx] = items[target];
        items[target] = tmp;
        copy[layoutId] = { ...copy[layoutId], Layouts: items };
        setLayouts(copy);
        setJsonText(JSON.stringify(copy, null, 2));
    }

    function sortTimePoints(layoutId: string) {
        const copy = { ...layouts };
        const items = [...copy[layoutId].Layouts];
        items.sort((a, b) => extractHHMM(a, "start").localeCompare(extractHHMM(b, "start")));
        copy[layoutId] = { ...copy[layoutId], Layouts: items };
        setLayouts(copy);
        setJsonText(JSON.stringify(copy, null, 2));
    }

    function deleteTimePoint(layoutId: string, idx: number) {
        const copy = { ...layouts };
        const items = [...copy[layoutId].Layouts];
        items.splice(idx, 1);
        copy[layoutId] = { ...copy[layoutId], Layouts: items };
        setLayouts(copy);
        setJsonText(JSON.stringify(copy, null, 2));
    }

    const currentLayout = selectedLayoutId ? layouts[selectedLayoutId] : null;

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">时间表管理</h1>
                    <p className="page-subtitle">管理 ClassIsland 时间表档案 (TimeLayout)</p>
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
                <div style={{ width: 260, flexShrink: 0 }}>
                    <div className="card mb-16">
                        <div className="card-title">时间表文件</div>
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

                    {selectedFile && !dataLoading && (
                        <div className="card">
                            <div className="flex items-center justify-between mb-8">
                                <div className="card-title" style={{ margin: 0 }}>时间表列表</div>
                                <Button appearance="subtle" size="small" icon={<Add24Regular />} onClick={addLayout} title="新增时间表" />
                            </div>
                            {Object.entries(layouts).map(([id, tl]) => (
                                <div
                                    key={id}
                                    className={`sidebar-link ${selectedLayoutId === id ? "active" : ""}`}
                                    onClick={() => setSelectedLayoutId(id)}
                                >
                                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{tl.Name}</span>
                                    <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{tl.Layouts?.length || 0}项</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ flex: 1 }}>
                    {!selectedFile ? (
                        <div className="card"><div className="empty-state"><div className="empty-state-text">请选择一个时间表文件</div></div></div>
                    ) : dataLoading ? (
                        <div className="card"><div className="empty-state"><Spinner size="medium" /></div></div>
                    ) : jsonMode ? (
                        <div className="card">
                            <div className="flex items-center justify-between mb-16">
                                <div className="card-title" style={{ margin: 0 }}>JSON 源码编辑: {selectedFile}</div>
                                <div className="flex gap-8">
                                    <DownloadPresetPopoverButton
                                        buttonText="导出 JSON"
                                        appearance="secondary"
                                        defaultFileName={`TimeLayout-${selectedFile}.json`}
                                        suggestedNames={[
                                            { label: "具名区分文件 (推荐)", fileName: `TimeLayout-${selectedFile}.json` },
                                            { label: "档案原名", fileName: `${selectedFile}.json` },
                                            { label: "客户端标准资源名", fileName: "TimeLayouts.json" },
                                        ]}
                                        onFetchData={async () => JSON.parse(jsonText)}
                                        onError={(text) => setMsg({ type: "error", text })}
                                    />
                                    <Button
                                        appearance="subtle"
                                        icon={<Code24Regular />}
                                        onClick={() => {
                                            try {
                                                setLayouts(JSON.parse(jsonText));
                                            } catch { /* ignore */ }
                                            setJsonMode(false);
                                        }}
                                    >
                                        切换可视化编辑
                                    </Button>
                                    <Button appearance="primary" icon={<Save24Regular />} onClick={handleSave} disabled={saving}>
                                        {saving ? <Spinner size="tiny" /> : "保存"}
                                    </Button>
                                </div>
                            </div>
                            <div className="json-editor">
                                <textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} style={{ minHeight: 440 }} />
                            </div>
                        </div>
                    ) : !currentLayout ? (
                        <div className="card"><div className="empty-state"><div className="empty-state-text">请从左侧选择或添加一个时间表</div></div></div>
                    ) : (
                        <div className="card">
                            <div className="flex items-center justify-between mb-16" style={{ flexWrap: "wrap", gap: 12 }}>
                                <div className="flex items-center gap-8">
                                    <Input
                                        value={currentLayout.Name}
                                        onChange={(_, d) => {
                                            const c = { ...layouts, [selectedLayoutId!]: { ...currentLayout, Name: d.value } };
                                            setLayouts(c);
                                            setJsonText(JSON.stringify(c, null, 2));
                                        }}
                                        style={{ fontWeight: 600, fontSize: 16 }}
                                    />
                                    <Button
                                        appearance="subtle"
                                        size="small"
                                        icon={<Delete24Regular />}
                                        onClick={() => deleteLayout(selectedLayoutId!)}
                                        style={{ color: "var(--danger-color)" }}
                                        title="删除此时间表"
                                    />
                                </div>
                                <div className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                                    {subjectFiles.length > 0 && (
                                        <Select
                                            value={selectedSubjectFile}
                                            onChange={(_, d) => setSelectedSubjectFile(d.value)}
                                            title="参考科目库（用于配置默认科目）"
                                        >
                                            {subjectFiles.map((sf) => (
                                                <option key={sf} value={sf}>参考科目库: {sf}</option>
                                            ))}
                                        </Select>
                                    )}
                                    <Button
                                        appearance="subtle"
                                        icon={<ArrowSort24Regular />}
                                        onClick={() => sortTimePoints(selectedLayoutId!)}
                                    >
                                        按时间排序
                                    </Button>
                                    <DownloadPresetPopoverButton
                                        buttonText="导出 JSON"
                                        appearance="secondary"
                                        defaultFileName={`TimeLayout-${selectedFile}.json`}
                                        suggestedNames={[
                                            { label: "具名区分文件 (推荐)", fileName: `TimeLayout-${selectedFile}.json` },
                                            { label: "档案原名", fileName: `${selectedFile}.json` },
                                            { label: "客户端标准资源名", fileName: "TimeLayouts.json" },
                                        ]}
                                        onFetchData={async () => layouts}
                                        onError={(text) => setMsg({ type: "error", text })}
                                    />
                                    <Button
                                        appearance="subtle"
                                        icon={<Code24Regular />}
                                        onClick={() => {
                                            setJsonText(JSON.stringify(layouts, null, 2));
                                            setJsonMode(true);
                                        }}
                                    >
                                        JSON 源码
                                    </Button>
                                    <Button appearance="primary" icon={<Save24Regular />} onClick={handleSave} disabled={saving}>
                                        {saving ? <Spinner size="tiny" /> : "保存"}
                                    </Button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between mb-16">
                                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                    时间表 GUID: {selectedLayoutId}
                                </span>
                                <div className="flex gap-8">
                                    <Button size="small" appearance="secondary" icon={<Add24Regular />} onClick={() => addTimePoint(selectedLayoutId!, 0)}>
                                        + 上课时间段
                                    </Button>
                                    <Button size="small" appearance="secondary" icon={<Add24Regular />} onClick={() => addTimePoint(selectedLayoutId!, 1)}>
                                        + 课间休息
                                    </Button>
                                    <Button size="small" appearance="secondary" icon={<Add24Regular />} onClick={() => addTimePoint(selectedLayoutId!, 2)}>
                                        + 分割线
                                    </Button>
                                </div>
                            </div>

                            {currentLayout.Layouts.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-state-text">暂无时间点，点击上方按钮添加时间段</div>
                                </div>
                            ) : (
                                <div className="classplan-grid">
                                    {currentLayout.Layouts.map((item, idx) => {
                                        const startVal = extractHHMM(item, "start");
                                        const endVal = extractHHMM(item, "end");
                                        return (
                                            <div key={idx} className={`timeline-item type-${item.TimeType}`} style={{ flexWrap: "wrap" }}>
                                                <div className="timeline-time flex items-center">
                                                    <Input
                                                        type="time"
                                                        value={startVal}
                                                        onChange={(_, d) => {
                                                            const t = toTimeStrings(d.value);
                                                            updateTimePoint(selectedLayoutId!, idx, (prev) => ({
                                                                ...prev,
                                                                StartSecond: t.iso,
                                                                StartTime: t.span,
                                                            }));
                                                        }}
                                                        style={{ width: 108 }}
                                                    />
                                                    {item.TimeType !== 2 && (
                                                        <>
                                                            <span style={{ margin: "0 6px" }}>→</span>
                                                            <Input
                                                                type="time"
                                                                value={endVal}
                                                                onChange={(_, d) => {
                                                                    const t = toTimeStrings(d.value);
                                                                    updateTimePoint(selectedLayoutId!, idx, (prev) => ({
                                                                        ...prev,
                                                                        EndSecond: t.iso,
                                                                        EndTime: t.span,
                                                                    }));
                                                                }}
                                                                style={{ width: 108 }}
                                                            />
                                                        </>
                                                    )}
                                                </div>

                                                <Select
                                                    value={String(item.TimeType)}
                                                    onChange={(_, d) =>
                                                        updateTimePoint(selectedLayoutId!, idx, (prev) => ({
                                                            ...prev,
                                                            TimeType: parseInt(d.value, 10) as TimeType,
                                                        }))
                                                    }
                                                    style={{ width: 120 }}
                                                >
                                                    {([0, 1, 2, 3] as TimeType[]).map((t) => (
                                                        <option key={t} value={t}>{TIME_TYPE_LABELS[t]}</option>
                                                    ))}
                                                </Select>

                                                {item.TimeType === 0 && (
                                                    <div className="flex items-center gap-8" style={{ flex: 1 }}>
                                                        <Select
                                                            value={item.DefaultClassId || ""}
                                                            onChange={(_, d) =>
                                                                updateTimePoint(selectedLayoutId!, idx, (prev) => ({
                                                                    ...prev,
                                                                    DefaultClassId: d.value,
                                                                }))
                                                            }
                                                            style={{ minWidth: 150 }}
                                                        >
                                                            <option value="">-- 默认科目 (可选) --</option>
                                                            {Object.entries(subjects).map(([subId, sub]) => (
                                                                <option key={subId} value={subId}>{sub.Name}</option>
                                                            ))}
                                                        </Select>
                                                        <Switch
                                                            checked={!!item.IsHideDefault}
                                                            onChange={(_, d) =>
                                                                updateTimePoint(selectedLayoutId!, idx, (prev) => ({
                                                                    ...prev,
                                                                    IsHideDefault: d.checked,
                                                                }))
                                                            }
                                                            label="默认隐藏"
                                                        />
                                                    </div>
                                                )}

                                                {item.TimeType === 1 && (
                                                    <div style={{ flex: 1 }}>
                                                        <Input
                                                            value={item.BreakName || ""}
                                                            placeholder="课间名称（如：课间休息 / 大课间 / 午休）"
                                                            onChange={(_, d) =>
                                                                updateTimePoint(selectedLayoutId!, idx, (prev) => ({
                                                                    ...prev,
                                                                    BreakName: d.value,
                                                                }))
                                                            }
                                                            style={{ width: 220 }}
                                                        />
                                                    </div>
                                                )}

                                                {item.TimeType >= 2 && <div style={{ flex: 1 }} />}

                                                <div className="flex gap-4">
                                                    <Button
                                                        appearance="subtle"
                                                        size="small"
                                                        icon={<ArrowUp24Regular />}
                                                        disabled={idx === 0}
                                                        onClick={() => moveTimePoint(selectedLayoutId!, idx, -1)}
                                                    />
                                                    <Button
                                                        appearance="subtle"
                                                        size="small"
                                                        icon={<ArrowDown24Regular />}
                                                        disabled={idx === currentLayout.Layouts.length - 1}
                                                        onClick={() => moveTimePoint(selectedLayoutId!, idx, 1)}
                                                    />
                                                    <Button
                                                        appearance="subtle"
                                                        size="small"
                                                        icon={<Delete24Regular />}
                                                        onClick={() => deleteTimePoint(selectedLayoutId!, idx)}
                                                        style={{ color: "var(--danger-color)" }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
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
                            <DialogTitle>新建时间表文件</DialogTitle>
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
