"use client";

import React, { useState, useEffect, useCallback } from "react";
import { data } from "@/lib/api";
import { useAccount } from "@/lib/account-context";
import type {
    ClassPlan,
    ClassInfo,
    TimeLayout,
    TimeLayoutItem,
    Subject,
    TimeRule,
} from "@/lib/types";
import { TIME_TYPE_LABELS, WEEKDAY_LABELS } from "@/lib/types";
import {
    Button, Input, Select, Switch, Spinner,
    MessageBar, MessageBarBody,
    Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions,
} from "@fluentui/react-components";
import {
    Add24Regular, Delete24Regular, Save24Regular, ArrowSync24Regular, Code24Regular,
} from "@fluentui/react-icons";
import DownloadPresetPopoverButton from "@/components/DownloadPresetPopoverButton";

type ClassPlansData = Record<string, ClassPlan>;
type TimeLayoutsData = Record<string, TimeLayout>;
type SubjectsData = Record<string, Subject>;

function formatItemTime(item: TimeLayoutItem): string {
    const startRaw = item.StartSecond || item.StartTime || "08:00";
    const endRaw = item.EndSecond || item.EndTime || "08:45";
    const parsePart = (raw: string) => {
        const t = raw.indexOf("T");
        const s = t >= 0 ? raw.slice(t + 1) : raw;
        const p = s.split(":");
        return `${(p[0] || "00").padStart(2, "0")}:${(p[1] || "00").padStart(2, "0")}`;
    };
    return `${parsePart(startRaw)} - ${parsePart(endRaw)}`;
}

export default function ClassPlanPage() {
    const { accountId } = useAccount();
    const [fileList, setFileList] = useState<string[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [plans, setPlans] = useState<ClassPlansData>({});
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

    // 可选的时间表文件与科目文件（解决此前硬编码 [0] 的问题）
    const [tlFileList, setTlFileList] = useState<string[]>([]);
    const [selectedTlFile, setSelectedTlFile] = useState<string>("");
    const [subFileList, setSubFileList] = useState<string[]>([]);
    const [selectedSubFile, setSelectedSubFile] = useState<string>("");

    const [timeLayouts, setTimeLayouts] = useState<TimeLayoutsData>({});
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
        setSelectedPlanId(null);
        setDataLoading(true);
        try {
            const content = await data.read(accountId, "ClassPlan", name);
            let parsed: ClassPlansData = {};
            if (content && typeof content === "object") {
                const obj = content as Record<string, unknown>;
                if (obj.ClassPlans && typeof obj.ClassPlans === "object") {
                    parsed = obj.ClassPlans as ClassPlansData;
                } else {
                    parsed = obj as ClassPlansData;
                }
            }
            setPlans(parsed);
            setJsonText(JSON.stringify(parsed, null, 2));
            setSelectedPlanId(Object.keys(parsed)[0] || null);
        } catch {
            setPlans({});
            setJsonText("{}");
        }
        setDataLoading(false);
    }, [accountId]);

    const loadFiles = useCallback(async () => {
        setLoading(true);
        if (!accountId) return;
        try {
            const [cpFiles, tlFiles, subFiles] = await Promise.all([
                data.list(accountId, "ClassPlan"),
                data.list(accountId, "TimeLayout"),
                data.list(accountId, "Subjects"),
            ]);
            const cpArr = Array.isArray(cpFiles) ? cpFiles : [];
            const tlArr = Array.isArray(tlFiles) ? tlFiles : [];
            const subArr = Array.isArray(subFiles) ? subFiles : [];
            setFileList(cpArr);
            setTlFileList(tlArr);
            setSubFileList(subArr);
            if (cpArr.length > 0 && !selectedFile) {
                selectFile(cpArr[0]);
            }
            if (tlArr.length > 0 && !selectedTlFile) {
                setSelectedTlFile(tlArr[0]);
            }
            if (subArr.length > 0 && !selectedSubFile) {
                setSelectedSubFile(subArr[0]);
            }
        } catch {
            setFileList([]);
        }
        setLoading(false);
    }, [accountId, selectedFile, selectedTlFile, selectedSubFile, selectFile]);

    useEffect(() => {
        loadFiles();
    }, [loadFiles]);

    useEffect(() => {
        if (!accountId || !selectedTlFile) return;
        data.read(accountId, "TimeLayout", selectedTlFile)
            .then((res) => {
                if (res && typeof res === "object") {
                    const obj = res as Record<string, unknown>;
                    setTimeLayouts((obj.TimeLayouts as TimeLayoutsData) || (obj as TimeLayoutsData) || {});
                }
            })
            .catch(() => setTimeLayouts({}));
    }, [accountId, selectedTlFile]);

    useEffect(() => {
        if (!accountId || !selectedSubFile) return;
        data.read(accountId, "Subjects", selectedSubFile)
            .then((res) => {
                if (res && typeof res === "object") {
                    const obj = res as Record<string, unknown>;
                    setSubjects((obj.Subjects as SubjectsData) || (obj as SubjectsData) || {});
                }
            })
            .catch(() => setSubjects({}));
    }, [accountId, selectedSubFile]);

    async function handleSave() {
        if (!selectedFile) return;
        setSaving(true);
        setMsg(null);
        try {
            let payloadToSave = plans;
            if (jsonMode) {
                payloadToSave = JSON.parse(jsonText) as ClassPlansData;
                setPlans(payloadToSave);
            } else {
                setJsonText(JSON.stringify(plans, null, 2));
            }
            const wrapperPayload =
                payloadToSave && typeof payloadToSave === "object" && "ClassPlans" in payloadToSave
                    ? payloadToSave
                    : {
                          ClassPlans: payloadToSave,
                          ClassPlanGroups: {
                              "00000000-0000-0000-0000-000000000000": {
                                  Name: "默认课表群",
                                  IsGlobal: false,
                              },
                          },
                      };
            await data.write(accountId, "ClassPlan", selectedFile, wrapperPayload);
            setMsg({ type: "success", text: "课表数据已保存并递增版本号" });
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
            await data.create(accountId, "ClassPlan", name);
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
        if (!confirm(`确定删除 "${name}"？`)) return;
        try {
            await data.deleteData(accountId, "ClassPlan", name);
            if (selectedFile === name) {
                setSelectedFile(null);
                setPlans({});
            }
            await loadFiles();
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "删除失败" });
        }
    }

    function addPlan() {
        const id = crypto.randomUUID();
        const firstTlId = Object.keys(timeLayouts)[0] || "";
        const tl = firstTlId ? timeLayouts[firstTlId] : null;
        const classSlots = tl ? (tl.Layouts || []).filter((i) => i.TimeType === 0) : [];
        const next: ClassPlansData = {
            ...plans,
            [id]: {
                Name: "新课表",
                TimeLayoutId: firstTlId,
                Classes: classSlots.map((slot) => ({
                    SubjectId: slot.DefaultClassId || "",
                    IsEnabled: true,
                })),
                TimeRule: { WeekDay: 1, WeekCountDiv: 0, WeekCountDivTotal: 2 },
                IsEnabled: true,
                IsOverlay: false,
            },
        };
        setPlans(next);
        setJsonText(JSON.stringify(next, null, 2));
        setSelectedPlanId(id);
    }

    function deletePlan(id: string) {
        const copy = { ...plans };
        delete copy[id];
        setPlans(copy);
        setJsonText(JSON.stringify(copy, null, 2));
        if (selectedPlanId === id) {
            setSelectedPlanId(Object.keys(copy)[0] || null);
        }
    }

    function updatePlan(id: string, field: string, value: unknown) {
        const copy = { ...plans };
        copy[id] = { ...copy[id], [field]: value };
        if (field === "TimeLayoutId") {
            const tl = timeLayouts[value as string];
            if (tl) {
                const classSlots = (tl.Layouts || []).filter((item) => item.TimeType === 0);
                copy[id].Classes = classSlots.map((slot, idx) => ({
                    SubjectId: copy[id].Classes[idx]?.SubjectId || slot.DefaultClassId || "",
                    IsEnabled: copy[id].Classes[idx]?.IsEnabled ?? true,
                }));
            }
        }
        setPlans(copy);
        setJsonText(JSON.stringify(copy, null, 2));
    }

    function updateTimeRule(id: string, field: keyof TimeRule, value: number) {
        const copy = { ...plans };
        copy[id] = { ...copy[id], TimeRule: { ...copy[id].TimeRule, [field]: value } };
        setPlans(copy);
        setJsonText(JSON.stringify(copy, null, 2));
    }

    function updateClass(planId: string, idx: number, field: keyof ClassInfo, value: unknown) {
        const copy = { ...plans };
        const classes = [...(copy[planId].Classes || [])];
        while (classes.length <= idx) {
            classes.push({ SubjectId: "", IsEnabled: true });
        }
        classes[idx] = { ...classes[idx], [field]: value };
        copy[planId] = { ...copy[planId], Classes: classes };
        setPlans(copy);
        setJsonText(JSON.stringify(copy, null, 2));
    }

    const currentPlan = selectedPlanId ? plans[selectedPlanId] : null;
    const currentTimeLayout = currentPlan ? timeLayouts[currentPlan.TimeLayoutId] : null;

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">课表管理</h1>
                    <p className="page-subtitle">管理 ClassIsland 课表档案 (ClassPlan)</p>
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

            {/* 关联的时间表与科目库选择器 */}
            <div className="card" style={{ padding: "12px 20px" }}>
                <div className="flex items-center gap-24" style={{ flexWrap: "wrap" }}>
                    <div className="flex items-center gap-8">
                        <span style={{ fontSize: 13, fontWeight: 500 }}>引用时间表文件：</span>
                        <Select value={selectedTlFile} onChange={(_, d) => setSelectedTlFile(d.value)} style={{ minWidth: 180 }}>
                            {tlFileList.map((f) => (
                                <option key={f} value={f}>{f}</option>
                            ))}
                        </Select>
                    </div>
                    <div className="flex items-center gap-8">
                        <span style={{ fontSize: 13, fontWeight: 500 }}>引用科目库文件：</span>
                        <Select value={selectedSubFile} onChange={(_, d) => setSelectedSubFile(d.value)} style={{ minWidth: 180 }}>
                            {subFileList.map((f) => (
                                <option key={f} value={f}>{f}</option>
                            ))}
                        </Select>
                    </div>
                </div>
            </div>

            <div className="flex gap-24">
                <div style={{ width: 260, flexShrink: 0 }}>
                    <div className="card mb-16">
                        <div className="card-title">课表文件</div>
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
                    {selectedFile && !dataLoading && (
                        <div className="card">
                            <div className="flex items-center justify-between mb-8">
                                <div className="card-title" style={{ margin: 0 }}>课表列表</div>
                                <Button appearance="subtle" size="small" icon={<Add24Regular />} onClick={addPlan} title="添加课表" />
                            </div>
                            {Object.entries(plans).map(([id, cp]) => (
                                <div
                                    key={id}
                                    className={`sidebar-link ${selectedPlanId === id ? "active" : ""}`}
                                    onClick={() => setSelectedPlanId(id)}
                                >
                                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{cp.Name}</span>
                                    <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                                        {WEEKDAY_LABELS[cp.TimeRule?.WeekDay ?? 1]}
                                    </span>
                                    {!cp.IsEnabled && (
                                        <span className="badge badge-danger" style={{ fontSize: 10 }}>禁用</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ flex: 1 }}>
                    {!selectedFile ? (
                        <div className="card"><div className="empty-state"><div className="empty-state-text">请选择课表文件</div></div></div>
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
                                        defaultFileName={`ClassPlan-${selectedFile}.json`}
                                        suggestedNames={[
                                            { label: "具名区分文件 (推荐)", fileName: `ClassPlan-${selectedFile}.json` },
                                            { label: "档案原名", fileName: `${selectedFile}.json` },
                                            { label: "客户端标准资源名", fileName: "ClassPlans.json" },
                                        ]}
                                        onFetchData={async () => JSON.parse(jsonText)}
                                        onError={(text) => setMsg({ type: "error", text })}
                                    />
                                    <Button
                                        appearance="subtle"
                                        icon={<Code24Regular />}
                                        onClick={() => {
                                            try { setPlans(JSON.parse(jsonText)); } catch { /* ignore */ }
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
                    ) : !currentPlan ? (
                        <div className="card"><div className="empty-state"><div className="empty-state-text">请选择或添加课表</div></div></div>
                    ) : (
                        <div className="card">
                            <div className="flex items-center justify-between mb-16">
                                <Input
                                    value={currentPlan.Name}
                                    onChange={(_, d) => updatePlan(selectedPlanId!, "Name", d.value)}
                                    style={{ fontWeight: 600, fontSize: 16 }}
                                />
                                <div className="flex gap-8">
                                    <DownloadPresetPopoverButton
                                        buttonText="导出 JSON"
                                        appearance="secondary"
                                        defaultFileName={`ClassPlan-${selectedFile}.json`}
                                        suggestedNames={[
                                            { label: "具名区分文件 (推荐)", fileName: `ClassPlan-${selectedFile}.json` },
                                            { label: "档案原名", fileName: `${selectedFile}.json` },
                                            { label: "客户端标准资源名", fileName: "ClassPlans.json" },
                                        ]}
                                        onFetchData={async () => plans}
                                        onError={(text) => setMsg({ type: "error", text })}
                                    />
                                    <Button
                                        appearance="subtle"
                                        icon={<Code24Regular />}
                                        onClick={() => {
                                            setJsonText(JSON.stringify(plans, null, 2));
                                            setJsonMode(true);
                                        }}
                                    >
                                        JSON 源码
                                    </Button>
                                    <Button appearance="primary" icon={<Save24Regular />} onClick={handleSave} disabled={saving}>
                                        {saving ? <Spinner size="tiny" /> : "保存"}
                                    </Button>
                                    <Button
                                        appearance="subtle"
                                        icon={<Delete24Regular />}
                                        onClick={() => deletePlan(selectedPlanId!)}
                                        style={{ color: "var(--danger-color)" }}
                                    />
                                </div>
                            </div>

                            <div className="grid-3 mb-16">
                                <div className="form-group">
                                    <label className="form-label">关联时间表 (TimeLayoutId)</label>
                                    <Select
                                        value={currentPlan.TimeLayoutId}
                                        onChange={(_, d) => updatePlan(selectedPlanId!, "TimeLayoutId", d.value)}
                                        style={{ width: "100%" }}
                                    >
                                        <option value="">-- 选择时间表 --</option>
                                        {Object.entries(timeLayouts).map(([id, tl]) => (
                                            <option key={id} value={id}>{tl.Name}</option>
                                        ))}
                                    </Select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">启用状态</label>
                                    <Switch
                                        checked={currentPlan.IsEnabled}
                                        onChange={(_, d) => updatePlan(selectedPlanId!, "IsEnabled", d.checked)}
                                        label={currentPlan.IsEnabled ? "已启用" : "已禁用"}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">临时层属性</label>
                                    <Switch
                                        checked={!!currentPlan.IsOverlay}
                                        onChange={(_, d) => updatePlan(selectedPlanId!, "IsOverlay", d.checked)}
                                        label={currentPlan.IsOverlay ? "临时层课表" : "常规课表"}
                                    />
                                </div>
                            </div>

                            <div className="settings-section">
                                <div className="settings-section-title">触发规则 (TimeRule)</div>
                                <div className="grid-3">
                                    <div className="form-group">
                                        <label className="form-label">适用星期 (WeekDay)</label>
                                        <Select
                                            value={String(currentPlan.TimeRule?.WeekDay ?? 1)}
                                            onChange={(_, d) => updateTimeRule(selectedPlanId!, "WeekDay", parseInt(d.value, 10))}
                                            style={{ width: "100%" }}
                                        >
                                            {WEEKDAY_LABELS.map((label, idx) => (
                                                <option key={idx} value={idx}>{label}</option>
                                            ))}
                                        </Select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">多周轮换周次 (WeekCountDiv)</label>
                                        <Select
                                            value={String(currentPlan.TimeRule?.WeekCountDiv ?? 0)}
                                            onChange={(_, d) => updateTimeRule(selectedPlanId!, "WeekCountDiv", parseInt(d.value, 10))}
                                            style={{ width: "100%" }}
                                        >
                                            <option value={0}>不轮换（每周生效）</option>
                                            <option value={1}>第 1 周（单周）</option>
                                            <option value={2}>第 2 周（双周）</option>
                                            <option value={3}>第 3 周</option>
                                            <option value={4}>第 4 周</option>
                                        </Select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">轮换总周期 (WeekCountDivTotal)</label>
                                        <Select
                                            value={String(currentPlan.TimeRule?.WeekCountDivTotal ?? 2)}
                                            onChange={(_, d) => updateTimeRule(selectedPlanId!, "WeekCountDivTotal", parseInt(d.value, 10))}
                                            style={{ width: "100%" }}
                                        >
                                            <option value={2}>双周轮换 (2周)</option>
                                            <option value={3}>三周轮换 (3周)</option>
                                            <option value={4}>四周轮换 (4周)</option>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <div className="settings-section">
                                <div className="settings-section-title">课程安排 (Classes)</div>
                                {!currentTimeLayout ? (
                                    <div className="empty-state"><div className="empty-state-text">请先选择关联的时间表</div></div>
                                ) : (
                                    <div className="classplan-grid">
                                        {(currentTimeLayout.Layouts || []).map((timeItem, idx) => {
                                            const isClassSlot = timeItem.TimeType === 0;
                                            const classIdx = isClassSlot
                                                ? currentTimeLayout.Layouts.slice(0, idx).filter((i) => i.TimeType === 0).length
                                                : -1;
                                            const classInfo =
                                                isClassSlot && classIdx < (currentPlan.Classes || []).length
                                                    ? currentPlan.Classes[classIdx]
                                                    : { SubjectId: timeItem.DefaultClassId || "", IsEnabled: true };

                                            return (
                                                <div
                                                    key={idx}
                                                    className={`classplan-row ${timeItem.TimeType === 1 ? "is-break" : ""} ${
                                                        timeItem.TimeType === 2 ? "is-divider" : ""
                                                    }`}
                                                >
                                                    <div className="classplan-row-time">{formatItemTime(timeItem)}</div>
                                                    <span
                                                        className="timeline-type-badge"
                                                        style={{
                                                            background:
                                                                timeItem.TimeType === 0
                                                                    ? "#e1efff"
                                                                    : timeItem.TimeType === 1
                                                                    ? "#dff6dd"
                                                                    : "#f0f0f0",
                                                            color:
                                                                timeItem.TimeType === 0
                                                                    ? "#0078d4"
                                                                    : timeItem.TimeType === 1
                                                                    ? "#107c10"
                                                                    : "#666",
                                                        }}
                                                    >
                                                        {isClassSlot
                                                            ? `第 ${classIdx + 1} 节`
                                                            : TIME_TYPE_LABELS[timeItem.TimeType as keyof typeof TIME_TYPE_LABELS] || "未知"}
                                                    </span>
                                                    <div className="classplan-row-content">
                                                        {isClassSlot ? (
                                                            <div className="flex items-center gap-12">
                                                                <Select
                                                                    value={classInfo?.SubjectId || ""}
                                                                    onChange={(_, d) =>
                                                                        updateClass(selectedPlanId!, classIdx, "SubjectId", d.value)
                                                                    }
                                                                    style={{ minWidth: 200 }}
                                                                >
                                                                    <option value="">-- 未排课 / 空闲 --</option>
                                                                    {Object.entries(subjects).map(([subId, sub]) => (
                                                                        <option key={subId} value={subId}>
                                                                            {sub.Name}
                                                                            {sub.TeacherName ? ` (${sub.TeacherName})` : ""}
                                                                        </option>
                                                                    ))}
                                                                </Select>
                                                                <Switch
                                                                    checked={classInfo?.IsEnabled !== false}
                                                                    onChange={(_, d) =>
                                                                        updateClass(selectedPlanId!, classIdx, "IsEnabled", d.checked)
                                                                    }
                                                                    label="启用本节"
                                                                />
                                                            </div>
                                                        ) : timeItem.TimeType === 1 ? (
                                                            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                                                                {timeItem.BreakName || "课间休息"}
                                                            </span>
                                                        ) : timeItem.TimeType === 2 ? (
                                                            <hr
                                                                style={{
                                                                    border: "none",
                                                                    borderTop: "1px dashed var(--border-color)",
                                                                    width: "100%",
                                                                }}
                                                            />
                                                        ) : null}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 12 }}>
                                课表 GUID: {selectedPlanId}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showCreate && (
                <Dialog open onOpenChange={() => setShowCreate(false)}>
                    <DialogSurface>
                        <DialogBody>
                            <DialogTitle>新建课表文件</DialogTitle>
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
