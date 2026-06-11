"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Sparkles, Zap, Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRazorpayCheckout } from "@/components/payments/RazorpayCheckout";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    key: "FREE" as const,
    name: "Free",
    price: "₹0",
    period: "forever",
    description: "Get started with essential document tools.",
    icon: Zap,
    features: [
      "5 document uploads",
      "50 AI queries / month",
      "500 MB storage",
      "Basic document analysis",
    ],
    cta: "Current Plan",
    popular: false,
    gradient: "from-slate-500/20 to-slate-600/10",
    iconColor: "text-slate-400",
    borderColor: "border-border/50",
  },
  {
    key: "PRO" as const,
    name: "Pro",
    price: "₹499",
    period: "month",
    description: "For professionals who need more power.",
    icon: Sparkles,
    features: [
      "100 document uploads",
      "2,000 AI queries / month",
      "10 GB storage",
      "Advanced AI analysis",
      "Priority processing",
      "Email support",
    ],
    cta: "Upgrade to Pro",
    popular: true,
    gradient: "from-indigo-500/20 to-purple-600/10",
    iconColor: "text-indigo-400",
    borderColor: "border-indigo-500/40",
  },
  {
    key: "ENTERPRISE" as const,
    name: "Enterprise",
    price: "₹1,999",
    period: "month",
    description: "For teams that demand the best.",
    icon: Crown,
    features: [
      "Unlimited uploads",
      "Unlimited AI queries",
      "100 GB storage",
      "Team collaboration",
      "Advanced analytics",
      "Dedicated support",
      "Custom integrations",
    ],
    cta: "Upgrade to Enterprise",
    popular: false,
    gradient: "from-amber-500/20 to-orange-600/10",
    iconColor: "text-amber-400",
    borderColor: "border-amber-500/30",
  },
];

export default function PricingPage() {
  const { handlePayment, loading } = useRazorpayCheckout();
  const [currentPlan, setCurrentPlan] = useState<string>("FREE");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetch("/api/subscriptions/current")
      .then((r) => r.json())
      .then((data) => {
        if (data.plan) setCurrentPlan(data.plan);
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  const onUpgrade = async (plan: "PRO" | "ENTERPRISE") => {
    setLoadingPlan(plan);
    await handlePayment(plan);
    setLoadingPlan(null);
  };

  return (
    <div className="h-full flex flex-col items-center overflow-y-auto pb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-12 pt-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider mb-6">
          <Sparkles size={14} />
          Pricing
        </div>
        <h1 className="text-4xl md:text-5xl font-heading font-bold tracking-tight mb-4">
          Choose your plan
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          Unlock the full potential of AI-powered document intelligence.
          <br className="hidden sm:block" />
          Start free, upgrade when you&apos;re ready.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 w-full max-w-5xl px-4">
        {PLANS.map((plan) => {
          const isCurrentPlan = currentPlan === plan.key;
          const Icon = plan.icon;
          const isUpgrade =
            plan.key !== "FREE" &&
            !isCurrentPlan &&
            (currentPlan === "FREE" ||
              (currentPlan === "PRO" && plan.key === "ENTERPRISE"));

          return (
            <div
              key={plan.key}
              className={cn(
                "relative flex flex-col rounded-2xl border p-8 transition-all duration-300",
                "glass-panel",
                plan.popular
                  ? "border-primary/40 shadow-[0_0_40px_-12px_rgba(99,102,241,0.3)] scale-[1.02]"
                  : plan.borderColor,
                isCurrentPlan && "ring-2 ring-primary/30"
              )}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary/30">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Current plan badge */}
              {isCurrentPlan && (
                <div className="absolute -top-3 right-6">
                  <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-500/30">
                    Current
                  </span>
                </div>
              )}

              {/* Icon + Name */}
              <div className="mb-6">
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
                    "bg-gradient-to-br",
                    plan.gradient
                  )}
                >
                  <Icon size={24} className={plan.iconColor} />
                </div>
                <h3 className="text-xl font-heading font-bold">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {plan.description}
                </p>
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl font-bold tracking-tight">
                  {plan.price}
                </span>
                {plan.period !== "forever" && (
                  <span className="text-muted-foreground text-sm">
                    /{plan.period}
                  </span>
                )}
              </div>

              {/* Features */}
              <div className="space-y-3 flex-1 mb-8">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-3">
                    <CheckCircle2
                      size={16}
                      className={cn(
                        "shrink-0 mt-0.5",
                        plan.popular ? "text-primary" : "text-emerald-400"
                      )}
                    />
                    <span className="text-sm text-foreground/80">{f}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              {isCurrentPlan ? (
                <Button
                  variant="outline"
                  className="w-full glass"
                  disabled
                >
                  Current Plan
                </Button>
              ) : isUpgrade ? (
                <Button
                  className={cn(
                    "w-full font-semibold",
                    plan.popular
                      ? "shadow-lg shadow-primary/20"
                      : ""
                  )}
                  disabled={loading || fetching}
                  onClick={() => onUpgrade(plan.key as "PRO" | "ENTERPRISE")}
                >
                  {loadingPlan === plan.key ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    plan.cta
                  )}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="w-full glass"
                  disabled
                >
                  {plan.key === "FREE" ? "Free Forever" : "Downgrade"}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom note */}
      <p className="text-xs text-muted-foreground mt-10 text-center max-w-md">
        All plans include SSL encryption and secure document storage. Payments are processed
        securely via Razorpay. Cancel anytime from the billing page.
      </p>
    </div>
  );
}
