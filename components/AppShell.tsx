"use client";

import React from "react";
import { useAuth } from "@/lib/auth-context";
import { useAccount } from "@/lib/account-context";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import LoginDialog from "./LoginDialog";

/** 不需要侧栏的页面 */
const SHELL_EXCLUDED_PATHS = ["/login", "/register"];

export default function AppShell({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuth();
    const { accountId } = useAccount();
    const pathname = usePathname();

    const isExcluded = SHELL_EXCLUDED_PATHS.some((p) => pathname.startsWith(p));
    const isAccountListPage = pathname === "/" || pathname === "/accounts/new";

    React.useEffect(() => {
        if (!isAuthenticated && !isExcluded) {
            if (typeof window !== "undefined") {
                window.location.href = "/login";
            }
        }
    }, [isAuthenticated, isExcluded, pathname]);

    const showFullShell = isAuthenticated && accountId && !isExcluded && !isAccountListPage;

    if (!isAuthenticated && !isExcluded) {
        return null;
    }

    return (
        <>
            <LoginDialog />

            {showFullShell ? (
                <div className="app-layout">
                    <Sidebar />
                    <div className="main-area">
                        <TopBar />
                        <main key={accountId} className="content-area fade-in">{children}</main>
                    </div>
                </div>
            ) : (
                <>{children}</>
            )}
        </>
    );
}
