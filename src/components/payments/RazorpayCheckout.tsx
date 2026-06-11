"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface UseRazorpayCheckoutOptions {
  onSuccess?: () => void;
  onFailure?: (error: string) => void;
}

export function useRazorpayCheckout(options?: UseRazorpayCheckoutOptions) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const loadScript = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }, []);

  const handlePayment = useCallback(
    async (plan: "PRO" | "ENTERPRISE") => {
      setLoading(true);

      try {
        // 1. Load Razorpay script
        const loaded = await loadScript();
        if (!loaded) {
          throw new Error("Failed to load Razorpay SDK");
        }

        // 2. Create order on our backend
        const orderRes = await fetch("/api/payments/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan }),
        });

        const orderData = await orderRes.json();
        if (!orderRes.ok) {
          throw new Error(orderData.error || "Failed to create order");
        }

        // 3. Open Razorpay Checkout
        const rzpOptions = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: orderData.amount,
          currency: orderData.currency,
          name: "IntelliDoc AI",
          description: `${plan} Plan Subscription`,
          order_id: orderData.orderId,
          theme: {
            color: "#6366f1",
            backdrop_color: "rgba(0,0,0,0.7)",
          },
          modal: {
            ondismiss: () => {
              setLoading(false);
            },
          },
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              // 4. Verify on backend
              const verifyRes = await fetch("/api/payments/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(response),
              });

              const verifyData = await verifyRes.json();
              if (!verifyRes.ok) {
                throw new Error(verifyData.error || "Verification failed");
              }

              toast.success("Payment Successful!", {
                description: `Welcome to the ${plan} plan. Enjoy your upgraded features!`,
              });
              options?.onSuccess?.();
              router.push("/dashboard");
              router.refresh();
            } catch (err: any) {
              toast.error("Payment Verification Failed", {
                description: err.message || "Please contact support.",
              });
              options?.onFailure?.(err.message);
            } finally {
              setLoading(false);
            }
          },
          prefill: {},
        };

        const rzp = new window.Razorpay(rzpOptions);

        rzp.on("payment.failed", (response: any) => {
          toast.error("Payment Failed", {
            description:
              response.error?.description || "Something went wrong. Please try again.",
            action: {
              label: "Retry",
              onClick: () => handlePayment(plan),
            },
          });
          options?.onFailure?.(response.error?.description);
          setLoading(false);
        });

        rzp.open();
      } catch (err: any) {
        toast.error("Payment Error", {
          description: err.message || "Could not initiate payment.",
        });
        options?.onFailure?.(err.message);
        setLoading(false);
      }
    },
    [loadScript, options, router]
  );

  return { handlePayment, loading };
}
