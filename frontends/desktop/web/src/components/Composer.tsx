import { useCallback, useState, type KeyboardEvent } from 'react';
import { t } from '../i18n';

type ComposerProps = {
  disabled?: boolean;
  placeholder?: string;
  onSend: (text: string) => void | Promise<void>;
};

export function Composer({ disabled, placeholder, onSend }: ComposerProps) {
  const [value, setValue] = useState('');

  const submit = useCallback(async () => {
    const text = value.trim();
    if (!text || disabled) return;
    setValue('');
    await onSend(text);
  }, [value, disabled, onSend]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="composer">
      <textarea
        className="composer-input"
        rows={3}
        value={value}
        disabled={disabled}
        placeholder={placeholder ?? t('chat.placeholder')}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        className="composer-send"
        disabled={disabled || !value.trim()}
        onClick={() => void submit()}
      >
        {t('chat.send')}
      </button>
    </div>
  );
}
