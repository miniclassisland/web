"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setToken, clearToken, getToken, token as tokenApi, userInfo } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "@fluentui/react-components";

export default function AuthTransferPage() {
    const router = useRouter();
    const { syncTokenFromStorage, refreshUser } = useAuth();

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
                    syncTokenFromStorage(res.token);
                    await refreshUser();
                    router.replace("/");
                    return;
                }
                // Fallback: if no code is present (e.g. React StrictMode double-effect or direct revisit)
                // check if an existing valid session token is already in localStorage
                const existing = getToken();
                if (existing) {
                    await userInfo.get();
                    syncTokenFromStorage(existing);
                    router.replace("/");
                    return;
                }
            } catch {
                clearToken();
                syncTokenFromStorage(null);
            }
            router.replace("/login");
        }

        processTransfer();
    }, [router, syncTokenFromStorage, refreshUser]);

    return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
            <Spinner label="正在安全验证并跳转管理面板..." />
        </div>
    );
}
