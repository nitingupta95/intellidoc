import Link from "next/link";
import { BottomNav } from "@/components/layout/bottom-nav";
import { MainSidebar } from "@/components/layout/MainSidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden w-full">
      {/* Main Sidebar (Collapsible) */}
      <MainSidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative h-full overflow-hidden pb-16 md:pb-0">
        {/* Top Navigation for Mobile (stubbed out) */}
        <header className="h-16 min-h-[64px] border-b border-border glass flex items-center justify-between px-6 md:hidden z-10 shrink-0">
          <span className="font-heading font-bold text-lg tracking-tight">IntelliDoc AI</span>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10 scrollbar-thin">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
