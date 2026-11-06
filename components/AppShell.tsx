"use client";

import React from "react";
import { useAuth } from "@/lib/auth-context";
import { useAccount } from "@/lib/account-context";
import { usePathname } from "next/navigation";
import { ThemeModeToggle } from "@/lib/theme-context";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import RateLimitBanner from "./RateLimitBanner";
import SponsorBanner from "./SponsorBanner";
import SiteAnnouncementBanner from "./SiteAnnouncementBanner";

/** 不需要侧栏的页面 */
const SHELL_EXCLUDED_PATHS = ["/login", "/register", "/auth"];

export default function AppShell({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, initialized } = useAuth();
    const { accountId } = useAccount();
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

    const isExcluded = SHELL_EXCLUDED_PATHS.some((p) => pathname.startsWith(p));

    React.useEffect(() => {
        setMobileMenuOpen(false);
    }, [pathname, accountId]);

    React.useEffect(() => {
        if (initialized && !isAuthenticated && !isExcluded) {
            if (typeof window !== "undefined") {
                const targetPath = window.location.pathname + window.location.search;
                if (targetPath && targetPath !== "/" && !targetPath.startsWith("/login")) {
                    window.location.href = `/login?redirect=${encodeURIComponent(targetPath)}`;
                } else {
                    window.location.href = "/login";
                }
            }
        }
    }, [initialized, isAuthenticated, isExcluded, pathname]);

    const showFullShell = initialized && isAuthenticated && !isExcluded;

    if (!initialized && !isExcluded) {
        return null;
    }

    if (!isAuthenticated && !isExcluded) {
        return null;
    }

    return (
        <>
            <RateLimitBanner />

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
                        <SponsorBanner variant="top" />
                        <SiteAnnouncementBanner />
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
