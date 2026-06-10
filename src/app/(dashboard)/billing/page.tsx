import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BillingPage() {
  return (
    <div className="h-full flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 overflow-y-auto pb-6">
      <header className="shrink-0">
        <h1 className="text-3xl font-heading font-bold tracking-tight">Billing & Plans</h1>
        <p className="text-muted-foreground mt-1">Manage your subscription and usage limits.</p>
      </header>

      {/* Current Plan */}
      <div className="glass-panel p-8 border border-primary/20 relative overflow-hidden group">
        <div className="absolute top-[-50px] right-[-50px] w-[200px] h-[200px] bg-primary/10 rounded-full blur-[60px] pointer-events-none" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-heading font-bold">Enterprise Plan</h2>
              <span className="bg-primary/20 text-primary px-2.5 py-1 rounded-full text-xs font-semibold border border-primary/30 uppercase tracking-wider">
                Active
              </span>
            </div>
            <p className="text-muted-foreground">Your plan renews on <span className="font-medium text-foreground">July 1, 2026</span>.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="outline" className="glass">Manage Payment</Button>
            <Button>Upgrade Plan</Button>
          </div>
        </div>

        {/* Usage Stats */}
        <div className="mt-8 pt-8 border-t border-border/50 grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Document Storage</span>
              <span className="font-medium">45 GB / 100 GB</span>
            </div>
            <div className="h-2 w-full bg-background/50 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 w-[45%] rounded-full" />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">AI Queries</span>
              <span className="font-medium">8.2k / 50k</span>
            </div>
            <div className="h-2 w-full bg-background/50 rounded-full overflow-hidden">
              <div className="h-full bg-primary w-[16%] rounded-full" />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Team Members</span>
              <span className="font-medium">12 / 20</span>
            </div>
            <div className="h-2 w-full bg-background/50 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 w-[60%] rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { name: "Starter", price: "$49", docs: "5 GB", users: "3", queries: "10k" },
          { name: "Pro", price: "$199", docs: "50 GB", users: "10", queries: "50k", popular: true },
          { name: "Enterprise", price: "Custom", docs: "Unlimited", users: "Unlimited", queries: "Unlimited" },
        ].map((plan, i) => (
          <div key={i} className={`glass-panel p-6 border flex flex-col ${plan.popular ? 'border-primary/40 shadow-[0_0_30px_-10px_rgba(var(--primary),0.3)]' : 'border-border/50'}`}>
            {plan.popular && (
              <div className="mb-4">
                <span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-semibold border border-primary/30 uppercase tracking-wider">
                  Most Popular
                </span>
              </div>
            )}
            <h3 className="text-xl font-heading font-bold mb-2">{plan.name}</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-3xl font-bold">{plan.price}</span>
              {plan.price !== "Custom" && <span className="text-muted-foreground text-sm">/mo</span>}
            </div>
            
            <div className="space-y-4 flex-1 mb-8">
              <FeatureItem text={`${plan.docs} Vector Storage`} />
              <FeatureItem text={`Up to ${plan.users} Users`} />
              <FeatureItem text={`${plan.queries} AI Queries`} />
              <FeatureItem text="Advanced RAG Capabilities" />
            </div>
            
            <Button variant={plan.popular ? "default" : "outline"} className={`w-full ${!plan.popular && 'glass'}`}>
              {plan.price === "Custom" ? "Contact Sales" : "Select Plan"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <CheckCircle2 size={16} className="text-primary shrink-0" />
      <span className="text-sm text-foreground/80">{text}</span>
    </div>
  );
}
