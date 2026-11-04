"use client";

import React from "react";
import { useAuth } from "@/lib/auth-context";
import { useAccount } from "@/lib/account-context";
import { usePathname } from "next/navigation";
import { ThemeModeToggle } from "@/lib/theme-context";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import LoginDialog from "./LoginDialog";
import RateLimitBanner from "./RateLimitBanner";

/** 不需要侧栏的页面 */
const SHELL_EXCLUDED_PATHS = ["/login", "/register"];

export default function AppShell({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuth();
    const { accountId } = useAccount();
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

    const isExcluded = SHELL_EXCLUDED_PATHS.some((p) => pathname.startsWith(p));

    React.useEffect(() => {
        setMobileMenuOpen(false);
    }, [pathname, accountId]);

    React.useEffect(() => {
        if (!isAuthenticated && !isExcluded) {
            if (typeof window !== "undefined") {
                window.location.href = "/login";
            }
        }
    }, [isAuthenticated, isExcluded, pathname]);

    const showFullShell = isAuthenticated && !isExcluded;

    if (!isAuthenticated && !isExcluded) {
        return null;
    }

    return (
        <>
            <RateLimitBanner />
            <LoginDialog />

            {showFullShell ? (
                <div className="app-layout">
                    {mobileMenuOpen && (
                        <div
                            className="sidebar-backdrop"
                            onClick={() => setMobileMenuOpen(false)}
                            aria-hidden="true"
                        />
                    )}
                    <Sidebar
                        mobileOpen={mobileMenuOpen}
                        onCloseMobile={() => setMobileMenuOpen(false)}
                    />
                    <div className="main-area">
                        <TopBar onToggleMobileMenu={() => setMobileMenuOpen((v) => !v)} />
                        <main key={accountId || "user-center"} className="content-area fade-in">{children}</main>
                    </div>
                </div>
            ) : (
                <>
                    <ThemeModeToggle floating />
                    {children}
                </>
            )}
        </>
    );
}
