import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-heading" });
import { env } from "@/env";
import { AuthProvider } from "@/components/auth-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { JsonLd } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    template: "%s | IntelliDoc AI",
    default: "IntelliDoc AI | Enterprise Document Intelligence",
  },
  description: "Transform static documents into intelligent knowledge with IntelliDoc AI.",
  applicationName: "IntelliDoc AI",
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${outfit.variable}`}>
      <body
        className="font-sans antialiased bg-background text-foreground min-h-screen"
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <JsonLd 
            data={{
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "IntelliDoc AI",
              url: env.NEXT_PUBLIC_SITE_URL,
              logo: `${env.NEXT_PUBLIC_SITE_URL}/favicon.ico`,
              sameAs: ["https://github.com/nitingupta95/intellidoc"]
            }}
          />
          <AuthProvider>
            {/* Animated Gradient Background */}
            <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse duration-10000" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse duration-10000 delay-1000" />
          </div>

          <div className="relative z-0 flex flex-col min-h-screen">
            {children}
          </div>
          <Toaster position="top-right" richColors />
        </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
