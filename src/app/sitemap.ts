import { MetadataRoute } from 'next';
import { env } from '@/env';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = env.NEXT_PUBLIC_SITE_URL;

  // Define static public routes
  const routes = [
    '',
    '/blog',
    '/blog/what-is-document-intelligence',
    '/contact',
    '/privacy',
    '/terms',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency: 'monthly' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  return [...routes];
}
