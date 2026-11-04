"use client";

import React from "react";
import UserMenu from "./UserMenu";
import { ThemeModeToggle } from "@/lib/theme-context";

export default function TopBar({ title }: { title?: string }) {
    return (
        <header className="topbar">
            <div className="topbar-title">{title || "MINI ClassIsland 管理面板"}</div>
            <div className="topbar-right">
                <ThemeModeToggle />
                <UserMenu />
            </div>
        </header>
    );
}
