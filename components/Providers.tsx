"use client";

import React from "react";
import {
    FluentProvider,
    webLightTheme,
    webDarkTheme,
} from "@fluentui/react-components";
import type { Theme } from "@fluentui/react-components";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AccountProvider } from "@/lib/account-context";
import { ThemeModeProvider, useThemeMode } from "@/lib/theme-context";

const FONT_BASE = "'Google Sans Flex', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const FONT_MONO = "'Google Sans Code', 'Noto Sans SC', monospace";

const miniclassislandLightTheme: Theme = {
    ...webLightTheme,
    fontFamilyBase: FONT_BASE,
    fontFamilyMonospace: FONT_MONO,
};

const miniclassislandDarkTheme: Theme = {
    ...webDarkTheme,
    fontFamilyBase: FONT_BASE,
    fontFamilyMonospace: FONT_MONO,
};

/** 内部包裹层，确保 AccountProvider 能读取 Auth 状态 */
function InnerProviders({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuth();
    return (
        <AccountProvider isAuthenticated={isAuthenticated}>
            {children}
        </AccountProvider>
    );
}

function FluentThemeWrapper({ children }: { children: React.ReactNode }) {
    const { resolvedTheme } = useThemeMode();
    return (
        <FluentProvider
            theme={resolvedTheme === "dark" ? miniclassislandDarkTheme : miniclassislandLightTheme}
            style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)" }}
        >
            <AuthProvider>
                <InnerProviders>{children}</InnerProviders>
            </AuthProvider>
        </FluentProvider>
    );
}

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeModeProvider>
            <FluentThemeWrapper>{children}</FluentThemeWrapper>
        </ThemeModeProvider>
    );
}
