"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MessageSquare, BrainCircuit, Info, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SuggestionButton } from "./suggestion-button";

interface ChatMessagesProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[];
  isGenerating: boolean;
  hasKey: boolean | null;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  docTitle?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  docDetails: any;
  setInput: (t: string) => void;
}

export function ChatMessages({
  messages,
  isGenerating,
  hasKey,
  messagesEndRef,
  docTitle,
  docDetails,
  setInput,
}: ChatMessagesProps) {
  if (hasKey === false) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-6 max-w-md mx-auto mt-10">
        <div className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive mb-4">
          <Info size={32} />
        </div>
        <h2 className="text-2xl font-heading font-semibold">API Key Required</h2>
        <p className="text-muted-foreground text-sm">
          You must provide an OpenAI or Gemini API Key to use the IntelliDoc Assistant. 
          Please upload your API key in the settings tab to continue.
        </p>

        <div className="mt-4 p-4 rounded-xl bg-primary/10 border border-primary/20 text-left w-full">
          <h3 className="font-semibold text-primary text-sm mb-1">Need a free API key?</h3>
          <p className="text-xs text-muted-foreground mb-3">
            You can get a free Gemini API key from Google AI Studio. 
          </p>
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
            <Button variant="outline" className="w-full text-xs h-8">Get Free Gemini Key</Button>
          </a>
        </div>
        
        <div className="mt-6 w-full">
          <Link href="/settings">
            <Button className="w-full">Go to Settings</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center py-10 md:py-20 text-center space-y-6 max-w-md mx-auto min-h-full">
        <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4 shrink-0">
          <MessageSquare size={32} />
        </div>
        <h2 className="text-2xl font-heading font-semibold">
          {docTitle ? `Chat with ${docTitle}` : "How can I help you today?"}
        </h2>
        <p className="text-muted-foreground text-sm">
          {docTitle 
            ? docDetails?.summary || "Ask me anything about this document. I'll search through it and provide cited answers."
            : "Select a document from the dropdown above, or ask a general question. If you haven't uploaded any PDFs yet, head over to the Documents section."}
        </p>
        
        {!docTitle && (
          <div className="flex gap-4 mt-2">
            <Link href="/documents">
              <Button variant="outline" className="text-sm">Upload a PDF Document</Button>
            </Link>
          </div>
        )}
        
        <div className="grid grid-cols-1 w-full gap-3 mt-8">
          {docDetails?.suggestedQuestions && docDetails.suggestedQuestions.length > 0 ? (
            docDetails.suggestedQuestions.map((q: string, i: number) => (
              <SuggestionButton key={i} text={q} onClick={(t) => setInput(t)} />
            ))
          ) : (
            <>
              <SuggestionButton text="Summarize the key points" onClick={(t) => setInput(t)} />
              <SuggestionButton text="What are the main takeaways?" onClick={(t) => setInput(t)} />
              <SuggestionButton text="Extract important entities and dates" onClick={(t) => setInput(t)} />
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-32">
      {messages.map((msg, idx) => (
        <div key={msg.id} className={`flex gap-3 md:gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          {msg.role === 'assistant' && (
            <div className="w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center shrink-0 mt-1 border border-primary/20 shadow-sm relative overflow-hidden">
              <BrainCircuit size={16} className="text-primary" />
            </div>
          )}
          <div className={`max-w-[85%] sm:max-w-[75%] p-4 shadow-sm transition-all ${
            msg.role === 'user' 
              ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground ml-auto rounded-3xl rounded-tr-sm' 
              : 'glass-panel bg-background/60 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-3xl rounded-tl-sm'
          }`}>
            {msg.role === 'assistant' ? (
              <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:my-2 prose-code:before:content-none prose-code:after:content-none prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-pre:bg-muted/80 prose-pre:border prose-pre:border-border/50 prose-pre:rounded-xl prose-a:text-primary prose-strong:text-foreground text-sm leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
            )}
            
            {msg.citations && msg.citations.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <p className="text-xs font-semibold mb-2 flex items-center gap-1 opacity-70">
                  <Info size={12} /> Sources:
                </p>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {msg.citations.map((cit: any, i: number) => (
                    <div key={i} className="px-3 py-1.5 rounded-lg bg-background/50 border border-border text-[10px] shrink-0 max-w-[200px]">
                      <span className="font-bold block truncate text-primary">Doc • {(cit.score * 100).toFixed(1)}% match</span>
                      <span className="truncate block opacity-70">{cit.text_snippet}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {msg.isStreaming && isGenerating && idx === messages.length - 1 && (
              <span className="inline-flex items-center gap-1 mt-2 text-primary opacity-70">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            )}
          </div>
          {msg.role === 'user' && (
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
              <User size={16} className="text-muted-foreground" />
            </div>
          )}
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
