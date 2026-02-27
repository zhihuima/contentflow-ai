import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/api/', '/admin/'],
            },
            {
                userAgent: 'Googlebot',
                allow: '/',
            },
            {
                userAgent: 'Baiduspider',
                allow: '/',
            },
            {
                userAgent: '360Spider',
                allow: '/',
            },
            {
                userAgent: 'Sogou web spider',
                allow: '/',
            },
            {
                userAgent: 'Bytespider',
                allow: '/',
            },
        ],
        sitemap: 'https://contentflow-ai-zhihuima.zeabur.app/sitemap.xml',
    };
}
