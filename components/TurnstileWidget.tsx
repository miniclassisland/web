"use client";

/**
 * Cloudflare Turnstile 人机验证组件（Explicit 渲染模式）。
 * Site Key: 0x4AAAAAAF0J1ST0LriGpOof
 */

import React, { useEffect, useRef } from "react";

export const TURNSTILE_SITE_KEY =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "0x4AAAAAAF0J1ST0LriGpOof";

declare global {
    interface Window {
        turnstile?: {
            render: (
                container: HTMLElement | string,
                options: {
                    sitekey: string;
                    callback?: (token: string) => void;
                    "expired-callback"?: () => void;
                    "error-callback"?: (errorCode?: string) => void;
                    theme?: "light" | "dark" | "auto";
                    action?: string;
                }
            ) => string;
            reset: (widgetId?: string) => void;
            remove: (widgetId?: string) => void;
        };
    }
}

export interface TurnstileWidgetProps {
    onVerify: (token: string) => void;
    onExpire?: () => void;
    onError?: () => void;
    action?: string;
    resetKey?: number;
}

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export default function TurnstileWidget({
    onVerify,
    onExpire,
    onError,
    action,
    resetKey = 0,
}: TurnstileWidgetProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const callbacksRef = useRef({ onVerify, onExpire, onError });

    useEffect(() => {
        callbacksRef.current = { onVerify, onExpire, onError };
    }, [onVerify, onExpire, onError]);

    useEffect(() => {
        let cancelled = false;

        function renderWidget() {
            if (cancelled || !containerRef.current || !window.turnstile) return;
            if (widgetIdRef.current !== null) {
                try {
                    window.turnstile.remove(widgetIdRef.current);
                } catch {
                    /* ignore */
                }
                widgetIdRef.current = null;
            }
            try {
                widgetIdRef.current = window.turnstile.render(containerRef.current, {
                    sitekey: TURNSTILE_SITE_KEY,
                    action,
                    theme: "auto",
                    callback: (token: string) => {
                        callbacksRef.current.onVerify(token);
                    },
                    "expired-callback": () => {
                        callbacksRef.current.onVerify("");
                        callbacksRef.current.onExpire?.();
                    },
                    "error-callback": () => {
                        callbacksRef.current.onVerify("");
                        callbacksRef.current.onError?.();
                    },
                });
            } catch {
                /* ignore */
            }
        }

        if (typeof window !== "undefined") {
            if (window.turnstile) {
                renderWidget();
            } else {
                let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
                if (!script) {
                    script = document.createElement("script");
                    script.id = SCRIPT_ID;
                    script.src = SCRIPT_SRC;
                    script.async = true;
                    script.defer = true;
                    document.head.appendChild(script);
                }
                const onLoad = () => renderWidget();
                script.addEventListener("load", onLoad);
                const pollId = window.setInterval(() => {
                    if (window.turnstile) {
                        window.clearInterval(pollId);
                        renderWidget();
                    }
                }, 150);
                return () => {
                    cancelled = true;
                    script?.removeEventListener("load", onLoad);
                    window.clearInterval(pollId);
                    if (widgetIdRef.current !== null && window.turnstile) {
                        try {
                            window.turnstile.remove(widgetIdRef.current);
                        } catch {
                            /* ignore */
                        }
                        widgetIdRef.current = null;
                    }
                };
            }
        }

        return () => {
            cancelled = true;
            if (widgetIdRef.current !== null && typeof window !== "undefined" && window.turnstile) {
                try {
                    window.turnstile.remove(widgetIdRef.current);
                } catch {
                    /* ignore */
                }
                widgetIdRef.current = null;
            }
        };
    }, [action, resetKey]);

    return (
        <div
            style={{
                display: "flex",
                justifyContent: "center",
                margin: "12px 0",
                minHeight: 65,
            }}
        >
            <div ref={containerRef} />
        </div>
    );
}
