"use client";

import * as React from "react";
import { PanelLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type SidebarContextValue = {
  hydrated: boolean;
  isMobile: boolean;
  open: boolean;
  openMobile: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setOpenMobile: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const value = React.useContext(SidebarContext);
  if (!value) throw new Error("useSidebar must be used within SidebarProvider.");
  return value;
}

export function SidebarProvider({
  children,
  className,
  defaultOpen = true,
}: React.ComponentProps<"div"> & { defaultOpen?: boolean }) {
  const isMobile = useIsMobile();
  const [hydrated, setHydrated] = React.useState(false);
  const [open, setOpen] = React.useState(defaultOpen);
  const [openMobile, setOpenMobile] = React.useState(false);
  const toggleSidebar = React.useCallback(() => {
    const mobileViewport = typeof window !== "undefined" && window.innerWidth < 768;
    if (isMobile || mobileViewport) setOpenMobile((current) => !current);
    else setOpen((current) => !current);
  }, [isMobile]);

  React.useEffect(() => setHydrated(true), []);

  const value = React.useMemo(
    () => ({ hydrated, isMobile, open, openMobile, setOpen, setOpenMobile, toggleSidebar }),
    [hydrated, isMobile, open, openMobile, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={value}>
      <div
        className={cn("group/sidebar-wrapper flex min-h-screen w-full bg-canvas", className)}
        data-sidebar-hydrated={hydrated ? "true" : "false"}
        data-sidebar-open={open ? "true" : "false"}
        data-slot="sidebar-wrapper"
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export function Sidebar({ className, children, ...props }: React.ComponentProps<"aside">) {
  const { isMobile, open, openMobile, setOpenMobile } = useSidebar();

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent aria-label="Primary navigation" className={cn("p-0", className)} side="left">
          <div className="sr-only">
            <SheetTitle>ROLNET navigation</SheetTitle>
            <SheetDescription>Fleet pages and account actions.</SheetDescription>
          </div>
          <aside className="flex h-full min-h-0 flex-col" {...props}>{children}</aside>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      aria-label="Primary navigation"
      className={cn(
        "hidden h-screen w-64 shrink-0 flex-col border-r border-rule bg-surface text-ink md:sticky md:top-0 md:flex",
        !open && "md:hidden",
        className,
      )}
      data-slot="sidebar"
      {...props}
    >
      {children}
    </aside>
  );
}

export function SidebarInset({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex min-w-0 flex-1 flex-col", className)} data-slot="sidebar-inset" {...props} />;
}

export function SidebarTrigger({ className, ...props }: React.ComponentProps<typeof Button>) {
  const { hydrated, toggleSidebar } = useSidebar();
  return (
    <Button
      aria-label="Open navigation"
      className={cn("touch-target", className)}
      data-slot="sidebar-trigger"
      disabled={!hydrated}
      onClick={toggleSidebar}
      size="icon"
      type="button"
      variant="ghost"
      {...props}
    >
      <PanelLeftIcon aria-hidden="true" />
    </Button>
  );
}

export function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex shrink-0 flex-col gap-2 border-b border-rule p-4", className)} {...props} />;
}

export function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-2", className)} {...props} />;
}

export function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("shrink-0 border-t border-rule p-4", className)} {...props} />;
}

export function SidebarGroup({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("px-3 py-2", className)} {...props} />;
}

export function SidebarGroupLabel({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn("px-2 pb-1 text-label font-bold text-muted", className)} {...props} />;
}

export function SidebarGroupContent(props: React.ComponentProps<"div">) {
  return <div {...props} />;
}

export function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul className={cn("grid gap-1", className)} {...props} />;
}

export function SidebarMenuItem(props: React.ComponentProps<"li">) {
  return <li {...props} />;
}
