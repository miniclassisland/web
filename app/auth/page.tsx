"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setToken, clearToken, token as tokenApi, userInfo } from "@/lib/api";
import { Spinner } from "@fluentui/react-components";

export default function AuthTransferPage() {
    const router = useRouter();

    useEffect(() => {
        if (typeof window === "undefined") return;

        async function processTransfer() {
            const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
            const code = hashParams.get("code");

            // Immediately scrub sensitive parameters from address bar and browser history
            window.history.replaceState(null, "", "/auth");

            try {
                if (code) {
                    const res = await tokenApi.redeem(code);
                    setToken(res.token);
                    await userInfo.get();
                    router.replace("/");
                    return;
                }
            } catch {
                clearToken();
            }
            router.replace("/login");
        }

        processTransfer();
    }, [router]);

    return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
            <Spinner label="正在安全验证并跳转管理面板..." />
        </div>
    );
}
