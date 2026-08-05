"use client";

import { useEffect, useState } from "react";
import { TokenMeter } from "./TokenMeter";
import { useRazorpayCheckout } from "@/components/payments/RazorpayCheckout";
import { CREDIT_PACKS } from "@/lib/creditPacks";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, CreditCard } from "lucide-react";

export function BillingSettings() {
  const [wallet, setWallet] = useState<{ balance: number; lifetimeGranted: number; lifetimeSpent: number; isBYOK: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWallet = async () => {
    try {
      const res = await fetch("/api/wallet", { cache: "no-store" });
      if (res.ok) {
        setWallet(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  const { handleCreditPurchase, loading: checkoutLoading } = useRazorpayCheckout({
    onSuccess: () => {
      fetchWallet();
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (wallet?.isBYOK) {
    return (
      <div className="p-8 text-center space-y-4 bg-muted/30 rounded-xl border border-border/50">
        <h3 className="text-xl font-semibold">BYOK Mode Active</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          You are using your own API key. Your requests are not metered and you do not need to purchase AI credits.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Current Balance
            </CardTitle>
            <CardDescription>Your remaining AI credits</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground">
              {wallet?.balance.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage Metrics</CardTitle>
            <CardDescription>Track your lifetime usage</CardDescription>
          </CardHeader>
          <CardContent>
            <TokenMeter 
              lifetimeGranted={wallet?.lifetimeGranted || 0} 
              lifetimeSpent={wallet?.lifetimeSpent || 0} 
            />
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Refill Credits</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {Object.values(CREDIT_PACKS).map((pack) => (
            <Card key={pack.id} className="relative overflow-hidden flex flex-col hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="capitalize flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  {pack.id} Pack
                </CardTitle>
                <CardDescription>Instant credit refill</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="text-3xl font-bold mb-2">₹{pack.priceInr}</div>
                <div className="text-sm text-muted-foreground font-medium">
                  {pack.credits.toLocaleString()} Credits
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  disabled={checkoutLoading} 
                  onClick={() => handleCreditPurchase(pack.id)}
                >
                  {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Buy Now
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
