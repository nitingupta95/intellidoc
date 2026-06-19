import Link from "next/link";
import { BottomNav } from "@/components/layout/bottom-nav";
import { MainSidebar } from "@/components/layout/MainSidebar";
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";
import { OnboardingTour } from "@/components/layout/OnboardingTour";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden w-full">
      <OnboardingTour />
      {/* Main Sidebar (Collapsible) */}
      <MainSidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative h-full overflow-hidden pb-16 lg:pb-0">
        {/* Top Navigation for Mobile */}
        <header className="h-16 min-h-[64px] border-b border-border glass flex items-center justify-between px-4 lg:hidden z-10 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2 font-heading font-bold tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shrink-0 text-sm">
              ID
            </div>
          </Link>
          <div className="flex-1 px-4 flex justify-end">
            <WorkspaceSwitcher isMobile={true} />
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 md:p-10 scrollbar-thin">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
