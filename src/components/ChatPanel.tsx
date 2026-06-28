import { useState, useRef, useEffect } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../hooks/useAuth";
import { useScope } from "../hooks/useScope";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function sanitizeChatText(text: string): string {
  return text
    .replace(/<\/?pad>/gi, "")
    .replace(/<pad>/gi, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function ChatPanel({ onClose }: { onClose: () => void }) {
  const { token } = useAuth();
  const { scope } = useScope();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const chatAction = useAction(api.ai.chatWithAI as any);
  const createSession = useMutation(api.chat.createSession);
  const addMessage = useMutation(api.chat.addMessage);
  const getLatestSession = useQuery(api.chat.getLatestSession);
  const savedMessages = useQuery(
    api.chat.getMessages,
    sessionId ? ({ sessionId } as any) : "skip"
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialized) return;
    if (getLatestSession === undefined) return;
    const init = async () => {
      if (getLatestSession) {
        setSessionId(getLatestSession._id);
      } else {
        const id = await createSession();
        setSessionId(id);
      }
      setInitialized(true);
    };
    init();
  }, [getLatestSession, createSession, initialized]);

  useEffect(() => {
    if (savedMessages && savedMessages.length > 0) {
      setMessages(savedMessages.map((m: any) => ({ role: m.role, content: sanitizeChatText(m.content) })));
    } else if (initialized && savedMessages && savedMessages.length === 0) {
      setMessages([
        { role: "assistant", content: "¡Hola! Soy tu asistente pastoral virtual. Pregúntame lo que necesites sobre el ministerio.\n\nEjemplos:\n• ¿Quiénes tienen riesgo alto?\n• ¿Cuántos adolescentes faltan seguido?\n• ¿Qué vulnerabilidades son más comunes?\n• ¿Quiénes no han sido contactados?" },
      ]);
    }
  }, [savedMessages, initialized]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending || !sessionId) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: userMsg }]);
    setSending(true);

    try {
      await addMessage({ sessionId: sessionId as any, role: "user", content: userMsg });
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const result = await chatAction({
        question: userMsg,
        token: token ?? undefined,
        activeScope: {
          campusId: scope.campusId,
          ministryId: scope.ministryId,
          groupId: scope.groupId,
        },
        conversationHistory: history,
      }) as any;
      if (result.success) {
        const cleanAnswer = sanitizeChatText(result.answer || "");
        setMessages((m) => [...m, { role: "assistant", content: cleanAnswer }]);
        await addMessage({ sessionId: sessionId as any, role: "assistant", content: cleanAnswer });
      } else {
        const errMsg = "Lo siento, no pude procesar tu pregunta. Intenta de nuevo.";
        setMessages((m) => [...m, { role: "assistant", content: errMsg }]);
        await addMessage({ sessionId: sessionId as any, role: "assistant", content: errMsg });
      }
    } catch {
      const errMsg = "Error de conexión. Intenta de nuevo.";
      setMessages((m) => [...m, { role: "assistant", content: errMsg }]);
      if (sessionId) {
        await addMessage({ sessionId: sessionId as any, role: "assistant", content: errMsg });
      }
    }
    setSending(false);
  };

  return (
    <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-4 right-4 sm:left-auto sm:right-6 lg:bottom-6 sm:w-[360px] z-50">
      <div className="bg-white border border-ink/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[min(32rem,calc(100vh-7rem-env(safe-area-inset-bottom)))] sm:max-h-[500px]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-ink/5 bg-teal-50">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z" />
              <path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14z" />
              <path d="M6 14l.8 2.2L9 17l-2.2.8L6 20l-.8-2.2L3 17l2.2-.8L6 14z" />
            </svg>
            <span className="text-sm font-bold text-teal-800">Asistente Pastoral</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-ink/40 hover:text-ink hover:bg-ink/5 transition">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px] max-h-[calc(100vh-14rem-env(safe-area-inset-bottom))] sm:max-h-[350px]">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
                msg.role === "user" ? "bg-teal-600 text-white rounded-br-md" : "bg-ink/5 text-ink/80 rounded-bl-md"
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-ink/5 rounded-xl px-3.5 py-2.5 text-sm text-ink/50">
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 bg-ink/30 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-ink/30 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-ink/30 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="px-4 py-3 border-t border-ink/5">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Escribe tu pregunta..."
              className="flex-1 bg-ink/[0.03] border border-ink/10 rounded-xl px-3.5 py-2.5 text-sm placeholder:text-ink/30"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="shrink-0 w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center hover:bg-teal-700 disabled:opacity-40 transition"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
