import { useEffect, useRef } from 'react';
import { messageText, type ChatMessage } from '../hooks/mergeMessages';
import { t } from '../i18n';

type MessageListProps = {
  messages: ChatMessage[];
  partial?: ChatMessage | null;
};

function roleClass(role: string): string {
  if (role === 'user') return 'msg msg-user';
  if (role === 'assistant') return 'msg msg-assistant';
  if (role === 'error') return 'msg msg-error';
  return 'msg msg-system';
}

function Bubble({ m, streaming }: { m: ChatMessage; streaming?: boolean }) {
  const text = messageText(m);
  return (
    <div className={roleClass(m.role)}>
      <div className={`bubble${streaming ? ' is-streaming' : ''}`}>
        {text || (streaming ? '' : '…')}
        {streaming ? <span className="cursor" aria-hidden /> : null}
        {m.stopped ? <span className="stopped-tag">{t('chat.stopped')}</span> : null}
      </div>
    </div>
  );
}

export function MessageList({ messages, partial }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partial?.content, partial?.turn_segs]);

  if (!messages.length && !partial) {
    return <div className="msg-empty">{t('chat.empty')}</div>;
  }

  return (
    <div className="msg-list">
      {messages.map((m) => (
        <Bubble key={m.id} m={m} />
      ))}
      {partial ? <Bubble m={partial} streaming /> : null}
      <div ref={bottomRef} />
    </div>
  );
}
