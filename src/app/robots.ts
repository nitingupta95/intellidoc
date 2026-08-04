import { MetadataRoute } from 'next';
import { env } from '@/env';

export default function robots(): MetadataRoute.Robots {
  // Use validated environment variable instead of silent fallback
  const baseUrl = env.NEXT_PUBLIC_SITE_URL;

  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/api/og/*'],
      // Cross-reference Phase 0 Audit: Disallowing protected routes and non-marketing auth routes.
      disallow: [
        '/api/',
        '/dashboard/',
        '/chat/',
        '/documents/',
        '/knowledge-bases/',
        '/analytics/',
        '/billing/',
        '/settings/',
        '/forgot-password/',
        '/login/',
        '/register/',
        '/reset-password/',
        '/verify-email/',
        '/invite/',
        '/shared/',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
