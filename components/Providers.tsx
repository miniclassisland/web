"use client";

import React from "react";
import {
    FluentProvider,
    webLightTheme,
} from "@fluentui/react-components";
import type { Theme } from "@fluentui/react-components";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AccountProvider } from "@/lib/account-context";

/* 自定义主题：使用 Google Sans Flex 与 Noto Sans SC，等宽使用 Google Sans Code 并保留 Noto Sans SC 后备 */
const miniclassislandTheme: Theme = {
    ...webLightTheme,
    fontFamilyBase: "'Google Sans Flex', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontFamilyMonospace: "'Google Sans Code', 'Noto Sans SC', monospace",
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

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <FluentProvider theme={miniclassislandTheme}>
            <AuthProvider>
                <InnerProviders>{children}</InnerProviders>
            </AuthProvider>
        </FluentProvider>
    );
}
