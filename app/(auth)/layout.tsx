import { Suspense, type ReactNode } from "react";
import { BrandLogo } from "@/components/navigation/brand-logo";
import { AuthBackground } from "@/components/auth/auth-background";
import { AuthStage } from "@/components/auth/auth-stage";
import { LoginCard } from "@/components/auth/login-card";
import { RegisterCard } from "@/components/auth/register-card";

// The layout persists across /login and /register, so the logo and background are never re-rendered
// by the swap; the page components only run the session redirect.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthBackground />
      <section className="workspace workspace-narrow flex flex-1 flex-col items-center justify-center gap-6 py-10">
        <BrandLogo variant="full" className="logo-full-auth mx-auto" priority />
        <div className="w-full">
          <Suspense fallback={null}>
            <AuthStage login={<LoginCard />} register={<RegisterCard />} />
          </Suspense>
        </div>
      </section>
      <Suspense fallback={null}>{children}</Suspense>
    </>
  );
}
