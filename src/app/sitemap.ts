import type { MetadataRoute } from 'next';

const BASE_URL = 'https://contentflow-ai-zhihuima.zeabur.app';

export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date();

    return [
        {
            url: BASE_URL,
            lastModified: now,
            changeFrequency: 'daily',
            priority: 1.0,
        },
        {
            url: `${BASE_URL}/workspace`,
            lastModified: now,
            changeFrequency: 'daily',
            priority: 0.9,
        },
        {
            url: `${BASE_URL}/breakdown`,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/departments`,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 0.7,
        },
        {
            url: `${BASE_URL}/meeting`,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 0.7,
        },
        {
            url: `${BASE_URL}/contacts`,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 0.6,
        },
        {
            url: `${BASE_URL}/chat`,
            lastModified: now,
            changeFrequency: 'daily',
            priority: 0.7,
        },
        {
            url: `${BASE_URL}/video-gen`,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 0.7,
        },
        {
            url: `${BASE_URL}/tasks`,
            lastModified: now,
            changeFrequency: 'daily',
            priority: 0.6,
        },
        {
            url: `${BASE_URL}/login`,
            lastModified: now,
            changeFrequency: 'monthly',
            priority: 0.3,
        },
    ];
}
