import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Stethoscope, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Msg = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  'Common uses of Amoxicillin?',
  'How do I dispense a medicine?',
  'Storage tips for insulin',
  'What does "critical" stock mean?',
];

const WELCOME: Msg = {
  role: 'assistant',
  content:
    "Hi 💙 I'm **MediTrack Assistant**, your clinic colleague. I can help with medicine info, clinical guidance, and how to use MediTrack. What's on your mind today?",
};

export function MediTrackChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const userMsg: Msg = { role: 'user', content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meditrack-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: next.filter((m) => m !== WELCOME).map(({ role, content }) => ({ role, content })),
          }),
        }
      );

      if (resp.status === 429) {
        toast.error('MediTrack is a bit busy — try again shortly 💙');
        setLoading(false);
        return;
      }
      if (resp.status === 402) {
        toast.error('AI credits exhausted. Add credits in Settings → Usage.');
        setLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error('Failed to start stream');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let assistantSoFar = '';
      let createdAssistant = false;
      let streamDone = false;

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          if (!createdAssistant) {
            createdAssistant = true;
            return [...prev, { role: 'assistant', content: assistantSoFar }];
          }
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
          );
        });
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, nl);
          textBuffer = textBuffer.slice(nl + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsert(content);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating launcher */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
        onClick={() => setOpen((v) => !v)}
        aria-label="Open MediTrack Assistant"
        className={cn(
          'fixed bottom-6 right-6 z-50 h-16 w-16 rounded-full',
          'bg-gradient-to-br from-primary via-primary to-accent',
          'shadow-xl shadow-primary/40 ring-4 ring-accent/20',
          'flex items-center justify-center text-primary-foreground',
          'hover:scale-110 transition-transform duration-200'
        )}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X className="h-6 w-6" />
            </motion.span>
          ) : (
            <motion.span key="msg" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} className="relative">
              <Stethoscope className="h-7 w-7" />
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-accent ring-2 ring-background animate-pulse-soft" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'fixed z-50 flex flex-col overflow-hidden',
              'bottom-24 right-4 sm:right-6',
              'w-[calc(100vw-2rem)] sm:w-[400px] h-[600px] max-h-[calc(100vh-8rem)]',
              'rounded-2xl border border-accent/30',
              'bg-card shadow-2xl shadow-primary/30',
              'backdrop-blur-xl'
            )}
          >
            {/* Header */}
            <div className="relative bg-gradient-to-br from-primary via-primary to-accent p-4 text-primary-foreground">
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, hsl(var(--accent)) 0%, transparent 50%)' }} />
              <div className="relative flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-foreground/15 backdrop-blur ring-1 ring-primary-foreground/20">
                  <Stethoscope className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-base leading-tight">MediTrack Assistant</h3>
                    <Sparkles className="h-3.5 w-3.5 text-accent-foreground/90" />
                  </div>
                  <p className="text-xs text-primary-foreground/80 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-soft" />
                    Your clinic colleague · Online
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 bg-gradient-to-b from-secondary/40 to-background" viewportRef={scrollRef}>
              <div className="p-4 space-y-4">
                {messages.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn('flex gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    {m.role === 'assistant' && (
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground shadow-md">
                        <Stethoscope className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm',
                        m.role === 'user'
                          ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-sm'
                          : 'bg-card border border-accent/20 text-card-foreground rounded-bl-sm'
                      )}
                    >
                      {m.role === 'assistant' ? (
                        <div className="prose prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-strong:text-primary dark:prose-invert">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      )}
                    </div>
                  </motion.div>
                ))}

                {loading && messages[messages.length - 1]?.role === 'user' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 justify-start">
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground shadow-md">
                      <Stethoscope className="h-4 w-4" />
                    </div>
                    <div className="bg-card border border-accent/20 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="h-2 w-2 rounded-full bg-accent"
                          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}

                {messages.length === 1 && !loading && (
                  <div className="pt-2 space-y-2">
                    <p className="text-xs text-muted-foreground font-medium px-1">Try asking:</p>
                    <div className="flex flex-wrap gap-2">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          onClick={() => send(s)}
                          className="text-xs px-3 py-1.5 rounded-full bg-card border border-accent/30 text-foreground hover:bg-accent hover:text-accent-foreground hover:border-accent transition-all shadow-sm"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="border-t border-accent/20 bg-card p-3 flex gap-2"
            >
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask MediTrack anything…"
                disabled={loading}
                className="flex-1 bg-secondary/50 border-accent/30 focus-visible:ring-accent rounded-full"
              />
              <Button
                type="submit"
                disabled={loading || !input.trim()}
                size="icon"
                className="rounded-full bg-gradient-to-br from-primary to-accent hover:opacity-90 shadow-md flex-shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <div className="px-3 pb-2 text-[10px] text-muted-foreground text-center">
              MediTrack Assistant · Not a substitute for a prescriber
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
