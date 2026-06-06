"use client";

import { Drawer } from "vaul";

export function MobileDrawer({ 
  trigger, 
  title, 
  description, 
  children 
}: { 
  trigger: React.ReactNode; 
  title: string; 
  description?: string; 
  children: React.ReactNode; 
}) {
  return (
    <Drawer.Root>
      <Drawer.Trigger asChild>
        {trigger}
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm" />
        <Drawer.Content className="bg-background flex flex-col rounded-t-[20px] h-[fit-content] mt-24 fixed bottom-0 left-0 right-0 z-50 border border-border/50 outline-none pb-[env(safe-area-inset-bottom)]">
          <div className="p-4 bg-background rounded-t-[20px] flex-1">
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted mb-6" />
            <div className="max-w-md mx-auto">
              <Drawer.Title className="font-heading font-semibold text-lg mb-1">
                {title}
              </Drawer.Title>
              {description && (
                <Drawer.Description className="text-sm text-muted-foreground mb-4">
                  {description}
                </Drawer.Description>
              )}
              <div className="mt-4">
                {children}
              </div>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
