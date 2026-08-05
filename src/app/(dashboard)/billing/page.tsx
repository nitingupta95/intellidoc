"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  CreditCard,
  Loader2,
  XCircle,
  Clock,
  Receipt,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BillingSettings } from "@/components/settings/BillingSettings";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";


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
  COMPLETED: { icon: CheckCircle2, color: "text-emerald-400", label: "Success" },
  PENDING: { icon: Clock, color: "text-amber-400", label: "Pending" },
  FAILED: { icon: XCircle, color: "text-red-400", label: "Failed" },
  REFUNDED: { icon: Receipt, color: "text-blue-400", label: "Refunded" },
};

export default function BillingPage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/subscriptions/current", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/payments/history", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([subData, payData]) => {
        setPayments(payData.payments || []);
      })
      .catch(() => toast.error("Failed to load billing data"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-6">
      <header className="shrink-0">
        <h1 className="text-3xl font-heading font-bold tracking-tight">
          Billing & Plans
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your subscription and view payment history.
        </p>
      </header>



      {/* ── AI Credits ─────────────────────────────────────── */}
      <div className="pt-2">
        <BillingSettings />
      </div>

      {/* ── Payment History ────────────────────────────────── */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-muted/20 py-4">
          <div className="flex items-center gap-3">
            <CreditCard size={20} className="text-primary" />
            <CardTitle className="text-lg">Payment History</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground font-medium bg-muted px-2.5 py-1 rounded-full">
            {payments.length} transaction{payments.length !== 1 ? "s" : ""}
          </span>
        </CardHeader>
        
        <CardContent className="p-0">

        {payments.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt
              size={40}
              className="mx-auto text-muted-foreground/40 mb-4"
            />
            <p className="text-muted-foreground font-medium">No payments yet.</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              Refill your AI credits to see transactions here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="font-medium">Date</TableHead>
                  <TableHead className="font-medium">Plan</TableHead>
                  <TableHead className="font-medium">Amount</TableHead>
                  <TableHead className="font-medium">Status</TableHead>
                  <TableHead className="font-medium">Order ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => {
                  const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.PENDING;
                  const StatusIcon = cfg.icon;
                  return (
                    <TableRow
                      key={p.id}
                      className="border-border/30 hover:bg-muted/30 transition-colors"
                    >
                      <TableCell className="text-foreground/80">
                        {new Date(p.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
                          {p.plan}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        ₹{(p.amount / 100).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <StatusIcon size={14} className={cfg.color} />
                          <span className={cn("text-xs font-medium", cfg.color)}>
                            {cfg.label}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-xs font-mono">
                            {p.razorpayOrderId}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(p.razorpayOrderId);
                              toast.success("Order ID copied to clipboard");
                            }}
                            className="p-1 hover:bg-muted/80 rounded-md transition-colors text-muted-foreground hover:text-foreground"
                            title="Copy Order ID"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        </CardContent>
      </Card>
    </div>
  );
}
