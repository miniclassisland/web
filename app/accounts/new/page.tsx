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
        <div className="login-container fade-in">
            <div className="login-card">
                <div className="login-title">创建 MINI ClassIsland 账户</div>
                <div className="login-subtitle">创建一个新的学校或组织集控空间</div>

                {error && (
                    <MessageBar intent="error" style={{ marginBottom: 16 }}>
                        <MessageBarBody>{error}</MessageBarBody>
                    </MessageBar>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">账户 / 组织名称</label>
                        <Input
                            value={name}
                            onChange={(_, d) => setName(d.value)}
                            placeholder="例如：第一中学"
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
                        <div className="form-hint">3-64 位小写字母、数字或连字符</div>
                    </div>
                    <div className="flex gap-8 mt-16">
                        <Button
                            appearance="secondary"
                            type="button"
                            onClick={() => router.push("/")}
                            style={{ flex: 1 }}
                        >
                            返回
                        </Button>
                        <Button
                            appearance="primary"
                            type="submit"
                            disabled={loading || !name.trim()}
                            style={{ flex: 1 }}
                        >
                            {loading ? <Spinner size="tiny" /> : "创建账户"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
