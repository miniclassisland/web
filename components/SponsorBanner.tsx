"use client";

import React, { useState, useEffect } from "react";
import { Dismiss16Regular } from "@fluentui/react-icons";

const DISMISS_STORAGE_KEY = "miniclassisland_sponsor_banner_dismissed_until";
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;

export default function SponsorBanner({
    variant = "top",
    dismissible = true,
}: {
    variant?: "top" | "card";
    dismissible?: boolean;
}) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!dismissible) {
            setVisible(true);
            return;
        }
        const checkVisibility = () => {
            try {
                const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
                const until = raw ? parseInt(raw, 10) : 0;
                if (!Number.isNaN(until) && until > Date.now()) {
                    setVisible(false);
                    const remaining = Math.min(until - Date.now(), 2147483647);
                    const timer = window.setTimeout(() => setVisible(true), remaining);
                    return () => window.clearTimeout(timer);
                }
            } catch {
                /* ignore storage errors */
            }
            setVisible(true);
            return undefined;
        };
        return checkVisibility();
    }, [variant, dismissible]);

    function handleDismiss() {
        setVisible(false);
        try {
            localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now() + DISMISS_TTL_MS));
        } catch {
            /* ignore storage errors */
        }
    }

    if (!visible) return null;

    if (variant === "card") {
        return (
            <div className="login-sponsor-banner">
                <span>感谢智教联盟对本项目的赞助和支持</span>
                {dismissible && (
                    <button
                        type="button"
                        className="sponsor-banner-close"
                        onClick={handleDismiss}
                        aria-label="关闭赞助横幅"
                        title="关闭"
                    >
                        <Dismiss16Regular />
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="sponsor-banner">
            <span className="sponsor-banner-text">感谢智教联盟对本项目的赞助和支持</span>
            {dismissible && (
                <button
                    type="button"
                    className="sponsor-banner-close"
                    onClick={handleDismiss}
                    aria-label="关闭赞助横幅"
                    title="关闭"
                >
                    <Dismiss16Regular />
                </button>
            )}
        </div>
    );
}
