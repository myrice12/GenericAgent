import { FormEvent, useEffect, useState } from 'react';
import * as bridge from '../api/bridge';
import { t } from '../i18n';
import { findProviderPreset, type ProviderPreset } from './providerPresets';

export type ModelFormValues = {
  model: string;
  apikey: string;
  apibase: string;
  protocol: 'oai' | 'claude';
  stream: boolean;
  name: string;
  max_retries: string;
  connect_timeout: string;
  read_timeout: string;
};

const EMPTY: ModelFormValues = {
  model: '',
  apikey: '',
  apibase: '',
  protocol: 'oai',
  stream: true,
  name: '',
  max_retries: '5',
  connect_timeout: '15',
  read_timeout: '300',
};

type Props = {
  open: boolean;
  editId: number | null;
  providerKey: string | null;
  onClose: () => void;
  onSaved: (profiles: unknown[]) => void;
};

export function ModelFormModal({ open, editId, providerKey, onClose, onSaved }: Props) {
  const [form, setForm] = useState<ModelFormValues>(EMPTY);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [guide, setGuide] = useState<ProviderPreset | null>(null);
  const isEdit = editId != null;

  useEffect(() => {
    if (!open) return;
    setErr('');
    let cancelled = false;
    (async () => {
      if (isEdit && editId != null) {
        setGuide(null);
        try {
          const res = (await bridge.getModelProfile(editId)) as {
            profile?: Record<string, unknown> & { varName?: string };
          };
          const p = res.profile;
          if (!p || cancelled) return;
          const pv = /claude/i.test(String(p.varName || '')) ? 'claude' : 'oai';
          setForm({
            model: String(p.model ?? ''),
            apikey: '',
            apibase: String(p.apibase ?? ''),
            protocol: pv,
            stream: p.stream !== false,
            name: String(p.name ?? ''),
            max_retries: String(p.max_retries ?? 5),
            connect_timeout: String(p.connect_timeout ?? 15),
            read_timeout: String(p.read_timeout ?? 300),
          });
        } catch (e) {
          if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
        }
        return;
      }
      const preset = providerKey ? findProviderPreset(providerKey) : null;
      setGuide(preset ?? null);
      if (preset) {
        setForm({
          ...EMPTY,
          model: preset.model,
          apibase: preset.apibase,
          protocol: preset.protocol,
          name: preset.name,
        });
      } else {
        setForm(EMPTY);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, editId, isEdit, providerKey]);

  if (!open) return null;

  function setField<K extends keyof ModelFormValues>(key: K, value: ModelFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.apibase.trim() || !form.model.trim()) {
      setErr(t('err.modelRequired'));
      return;
    }
    if (!isEdit && !form.apikey.trim()) {
      setErr(t('err.modelRequired'));
      return;
    }
    setBusy(true);
    setErr('');
    const payload: Record<string, unknown> = {
      model: form.model.trim(),
      apibase: form.apibase.trim(),
      protocol: form.protocol,
      stream: String(form.stream),
      name: form.name.trim(),
      max_retries: form.max_retries,
      connect_timeout: form.connect_timeout,
      read_timeout: form.read_timeout,
    };
    if (form.apikey.trim()) payload.apikey = form.apikey.trim();
    try {
      const res = (isEdit && editId != null
        ? await bridge.updateModelProfile(editId, payload)
        : await bridge.addModelProfile(payload)) as {
        ok?: boolean;
        error?: string;
        profiles?: unknown[];
      };
      if (res?.ok === false || res?.error) throw new Error(res.error || t('err.modelSave'));
      onSaved(res.profiles ?? []);
      onClose();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : t('err.modelSave'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-root" role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div className="modal-title">{isEdit ? t('modal.editModel') : t('modal.addModel')}</div>
          <button type="button" className="modal-x" onClick={onClose} aria-label={t('common.close')}>
            ×
          </button>
        </div>
        <div className="modal-body">
          {guide ? (
            <div className="model-guide">
              <div className="model-guide-name">{guide.label}</div>
              <ol className="model-guide-steps">
                <li>{t('guide.step1')}</li>
                <li>{t('guide.step2')}</li>
                <li>{t('guide.step3')}</li>
              </ol>
              <a className="model-guide-link" href={guide.keyUrl} target="_blank" rel="noreferrer">
                {t('guide.getKey').replace('{name}', guide.label)}
              </a>
              <p className="model-guide-tip">{t('guide.prefillTip')}</p>
            </div>
          ) : null}
          <form className="model-form" onSubmit={onSubmit} autoComplete="off">
            <label>
              <span className="field-label">
                {t('model.model')} <span className="field-req">*</span>
              </span>
              <input
                value={form.model}
                onChange={(e) => setField('model', e.target.value)}
                placeholder={t('model.modelPh')}
                maxLength={50}
                required
              />
              <span className="field-hint">{t('model.modelHint')}</span>
            </label>
            <label>
              <span className="field-label">
                {t('model.apikey')} {!isEdit ? <span className="field-req">*</span> : null}
              </span>
              <input
                type="password"
                value={form.apikey}
                onChange={(e) => setField('apikey', e.target.value)}
                placeholder={isEdit ? t('model.apikeyKeep') : t('model.apikeyPh')}
                maxLength={200}
                required={!isEdit}
              />
            </label>
            <label>
              <span className="field-label">
                {t('model.apibase')} <span className="field-req">*</span>
              </span>
              <input
                value={form.apibase}
                onChange={(e) => setField('apibase', e.target.value)}
                placeholder={t('model.apibasePh')}
                maxLength={200}
                required
              />
            </label>
            <div className="model-form-field">
              <span className="field-label">
                {t('model.protocol')} <span className="field-req">*</span>
              </span>
              <div className="seg-group">
                <label className="seg-opt">
                  <input
                    type="radio"
                    name="protocol"
                    checked={form.protocol === 'oai'}
                    onChange={() => setField('protocol', 'oai')}
                  />
                  <span>{t('model.protocolOai')}</span>
                </label>
                <label className="seg-opt">
                  <input
                    type="radio"
                    name="protocol"
                    checked={form.protocol === 'claude'}
                    onChange={() => setField('protocol', 'claude')}
                  />
                  <span>{t('model.protocolClaude')}</span>
                </label>
              </div>
            </div>
            <div className="model-form-field">
              <span className="field-label">{t('model.stream')}</span>
              <div className="seg-group">
                <label className="seg-opt">
                  <input
                    type="radio"
                    name="stream"
                    checked={form.stream}
                    onChange={() => setField('stream', true)}
                  />
                  <span>{t('model.streamOn')}</span>
                </label>
                <label className="seg-opt">
                  <input
                    type="radio"
                    name="stream"
                    checked={!form.stream}
                    onChange={() => setField('stream', false)}
                  />
                  <span>{t('model.streamOff')}</span>
                </label>
              </div>
            </div>
            <label>
              <span className="field-label">{t('model.name')}</span>
              <input
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder={t('model.namePh')}
                maxLength={50}
              />
            </label>
            <div className="model-form-row">
              <label className="model-form-mini">
                <span>{t('model.retries')}</span>
                <input
                  value={form.max_retries}
                  onChange={(e) => setField('max_retries', e.target.value)}
                  inputMode="numeric"
                />
              </label>
              <label className="model-form-mini">
                <span>{t('model.connTimeout')}</span>
                <input
                  value={form.connect_timeout}
                  onChange={(e) => setField('connect_timeout', e.target.value)}
                  inputMode="numeric"
                />
              </label>
              <label className="model-form-mini">
                <span>{t('model.readTimeout')}</span>
                <input
                  value={form.read_timeout}
                  onChange={(e) => setField('read_timeout', e.target.value)}
                  inputMode="numeric"
                />
              </label>
            </div>
            {err ? <p className="model-form-err">{err}</p> : null}
            <div className="model-form-actions">
              <button type="button" className="set-btn ghost" onClick={onClose} disabled={busy}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="set-btn primary" disabled={busy}>
                {t('model.save')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
