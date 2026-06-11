"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  CreditCard,
  Calendar,
  ArrowUpRight,
  Loader2,
  XCircle,
  Clock,
  AlertTriangle,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SubscriptionData {
  plan: string;
  planName: string;
  price: string;
  period: string;
  features: string[];
  limits: { uploads: number; queries: number; storageMB: number };
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
}

interface PaymentRecord {
  id: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  amount: number;
  currency: string;
  status: string;
  plan: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  SUCCESS: { icon: CheckCircle2, color: "text-emerald-400", label: "Success" },
  PENDING: { icon: Clock, color: "text-amber-400", label: "Pending" },
  FAILED: { icon: XCircle, color: "text-red-400", label: "Failed" },
  REFUNDED: { icon: Receipt, color: "text-blue-400", label: "Refunded" },
};

export default function BillingPage() {
  const [sub, setSub] = useState<SubscriptionData | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/subscriptions/current").then((r) => r.json()),
      fetch("/api/payments/history").then((r) => r.json()),
    ])
      .then(([subData, payData]) => {
        setSub(subData);
        setPayments(payData.payments || []);
      })
      .catch(() => toast.error("Failed to load billing data"))
      .finally(() => setLoading(false));
  }, []);

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel your subscription? You will be downgraded to the Free plan.")) {
      return;
    }
    setCancelling(true);
    try {
      const res = await fetch("/api/subscriptions/cancel", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Subscription Cancelled", { description: data.message });
      // Refresh data
      const newSub = await fetch("/api/subscriptions/current").then((r) => r.json());
      setSub(newSub);
    } catch (err: any) {
      toast.error("Failed to cancel", { description: err.message });
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isPaid = sub?.plan !== "FREE";
  const periodEnd = sub?.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="h-full flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 overflow-y-auto pb-6">
      <header className="shrink-0">
        <h1 className="text-3xl font-heading font-bold tracking-tight">
          Billing & Plans
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your subscription and view payment history.
        </p>
      </header>

      {/* ── Current Plan Card ──────────────────────────────── */}
      <div className="glass-panel p-8 border border-primary/20 relative overflow-hidden">
        <div className="absolute top-[-50px] right-[-50px] w-[200px] h-[200px] bg-primary/10 rounded-full blur-[60px] pointer-events-none" />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-heading font-bold">
                {sub?.planName || "Free"} Plan
              </h2>
              <span
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-semibold border uppercase tracking-wider",
                  sub?.subscriptionStatus === "ACTIVE"
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : sub?.subscriptionStatus === "CANCELLED"
                    ? "bg-red-500/20 text-red-400 border-red-500/30"
                    : "bg-primary/20 text-primary border-primary/30"
                )}
              >
                {sub?.subscriptionStatus || "Active"}
              </span>
            </div>

            {isPaid && periodEnd ? (
              <p className="text-muted-foreground flex items-center gap-2">
                <Calendar size={14} />
                Renews on{" "}
                <span className="font-medium text-foreground">{periodEnd}</span>
              </p>
            ) : (
              <p className="text-muted-foreground">
                Free plan — no billing cycle.
              </p>
            )}

            {isPaid && (
              <p className="text-sm text-muted-foreground mt-1">
                <span className="text-2xl font-bold text-foreground">
                  {sub?.price}
                </span>
                <span className="text-muted-foreground">/{sub?.period}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isPaid && sub?.subscriptionStatus === "ACTIVE" && (
              <Button
                variant="outline"
                className="glass text-destructive hover:text-destructive"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <AlertTriangle className="mr-2 h-4 w-4" />
                )}
                Cancel Subscription
              </Button>
            )}

            <Link href="/pricing">
              <Button className="font-medium shadow-lg shadow-primary/20">
                <ArrowUpRight className="mr-2 h-4 w-4" />
                {isPaid ? "Change Plan" : "Upgrade Plan"}
              </Button>
            </Link>
          </div>
        </div>

        {/* Plan Features */}
        {sub?.features && (
          <div className="mt-8 pt-8 border-t border-border/50 relative z-10">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Plan Features
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sub.features.map((f) => (
                <div key={f} className="flex items-center gap-2.5">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  <span className="text-sm text-foreground/80">{f}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Payment History ────────────────────────────────── */}
      <div className="glass-panel border border-border/50">
        <div className="p-6 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard size={20} className="text-primary" />
            <h2 className="text-lg font-heading font-semibold">Payment History</h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {payments.length} transaction{payments.length !== 1 ? "s" : ""}
          </span>
        </div>

        {payments.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt
              size={40}
              className="mx-auto text-muted-foreground/40 mb-4"
            />
            <p className="text-muted-foreground">No payments yet.</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              Upgrade your plan to see transactions here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground">
                  <th className="text-left px-6 py-3 font-medium">Date</th>
                  <th className="text-left px-6 py-3 font-medium">Plan</th>
                  <th className="text-left px-6 py-3 font-medium">Amount</th>
                  <th className="text-left px-6 py-3 font-medium">Status</th>
                  <th className="text-left px-6 py-3 font-medium">Order ID</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.PENDING;
                  const StatusIcon = cfg.icon;
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-border/30 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-6 py-4 text-foreground/80">
                        {new Date(p.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
                          {p.plan}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-foreground">
                        ₹{(p.amount / 100).toLocaleString("en-IN")}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon size={14} className={cfg.color} />
                          <span className={cn("text-xs font-medium", cfg.color)}>
                            {cfg.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-xs font-mono">
                        {p.razorpayOrderId.slice(0, 20)}…
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
