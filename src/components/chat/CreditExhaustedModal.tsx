"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useConversationStore } from "@/store/conversation-store";
import { Coins, AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRazorpayCheckout } from "@/components/payments/RazorpayCheckout";

export function CreditExhaustedModal() {
  const { showCreditModal, setShowCreditModal, creditErrorData } = useConversationStore();
  const router = useRouter();
  
  const { handleCreditPurchase, loading } = useRazorpayCheckout({
    onSuccess: () => {
      setShowCreditModal(false);
    }
  });

  const handleRefill = async () => {
    // For now we default to starter pack for the quick-refill modal
    await handleCreditPurchase("starter");
  };

  return (
    <Dialog open={showCreditModal} onOpenChange={setShowCreditModal}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Credits Exhausted
          </DialogTitle>
          <DialogDescription>
            You have run out of AI credits and cannot send this message.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-4 py-4">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              <span className="font-medium">Current Balance</span>
            </div>
            <span className="font-bold text-destructive">
              {creditErrorData?.balance ?? 0}
            </span>
          </div>
          {creditErrorData?.required && (
            <p className="text-sm text-muted-foreground">
              Estimated cost for this request: <span className="font-medium text-foreground">{creditErrorData.required} credits</span>.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setShowCreditModal(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleRefill} className="gap-2" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
            {loading ? "Processing..." : "Refill Credits (₹199)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
