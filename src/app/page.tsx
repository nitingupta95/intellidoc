import type { Metadata } from "next";
import { env } from "@/env";
import HomeClient from "./page.client";
import { JsonLd } from "@/components/seo/JsonLd";
import { PLANS } from "@/config/pricing";

export const metadata: Metadata = {
  title: "IntelliDoc AI | Enterprise Document Intelligence",
  description: "Transform static documents into intelligent knowledge with IntelliDoc AI. Upload documents, perform semantic search, and chat with pinpoint citations.",
  alternates: {
    canonical: `${env.NEXT_PUBLIC_SITE_URL}`,
  },
};

export default function Home() {
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "IntelliDoc AI",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "INR",
      lowPrice: Math.min(...PLANS.map(p => p.priceAmount)),
      highPrice: Math.max(...PLANS.map(p => p.priceAmount)),
      offerCount: PLANS.length,
      offers: PLANS.map(plan => ({
        "@type": "Offer",
        name: plan.name,
        price: plan.priceAmount,
        priceCurrency: plan.currency,
      })),
    }
  };

  return (
    <>
      <JsonLd data={schemaData} />
      <HomeClient />
    </>
  );
}
