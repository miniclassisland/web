"use client";

import React from "react";
import {
    FluentProvider,
    webLightTheme,
    webDarkTheme,
    SSRProvider,
    RendererProvider,
    createDOMRenderer,
    renderToStyleElements,
} from "@fluentui/react-components";
import type { Theme } from "@fluentui/react-components";
import { useServerInsertedHTML } from "next/navigation";
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
    colorNeutralForegroundOnBrand: "#ffffff",
    colorBrandBackground: "#2899f5",
    colorBrandBackgroundHover: "#4baeff",
    colorBrandBackgroundPressed: "#0078d4",
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
    const [renderer] = React.useState(() => createDOMRenderer());
    const didRenderRef = React.useRef(false);

    useServerInsertedHTML(() => {
        if (didRenderRef.current) return;
        didRenderRef.current = true;
        return <>{renderToStyleElements(renderer)}</>;
    });

    return (
        <RendererProvider renderer={renderer}>
            <SSRProvider>
                <ThemeModeProvider>
                    <FluentThemeWrapper>{children}</FluentThemeWrapper>
                </ThemeModeProvider>
            </SSRProvider>
        </RendererProvider>
    );
}
