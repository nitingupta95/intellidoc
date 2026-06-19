"use client";

import { Button } from "@/components/ui/button";

interface ApiSettingsProps {
  openApiKey: string;
  setOpenApiKey: (val: string) => void;
  maskedOpenApiKey: string | null;
  isOpenAiKeySaving: boolean;
  onSaveOpenApiKey: () => Promise<void>;
  onRevokeOpenApiKey: () => Promise<void>;
  geminiKey: string;
  setGeminiKey: (val: string) => void;
  maskedGeminiKey: string | null;
  isSystemGeminiKey: boolean;
  isGeminiKeySaving: boolean;
  onSaveGeminiKey: () => Promise<void>;
  onRevokeGeminiKey: () => Promise<void>;
  isKeyLoading: boolean;
}

export function ApiSettings({
  openApiKey,
  setOpenApiKey,
  maskedOpenApiKey,
  isOpenAiKeySaving,
  onSaveOpenApiKey,
  onRevokeOpenApiKey,
  geminiKey,
  setGeminiKey,
  maskedGeminiKey,
  isSystemGeminiKey,
  isGeminiKeySaving,
  onSaveGeminiKey,
  onRevokeGeminiKey,
  isKeyLoading,
}: ApiSettingsProps) {
  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 border border-border/50">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-heading font-semibold">API Keys</h2>
            <p className="text-sm text-muted-foreground">Manage your secret keys for programmatic access.</p>
          </div>
        </div>
        <div className="space-y-4">
          {isKeyLoading ? (
            <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
          ) : (
            <div className="space-y-6">
              {/* OpenAI Key Section */}
              <div>
                {maskedOpenApiKey ? (
                  <div className="p-4 rounded-lg bg-background/30 border border-border/50 flex justify-between items-center group">
                    <div>
                      <h4 className="font-medium text-sm">OpenAI API Key</h4>
                      <p className="text-xs text-muted-foreground font-mono mt-1">{maskedOpenApiKey}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="glass h-8" onClick={onRevokeOpenApiKey} disabled={isOpenAiKeySaving}>
                        {isOpenAiKeySaving ? "Revoking..." : "Revoke"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">You have not set an OpenAI API Key. Provide one to enable OpenAI functionality.</p>
                    <div className="flex flex-col gap-2 max-w-md">
                      <label className="text-sm font-medium">OpenAI API Key</label>
                      <input 
                        type="password" 
                        placeholder="sk-..." 
                        value={openApiKey}
                        onChange={(e) => setOpenApiKey(e.target.value)}
                        className="w-full px-3 py-2 glass bg-background/50 border border-border/50 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" 
                      />
                      <Button size="sm" className="w-fit mt-2" onClick={onSaveOpenApiKey} disabled={!openApiKey || isOpenAiKeySaving}>
                        {isOpenAiKeySaving ? "Saving..." : "Save OpenAI Key"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <hr className="border-border/50" />

              {/* Gemini Key Section */}
              <div>
                {maskedGeminiKey && !isSystemGeminiKey ? (
                  <div className="p-4 rounded-lg bg-background/30 border border-border/50 flex justify-between items-center group">
                    <div>
                      <h4 className="font-medium text-sm">Gemini API Key</h4>
                      <p className="text-xs text-muted-foreground font-mono mt-1">{maskedGeminiKey}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="glass h-8" onClick={onRevokeGeminiKey} disabled={isGeminiKeySaving}>
                        {isGeminiKeySaving ? "Revoking..." : "Revoke"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {isSystemGeminiKey ? (
                      <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-left mb-4">
                        <h3 className="font-semibold text-primary text-sm mb-1">System Default Key Active</h3>
                        <p className="text-xs text-muted-foreground">
                          You are currently using the free default IntelliDoc key. You can provide your own personal API key below to override this.
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground">You have not set a Gemini API Key. Provide one to enable Gemini AI functionality.</p>
                        
                        <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-left max-w-md">
                          <h3 className="font-semibold text-primary text-sm mb-1">Need a free API key?</h3>
                          <p className="text-xs text-muted-foreground mb-3">
                            You can get a free Gemini API key from Google AI Studio.
                          </p>
                          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
                            <Button variant="outline" className="w-full text-xs h-8">Get Free Gemini Key</Button>
                          </a>
                        </div>
                      </>
                    )}
                    <div className="flex flex-col gap-2 max-w-md">
                      <label className="text-sm font-medium">Gemini API Key</label>
                      <input 
                        type="password" 
                        placeholder="AIza..." 
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        className="w-full px-3 py-2 glass bg-background/50 border border-border/50 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" 
                      />
                      <Button size="sm" className="w-fit mt-2" onClick={onSaveGeminiKey} disabled={!geminiKey || isGeminiKeySaving}>
                        {isGeminiKeySaving ? "Saving..." : "Save Gemini Key"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
