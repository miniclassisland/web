"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { useAccount } from "@/lib/account-context";
import UserMenu from "./UserMenu";
import { ThemeModeToggle } from "@/lib/theme-context";
import { Navigation24Regular } from "@fluentui/react-icons";

export default function TopBar({
    title,
    onToggleMobileMenu,
}: {
    title?: string;
    onToggleMobileMenu?: () => void;
}) {
    const pathname = usePathname();
    const { currentAccount, accountId } = useAccount();

    const isUserCenter =
        pathname === "/" ||
        pathname.startsWith("/accounts/new") ||
        (pathname.startsWith("/security") && !accountId);

    const displayTitle =
        title ||
        (isUserCenter
            ? "MINI ClassIsland 用户中心"
            : currentAccount
              ? `账户中心 · ${currentAccount.name} (${currentAccount.slug})`
              : "MINI ClassIsland 账户中心");

    return (
        <header className="topbar">
            <div className="topbar-left-wrap">
                {onToggleMobileMenu && (
                    <button
                        type="button"
                        className="mobile-menu-btn"
                        onClick={onToggleMobileMenu}
                        aria-label="打开导航菜单"
                        title="导航菜单"
                    >
                        <Navigation24Regular />
                    </button>
                )}
                <div className="topbar-title">{displayTitle}</div>
            </div>
            <div className="topbar-right">
                <ThemeModeToggle />
                <UserMenu />
            </div>
        </header>
    );
}
