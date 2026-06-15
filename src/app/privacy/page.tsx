import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Privacy Policy | IntelliDoc AI",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#050505] text-gray-900 dark:text-[#FAFAFA] font-sans selection:bg-black/10 dark:selection:bg-white/20 px-6 py-24">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors mb-8">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>
        <h1 className="text-4xl font-bold tracking-tight mb-8">Privacy Policy</h1>
        <div className="prose prose-gray dark:prose-invert max-w-none space-y-6">
          <p className="text-sm text-gray-500">Last updated: {new Date().toLocaleDateString()}</p>
          
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
            <p className="text-gray-600 dark:text-gray-300">
              We collect information that you provide directly to us, including your name, email address, and any documents you upload to IntelliDoc AI. We also automatically collect certain technical information when you visit our site.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
            <p className="text-gray-600 dark:text-gray-300">
              We use the information we collect to operate, maintain, and improve our services, communicate with you, process your transactions, and protect our platforms and users. We strictly process your uploaded documents for semantic search and AI intelligence purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Data Security</h2>
            <p className="text-gray-600 dark:text-gray-300">
              We implement robust security measures to ensure that your documents and personal data are kept secure. Documents are encrypted at rest and in transit, and strictly isolated across different workspaces.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Contact Us</h2>
            <p className="text-gray-600 dark:text-gray-300">
              If you have questions or comments about this Privacy Policy, please contact us via our Contact page.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
