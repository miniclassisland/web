"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAccount } from "@/lib/account-context";
import { useRouter } from "next/navigation";
import { clients, data, pairing, audit } from "@/lib/api";
import type { ResourceType } from "@/lib/types";
import {
    PlugConnected24Regular,
    Link24Regular,
    Document24Regular,
    DocumentSearch24Regular,
} from "@fluentui/react-icons";

function StatCard({
    icon,
    label,
    value,
    color,
}: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    color?: string;
}) {
    return (
        <div className="stat-card">
            <div className="flex items-center gap-8" style={{ color: color || "var(--accent-color)" }}>
                {icon}
                <span className="stat-value">{value}</span>
            </div>
            <div className="stat-label">{label}</div>
        </div>
    );
}

export default function DashboardPage() {
    const { isAuthenticated } = useAuth();
    const { accountId, currentAccount } = useAccount();
    const router = useRouter();
    const [stats, setStats] = useState({
        clientCount: "-",
        onlineCount: "-",
        pairingCount: "-",
        resourceCount: "-",
        auditCount: "-",
    });

    useEffect(() => {
        if (!accountId) {
            router.push("/");
            return;
        }

        async function loadStats() {
            if (!accountId) return;
            try {
                const [cl, pr, au] = await Promise.allSettled([
                    clients.list(accountId),
                    pairing.listCodes(accountId),
                    audit.list(accountId, { limit: 100 }),
                ]);
                const resourceTypes: ResourceType[] = [
                    "ClassPlan",
                    "TimeLayout",
                    "Subjects",
                    "Policy",
                    "DefaultSettings",
                    "Components",
                    "Credentials",
                ];
                const resourceResults = await Promise.allSettled(
                    resourceTypes.map((t) => data.list(accountId, t))
                );
                let totalRes = 0;
                resourceResults.forEach((r) => {
                    if (r.status === "fulfilled" && Array.isArray(r.value)) {
                        totalRes += r.value.length;
                    }
                });

                const clientArr = cl.status === "fulfilled" && Array.isArray(cl.value) ? cl.value : [];
                const online = clientArr.filter((c) => c.status === "online").length;
                const pairArr = pr.status === "fulfilled" && Array.isArray(pr.value) ? pr.value : [];
                const pendingPairs = pairArr.filter((p) => !p.approved && !p.used && p.status !== "rejected").length;
                const auditArr = au.status === "fulfilled" && Array.isArray(au.value) ? au.value : [];

                setStats({
                    clientCount: String(clientArr.length),
                    onlineCount: String(online),
                    pairingCount: String(pendingPairs),
                    resourceCount: String(totalRes),
                    auditCount: String(auditArr.length),
                });
            } catch {
                /* keep defaults */
            }
        }

        loadStats();
    }, [isAuthenticated, accountId, router]);

    if (!isAuthenticated || !accountId) return null;

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">仪表盘</h1>
                    <p className="page-subtitle">
                        MINI ClassIsland 集控概览 {currentAccount ? `— ${currentAccount.name}` : ""}
                    </p>
                </div>
            </div>

            <div className="grid-4">
                <StatCard
                    icon={<PlugConnected24Regular />}
                    label="在线 / 已注册客户端"
                    value={`${stats.onlineCount} / ${stats.clientCount}`}
                    color="var(--success-color)"
                />
                <StatCard
                    icon={<Link24Regular />}
                    label="待审批配对请求"
                    value={stats.pairingCount}
                    color="var(--warning-color)"
                />
                <StatCard
                    icon={<Document24Regular />}
                    label="集控档案资源文件"
                    value={stats.resourceCount}
                    color="var(--accent-color)"
                />
                <StatCard
                    icon={<DocumentSearch24Regular />}
                    label="近期审计事件记录"
                    value={stats.auditCount}
                />
            </div>

            <div className="card mt-16">
                <div className="card-title">MINI ClassIsland 集控工作流指引</div>
                <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7 }}>
                    1. 在左侧「档案管理」中配置科目、时间表、课表、策略、组件布局与凭据。<br />
                    2. 在「默认设置」或「预注册客户端」中下载 <code>ManagementPreset.json</code> 引导文件，放入班级客户端 ClassIsland 程序目录。<br />
                    3. 在「客户端管理」中查看各终端实时在线状态、分配专属档案或账户默认档案、抓取终端配置快照以及下发桌面提醒。
                </p>
            </div>
        </div>
    );
}
