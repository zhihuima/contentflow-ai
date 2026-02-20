// ============================================================
// Unsplash API — 自动配图搜索
// 免费 50 req/hr (无 key 时使用随机 Lorem Picsum 图片)
// ============================================================

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || '';
const UNSPLASH_API = 'https://api.unsplash.com';

interface UnsplashPhoto {
    id: string;
    urls: {
        raw: string;
        full: string;
        regular: string;
        small: string;
        thumb: string;
    };
    alt_description: string | null;
    user: {
        name: string;
        links: { html: string };
    };
}

export interface ImageResult {
    url: string;
    thumb: string;
    alt: string;
    credit: string;
    creditUrl: string;
}

/**
 * 搜索 Unsplash 图片
 * 如果没有 API Key，返回基于关键词的 Lorem Picsum 占位图
 */
export async function searchImages(
    keywords: string[],
    count: number = 1,
): Promise<ImageResult[]> {
    const query = keywords.join(' ');

    // 如果没有 API Key，使用 Lorem Picsum 提供美观的占位图
    if (!UNSPLASH_ACCESS_KEY) {
        return Array.from({ length: count }, (_, i) => ({
            url: `https://picsum.photos/seed/${encodeURIComponent(query + i)}/800/600`,
            thumb: `https://picsum.photos/seed/${encodeURIComponent(query + i)}/400/300`,
            alt: query,
            credit: 'Lorem Picsum',
            creditUrl: 'https://picsum.photos',
        }));
    }

    try {
        const response = await fetch(
            `${UNSPLASH_API}/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=squarish`,
            {
                headers: {
                    Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
                },
            },
        );

        if (!response.ok) {
            console.warn(`[Unsplash] API error: ${response.status}, falling back to placeholder`);
            return getFallbackImages(query, count);
        }

        const data = await response.json();
        const photos: UnsplashPhoto[] = data.results || [];

        if (photos.length === 0) {
            return getFallbackImages(query, count);
        }

        return photos.map(photo => ({
            url: photo.urls.regular,
            thumb: photo.urls.small,
            alt: photo.alt_description || query,
            credit: photo.user.name,
            creditUrl: photo.user.links.html,
        }));
    } catch (error) {
        console.warn('[Unsplash] Request failed, using fallback:', error);
        return getFallbackImages(query, count);
    }
}

/**
 * 为一组 slides 批量搜索配图
 */
export async function searchImagesForSlides(
    slides: { image_keywords?: string[]; image_description?: string }[],
): Promise<ImageResult[]> {
    const results: ImageResult[] = [];

    for (const slide of slides) {
        const keywords = slide.image_keywords?.length
            ? slide.image_keywords
            : slide.image_description
                ? slide.image_description.split(/[，,\s]+/).slice(0, 3)
                : ['abstract', 'background'];

        const images = await searchImages(keywords, 1);
        results.push(images[0]);
    }

    return results;
}

function getFallbackImages(query: string, count: number): ImageResult[] {
    return Array.from({ length: count }, (_, i) => ({
        url: `https://picsum.photos/seed/${encodeURIComponent(query + i)}/800/600`,
        thumb: `https://picsum.photos/seed/${encodeURIComponent(query + i)}/400/300`,
        alt: query,
        credit: 'Lorem Picsum',
        creditUrl: 'https://picsum.photos',
    }));
}
