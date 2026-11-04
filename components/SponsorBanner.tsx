"use client";

import React, { useState, useEffect } from "react";
import { Dismiss16Regular } from "@fluentui/react-icons";

const DISMISS_STORAGE_KEY = "miniclassisland_sponsor_banner_dismissed_until";
/** 横幅关闭后的静默有效期：24 小时（过期后自动重新出现） */
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;

export default function SponsorBanner({ variant = "top" }: { variant?: "top" | "card" }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;
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
    }, []);

    function handleDismiss() {
        setVisible(false);
        try {
            localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now() + DISMISS_TTL_MS));
        } catch {
            /* ignore storage errors */
        }
    }

    if (!visible) return null;

    const className = variant === "card" ? "login-sponsor-banner" : "sponsor-banner";

    return (
        <div className={className} role="region" aria-label="赞助致谢">
            <span className="sponsor-banner-text">感谢智教联盟对本项目的赞助和支持</span>
            <button
                type="button"
                className="sponsor-banner-close"
                onClick={handleDismiss}
                aria-label="关闭赞助横幅（24小时内不再提示）"
                title="关闭横幅（24 小时后再次显示）"
            >
                <Dismiss16Regular />
            </button>
        </div>
    );
}
