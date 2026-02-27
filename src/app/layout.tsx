import type { Metadata } from "next";
import "./globals.css";

import type { Viewport } from "next";
import LayoutShell from "@/components/layout-shell";

const SITE_URL = "https://contentflow-ai-zhihuima.zeabur.app";
const SITE_NAME = "ContentFlow · 创流 AI";
const SITE_DESCRIPTION = "AI 驱动的多 Agent 智能内容创作平台 — 一键生成抖音脚本、视频号脚本、小红书图文、公众号文章、朋友圈文案。爆款内容拆解、伪原创生成、AI 多人协作会议、智能内容润色与模仿创作，因地制宜一站式交付。";

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
};

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
        default: `${SITE_NAME} — 智能内容创作平台`,
        template: `%s | ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    keywords: [
        "AI内容创作", "智能写作", "抖音脚本生成", "小红书文案",
        "视频号脚本", "公众号文章", "AI写作助手", "内容创作平台",
        "爆款拆解", "伪原创", "AI润色", "模仿创作",
        "多Agent协作", "智能文案", "自媒体工具", "内容营销",
        "ContentFlow", "创流AI", "AI员工", "内容工厂",
        "短视频脚本", "种草文案", "朋友圈文案生成",
    ],
    authors: [{ name: "ContentFlow AI Team" }],
    creator: "ContentFlow AI",
    publisher: "ContentFlow AI",
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
        },
    },
    openGraph: {
        type: "website",
        locale: "zh_CN",
        url: SITE_URL,
        siteName: SITE_NAME,
        title: `${SITE_NAME} — AI 驱动的智能内容创作平台`,
        description: SITE_DESCRIPTION,
        images: [
            {
                url: `${SITE_URL}/og-image.png`,
                width: 1200,
                height: 630,
                alt: "ContentFlow AI — 智能内容创作平台",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: `${SITE_NAME} — AI 驱动的智能内容创作平台`,
        description: "一键生成抖音脚本、小红书图文、视频号脚本等多平台内容，AI 多 Agent 协作创作",
        images: [`${SITE_URL}/og-image.png`],
    },
    alternates: {
        canonical: SITE_URL,
    },
    category: "technology",
    classification: "AI Content Creation Platform",
    other: {
        "baidu-site-verification": "contentflow-ai",
        "360-site-verification": "contentflow-ai",
        "sogou_site_verification": "contentflow-ai",
        "msvalidate.01": "contentflow-ai",
    },
};

// JSON-LD Structured Data
const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "CNY",
    },
    aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.8",
        ratingCount: "128",
    },
    featureList: [
        "抖音脚本一键生成",
        "小红书种草图文创作",
        "视频号脚本智能编写",
        "爆款内容深度拆解",
        "AI伪原创内容生成",
        "多Agent AI协作会议",
        "智能内容润色优化",
        "风格模仿创作",
        "公众号文章撰写",
        "朋友圈文案生成",
    ],
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="zh-CN" suppressHydrationWarning>
            <head>
                <link rel="icon" href="/favicon.ico" sizes="any" />
                <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
            </head>
            <body suppressHydrationWarning>
                <LayoutShell>{children}</LayoutShell>
            </body>
        </html>
    );
}
