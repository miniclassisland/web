"use client";

import React, { useState } from "react";
import { accounts } from "@/lib/api";
import { useAccount } from "@/lib/account-context";
import { useRouter } from "next/navigation";
import {
    Button, Input, Spinner,
    MessageBar, MessageBarBody,
} from "@fluentui/react-components";

export default function NewAccountPage() {
    const { refreshAccounts, switchAccount } = useAccount();
    const router = useRouter();
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim()) return;
        setLoading(true);
        setError(null);
        try {
            const created = await accounts.apply({
                name: name.trim(),
                slug: slug.trim() || undefined,
            });
            await refreshAccounts();
            switchAccount(created.id);
            router.push("/dashboard");
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "创建账户失败");
            setLoading(false);
        }
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">创建 MINI ClassIsland 账户</h1>
                    <p className="page-subtitle">创建一个新的学校或组织集控账户中心，完成后将自动进入该账户中心</p>
                </div>
            </div>

            {error && (
                <MessageBar intent="error" style={{ marginBottom: 16 }}>
                    <MessageBarBody>{error}</MessageBarBody>
                </MessageBar>
            )}

            <div className="card" style={{ maxWidth: 560 }}>
                <div className="card-title">新账户基本信息</div>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">账户 / 组织名称 *</label>
                        <Input
                            value={name}
                            onChange={(_, d) => setName(d.value)}
                            placeholder="例如：第一中学电教中心"
                            style={{ width: "100%" }}
                            autoFocus
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">子域名标识 Slug（可选）</label>
                        <Input
                            value={slug}
                            onChange={(_, d) => setSlug(d.value)}
                            placeholder="例如：no1-school (留空自动生成)"
                            style={{ width: "100%" }}
                        />
                        <div className="form-hint">3-64 位小写字母、数字或连字符，用于终端接入子域名与多租户隔离标识</div>
                    </div>
                    <div className="flex gap-8 mt-16">
                        <Button
                            appearance="secondary"
                            type="button"
                            onClick={() => router.push("/")}
                        >
                            返回用户中心
                        </Button>
                        <Button
                            appearance="primary"
                            type="submit"
                            disabled={loading || !name.trim()}
                        >
                            {loading ? <Spinner size="tiny" /> : "创建并进入账户中心"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
