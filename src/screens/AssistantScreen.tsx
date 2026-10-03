import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useApp } from '@/lib/AppContext';
import { callEdgeFunction } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { Send, Plus, Bot, User, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import type { AIConversation, AIMessage } from '@/types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function AssistantScreen() {
  const { user } = useAuth();
  const { t, isRTL } = useApp();
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadConversations() {
      setLoadingConvs(true);
      const { data } = await supabase
        .from('ai_conversations')
        .select('*')
        .order('created_at', { ascending: false });
      setConversations(data || []);
      if (data && data.length > 0) {
        setActiveConvId(data[0].id);
      }
      setLoadingConvs(false);
    }
    loadConversations();
  }, []);

  useEffect(() => {
    async function loadMessages() {
      if (!activeConvId) {
        setMessages([]);
        return;
      }
      const { data } = await supabase
        .from('ai_messages')
        .select('*')
        .eq('conversation_id', activeConvId)
        .order('created_at', { ascending: true });
      if (data) {
        setMessages(data.map((m: AIMessage) => ({ role: m.role as 'user' | 'assistant', content: m.content })));
      }
    }
    loadMessages();
  }, [activeConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const data = await callEdgeFunction<{ response: string; conversationId: string }>('ai-assistant', {
        message: userMessage,
        conversationId: activeConvId,
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);
      if (data.conversationId !== activeConvId) {
        setActiveConvId(data.conversationId);
        const { data: newConv } = await supabase
          .from('ai_conversations')
          .select('*')
          .eq('id', data.conversationId)
          .single();
        if (newConv) {
          setConversations((prev) => [newConv as AIConversation, ...prev]);
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: t('error') }]);
    } finally {
      setLoading(false);
    }
  };

  const handleNewConversation = () => {
    setActiveConvId(null);
    setMessages([]);
  };

  const suggestions = [
    'ما المصطلحات الإنجليزية المناسبة للبحث عن القلق لدى طلاب الجامعة؟',
    'هل توجد فجوة بحثية في دراسة تأثير وسائل التواصل على الصحة النفسية؟',
    'كيف أحلل الاختلاف بين دراستين متعارضتين؟',
  ];

  return (
    <div className="min-h-screen pb-24 bg-neutral-50 dark:bg-neutral-950 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-900 px-5 pt-12 pb-3 border-b border-neutral-100 dark:border-neutral-800 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">{t('assistantTitle')}</h1>
          <button onClick={handleNewConversation} className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center active:scale-95 transition-all">
            <Plus className="w-5 h-5 text-primary-700 dark:text-primary-400" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 px-5 py-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        {messages.length === 0 && !loading && (
          <div className="animate-fade-in">
            <div className="flex flex-col items-center text-center py-8">
              <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mb-4">
                <Bot className="w-8 h-8 text-primary-700 dark:text-primary-400" />
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-xs">{t('assistantGreeting')}</p>
            </div>
            <div className="space-y-2 mt-4">
              <p className="text-xs font-medium text-neutral-500 mb-2">أسئلة مقترحة:</p>
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); }}
                  className="w-full card text-start text-sm text-neutral-700 dark:text-neutral-300 active:scale-[0.98] transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 animate-slide-up ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                msg.role === 'user'
                  ? 'bg-accent-50 dark:bg-accent-900/30'
                  : 'bg-primary-50 dark:bg-primary-900/30'
              }`}>
                {msg.role === 'user' ? (
                  <User className="w-4 h-4 text-accent-600 dark:text-accent-400" />
                ) : (
                  <Bot className="w-4 h-4 text-primary-700 dark:text-primary-400" />
                )}
              </div>
              <div className={`flex-1 rounded-2xl px-4 py-3 max-w-[80%] ${
                msg.role === 'user'
                  ? 'bg-accent-50 dark:bg-accent-900/20 text-neutral-800 dark:text-neutral-200'
                  : 'bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300'
              }`}>
                <p className="text-sm leading-relaxed whitespace-pre-line">{msg.content}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 animate-slide-up">
              <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary-700 dark:text-primary-400" />
              </div>
              <div className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-2xl px-4 py-3">
                <Loader2 className="w-4 h-4 text-primary-700 animate-spin" />
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="fixed bottom-16 inset-x-0 bg-white dark:bg-neutral-900 border-t border-neutral-100 dark:border-neutral-800 px-4 py-3 z-30">
        <div className="max-w-md mx-auto flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="input-field flex-1 resize-none min-h-[44px] max-h-[100px] text-sm"
            placeholder={t('assistantPlaceholder')}
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="w-11 h-11 rounded-xl bg-primary-700 flex items-center justify-center flex-shrink-0 active:scale-95 transition-all disabled:opacity-50"
          >
            <Send className={`w-5 h-5 text-white ${isRTL ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
