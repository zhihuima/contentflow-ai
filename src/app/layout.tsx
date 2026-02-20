import type { Metadata } from "next";
import "./globals.css";

import type { Viewport } from "next";
import LayoutShell from "@/components/layout-shell";

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
};

export const metadata: Metadata = {
    title: "ContentFlow \u00b7 \u521b\u6d41 AI \u2014 \u667a\u80fd\u5185\u5bb9\u521b\u4f5c\u5e73\u53f0",
    description: "AI \u9a71\u52a8\u7684\u591a Agent \u5185\u5bb9\u521b\u4f5c\u5e73\u53f0 \u2014 \u6296\u97f3\u811a\u672c\u3001\u89c6\u9891\u53f7\u811a\u672c\u3001\u5c0f\u7ea2\u4e66\u56fe\u6587\u3001\u5185\u5bb9\u6da6\u8272\uff0c\u56e0\u5730\u5236\u5b9c\u4e00\u7ad9\u5f0f\u4ea4\u4ed8",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="zh-CN" suppressHydrationWarning>
            <body suppressHydrationWarning>
                <LayoutShell>{children}</LayoutShell>
            </body>
        </html>
    );
}
