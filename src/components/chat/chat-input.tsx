"use client";

import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  input: string;
  setInput: (t: string) => void;
  handleSend: () => Promise<void>;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  isGenerating: boolean;
  hasKey: boolean | null;
}

export function ChatInput({
  input,
  setInput,
  handleSend,
  handleKeyDown,
  isGenerating,
  hasKey,
}: ChatInputProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none bg-gradient-to-t from-background via-background/90 to-transparent pt-12 pb-[calc(env(safe-area-inset-bottom)+16px)] z-40">
      <div className="max-w-4xl mx-auto relative pointer-events-auto px-2">
        <div className="glass-panel bg-background/70 backdrop-blur-2xl rounded-[32px] border border-white/20 dark:border-white/10 flex items-end p-2 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary/50 transition-all shadow-xl">
          <textarea 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasKey === false ? "Please add an API key first..." : "Ask a question..."}
            disabled={hasKey === false}
            className="flex-1 bg-transparent border-none focus:ring-0 resize-none min-h-[44px] max-h-[150px] md:max-h-[200px] py-3 px-4 text-[16px] md:text-sm leading-relaxed placeholder:text-muted-foreground scrollbar-thin outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            rows={1}
          />
          
          <Button 
            onClick={handleSend} 
            disabled={!input.trim() || isGenerating || hasKey === false}
            size="icon" 
            className="rounded-full shrink-0 mb-1 mr-1 h-10 w-10 transition-transform hover:scale-105 active:scale-95 bg-gradient-to-r from-primary to-primary/80 hover:from-primary hover:to-primary shadow-md border border-primary/20"
          >
            {isGenerating ? (
              <Loader2 size={18} className="animate-spin text-primary-foreground" />
            ) : (
              <Send size={18} className="ml-1 text-primary-foreground" />
            )}
          </Button>
        </div>
        <div className="text-center mt-3 text-[10px] md:text-xs text-muted-foreground hidden sm:block font-medium drop-shadow-sm">
          IntelliDoc AI can make mistakes. Verify important information using the provided citations.
        </div>
      </div>
    </div>
  );
}
