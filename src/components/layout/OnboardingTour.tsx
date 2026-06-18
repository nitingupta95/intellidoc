"use client";

import { useEffect, useState } from "react";
import { Joyride, STATUS } from "react-joyride";
import { usePathname } from "next/navigation";

export function OnboardingTour() {
  const [run, setRun] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Only run tour if user hasn't seen it and is on the dashboard
    const hasSeenTour = localStorage.getItem("intellidoc_tour_completed");
    if (!hasSeenTour && pathname === "/dashboard") {
      setRun(true);
      // Immediately set to true so if they refresh or navigate away mid-tour, it never restarts
      localStorage.setItem("intellidoc_tour_completed", "true");
    }
  }, [pathname]);

  const steps = [
    {
      target: "body",
      title: "Welcome to IntelliDoc! 🚀",
      content: "Your enterprise document intelligence platform. Let's take a quick 30-second tour to show you how to securely manage, organize, and chat with your documents using advanced AI.",
      placement: "center" as const,
      disableBeacon: true,
    },
    {
      target: "[data-tour='workspace-selector']",
      title: "Workspaces",
      content: "Workspaces are completely isolated environments. Create different workspaces for different teams (like HR, Legal, or Engineering) to keep documents and access strictly separated.",
      placement: "right" as const,
    },
    {
      target: "[data-tour='nav-kb']",
      title: "Knowledge Bases",
      content: "Think of Knowledge Bases as specialized, targeted libraries. Group specific documents together so the AI can answer questions using ONLY the context from that specific collection.",
      placement: "right" as const,
    },
    {
      target: "[data-tour='nav-docs']",
      title: "Document Management",
      content: "Upload your PDFs, Word documents, and text files here. Our system will automatically process and index them in the background, making them instantly searchable.",
      placement: "right" as const,
    },
    {
      target: "[data-tour='nav-chat']",
      title: "IntelliDoc AI Chat",
      content: "The core of IntelliDoc! Once your documents are indexed, come here to chat with them. You can ask complex questions, and the AI will provide highly accurate answers with exact citations from your files.",
      placement: "right" as const,
    }
  ];

  const handleJoyrideCallback = (data: any) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    // If the user skips, finishes, or even if they close it, we mark it as completed
    if (finishedStatuses.includes(status)) {
      setRun(false);
      localStorage.setItem("intellidoc_tour_completed", "true");
    }
  };

  const JoyrideComponent: any = Joyride;

  return (
    <JoyrideComponent
      steps={steps}
      run={run}
      continuous
      showSkipButton
      showProgress
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: '#3b82f6', // Tailwind blue-500
          textColor: '#1f2937',
          backgroundColor: '#ffffff',
          overlayColor: 'rgba(0, 0, 0, 0.6)',
          zIndex: 1000,
        },
        tooltip: {
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        },
        tooltipTitle: {
          fontSize: '1.25rem',
          fontWeight: 700,
          marginBottom: '12px',
          color: '#111827',
        },
        tooltipContent: {
          fontSize: '0.95rem',
          lineHeight: 1.6,
          color: '#4b5563',
          textAlign: 'left' as const,
        },
        buttonNext: {
          backgroundColor: '#3b82f6',
          borderRadius: '8px',
          padding: '10px 16px',
          fontWeight: 500,
        },
        buttonBack: {
          marginRight: '12px',
          color: '#6b7280',
          fontWeight: 500,
        },
        buttonSkip: {
          color: '#9ca3af',
          fontWeight: 500,
        }
      }}
    />
  );
}
