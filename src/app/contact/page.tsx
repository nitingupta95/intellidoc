import type { Metadata } from "next";
import { env } from "@/env";
import ContactClient from "./page.client";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with the IntelliDoc AI team for enterprise sales, support, or general inquiries. We're here to help you transform document intelligence.",
  alternates: {
    canonical: `${env.NEXT_PUBLIC_SITE_URL}/contact`,
  },
};

export default function Contact() {
  return <ContactClient />;
}
