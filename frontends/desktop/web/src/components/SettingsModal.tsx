import { useCallback, useEffect, useRef, useState } from 'react';
import * as bridge from '../api/bridge';
import { t } from '../i18n';

export type ModelProfile = {
  id: number;
  varName?: string;
  kind?: string;
  name?: string;
  model?: string;
  members?: string[];
  inMixin?: boolean;
  active?: boolean;
  group?: string;
};

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
  onNavigateServices?: () => void;
  onProfilesChanged?: (profiles: ModelProfile[]) => void;
};

type ModelForm = {
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

const EMPTY_FORM: ModelForm = {
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

const PRESETS: Record<
  string,
  { model: string; apibase: string; protocol: 'oai' | 'claude'; name: string }
> = {
  deepseek: {
    model: 'deepseek-v4-pro',
    apibase: 'https://api.deepseek.com/v1',
    protocol: 'oai',
    name: 'DeepSeek',
  },
  qwen: {
    model: 'qwen3.6-max-preview',
    apibase: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    protocol: 'oai',
    name: '通义千问',
  },
};

function profileLabel(p: ModelProfile) {
  if (p.kind === 'mixin') return t('model.aggregation');
  return p.name || p.model || `#${p.id}`;
}

export function SettingsModal({
  open,
  onClose,
  onNavigateServices,
  onProfilesChanged,
}: SettingsModalProps) {
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [mixinExpanded, setMixinExpanded] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ModelForm>(EMPTY_FORM);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [mykeyOpen, setMykeyOpen] = useState(false);
  const [mykeyText, setMykeyText] = useState('');
  const [mykeyPath, setMykeyPath] = useState('');
  const [mykeyErr, setMykeyErr] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const publish = useCallback(
    (list: ModelProfile[]) => {
      setProfiles(list);
      onProfilesChanged?.(list);
    },
    [onProfilesChanged],
  );

  const refresh = useCallback(async () => {
    try {
      const data = (await bridge.listModelProfiles()) as {
        profiles?: ModelProfile[];
      };
      publish(data.profiles ?? []);
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : String(e));
    }
  }, [publish]);

  useEffect(() => {
    if (!open) return;
    void refresh();
    setFormOpen(false);
    setMykeyOpen(false);
    setToast(null);
  }, [open, refresh]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(id);
  }, [toast]);

  if (!open) return null;

  const mixin = profiles.find((p) => p.kind === 'mixin');
  const natives = profiles.filter((p) => p.kind !== 'mixin');
  const byName = new Map(natives.map((p) => [p.name, p]));

  const openAdd = (preset?: keyof typeof PRESETS) => {
    setEditingId(null);
    setFormErr(null);
    if (preset && PRESETS[preset]) {
      const p = PRESETS[preset];
      setForm({ ...EMPTY_FORM, ...p });
    } else {
      setForm(EMPTY_FORM);
    }
    setFormOpen(true);
  };

  const openEdit = async (id: number) => {
    setFormErr(null);
    try {
      const res = (await bridge.getModelProfile(id)) as {
        profile?: Record<string, unknown>;
        error?: string;
      };
      const p = res.profile;
      if (!p) throw new Error(res.error || t('err.modelSave'));
      const varName = String(p.varName ?? '');
      setEditingId(id);
      setForm({
        model: String(p.model ?? ''),
        apikey: '',
        apibase: String(p.apibase ?? ''),
        protocol: /claude/i.test(varName) ? 'claude' : 'oai',
        stream: p.stream !== false,
        name: String(p.name ?? ''),
        max_retries: String(p.max_retries ?? 5),
        connect_timeout: String(p.connect_timeout ?? 15),
        read_timeout: String(p.read_timeout ?? 300),
      });
      setFormOpen(true);
    } catch (e) {
      setToast(e instanceof Error ? e.message : t('err.modelSave'));
    }
  };

  const saveForm = async () => {
    if (!form.apibase.trim() || !form.model.trim()) {
      setFormErr(t('err.modelRequired'));
      return;
    }
    if (editingId == null && !form.apikey.trim()) {
      setFormErr(t('err.modelRequired'));
      return;
    }
    setSaving(true);
    setFormErr(null);
    const payload: Record<string, unknown> = {
      model: form.model.trim(),
      apibase: form.apibase.trim(),
      protocol: form.protocol,
      stream: form.stream,
      name: form.name.trim(),
      max_retries: Number(form.max_retries) || 5,
      connect_timeout: Number(form.connect_timeout) || 15,
      read_timeout: Number(form.read_timeout) || 300,
    };
    if (form.apikey.trim()) payload.apikey = form.apikey.trim();
    try {
      const res = (
        editingId != null
          ? await bridge.updateModelProfile(editingId, payload)
          : await bridge.addModelProfile(payload)
      ) as {
        ok?: boolean;
        error?: string;
        profiles?: ModelProfile[];
      };
      if (res.ok === false || res.error) {
        throw new Error(res.error || t('err.modelSave'));
      }
      publish(res.profiles ?? []);
      setFormOpen(false);
      setToast(t('sys.configSaved'));
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : t('err.modelSave'));
    } finally {
      setSaving(false);
    }
  };

  const deleteModel = async (id: number, name?: string) => {
    const label = name || `#${id}`;
    if (!window.confirm(`${t('confirm.modelDelete')}\n${label}`)) return;
    try {
      const res = (await bridge.deleteModelProfile(id)) as {
        ok?: boolean;
        error?: string;
        profiles?: ModelProfile[];
      };
      if (res.ok === false || res.error) {
        throw new Error(res.error || t('err.modelDelete'));
      }
      publish(res.profiles ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setToast(
        msg.includes('last profile') ? t('err.modelDeleteLast') : msg || t('err.modelDelete'),
      );
    }
  };

  const mixAdd = async (id: number, already: boolean) => {
    if (already) {
      setToast(t('model.alreadyInMixin'));
      return;
    }
    try {
      const res = (await bridge.addToMixin(id)) as {
        ok?: boolean;
        error?: string;
        profiles?: ModelProfile[];
      };
      if (res.ok === false || res.error) throw new Error(res.error || t('err.mixinFailed'));
      publish(res.profiles ?? []);
    } catch (e) {
      setToast(e instanceof Error ? e.message : t('err.mixinFailed'));
    }
  };

  const mixRemove = async (id: number) => {
    try {
      const res = (await bridge.removeFromMixin(id)) as {
        ok?: boolean;
        error?: string;
        profiles?: ModelProfile[];
      };
      if (res.ok === false || res.error) throw new Error(res.error || t('err.mixinFailed'));
      publish(res.profiles ?? []);
    } catch (e) {
      setToast(e instanceof Error ? e.message : t('err.mixinFailed'));
    }
  };

  const openMykeyEditor = async () => {
    setMykeyErr(null);
    try {
      const res = await bridge.getMykey();
      setMykeyText(res.content ?? '');
      setMykeyPath(res.path ?? '');
      setMykeyOpen(true);
    } catch (e) {
      setToast(e instanceof Error ? e.message : t('err.mykeySave'));
    }
  };

  const saveMykeyEditor = async () => {
    setMykeyErr(null);
    try {
      const res = (await bridge.saveMykey(mykeyText)) as {
        ok?: boolean;
        error?: string;
        profiles?: ModelProfile[];
      };
      if (res.ok === false || res.error) throw new Error(res.error || t('err.mykeySave'));
      if (res.profiles) publish(res.profiles);
      else await refresh();
      setMykeyOpen(false);
      setToast(t('sys.mykeySaved'));
    } catch (e) {
      setMykeyErr(e instanceof Error ? e.message : t('err.mykeySave'));
    }
  };

  const onImportFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      if (!text.trim()) throw new Error(t('err.mykeyImport'));
      const res = (await bridge.saveMykey(text)) as {
        ok?: boolean;
        error?: string;
        profiles?: ModelProfile[];
      };
      if (res.ok === false || res.error) throw new Error(res.error || t('err.mykeyImport'));
      if (res.profiles) publish(res.profiles);
      else await refresh();
      setToast(t('sys.mykeyImported'));
    } catch (e) {
      setToast(e instanceof Error ? e.message : t('err.mykeyImport'));
    }
  };

  const onExport = async () => {
    try {
      const res = await bridge.getMykey();
      const content = res.content ?? '';
      if (!content.trim()) throw new Error(t('err.mykeyExport'));
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mykey.py';
      a.click();
      URL.revokeObjectURL(url);
      setToast(t('sys.mykeyExported'));
    } catch (e) {
      setToast(e instanceof Error ? e.message : t('err.mykeyExport'));
    }
  };

  return (
    <div className="modal-root" role="presentation">
      <button type="button" className="modal-backdrop" aria-label={t('common.close')} onClick={onClose} />
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={t('modal.settings')}>
        <div className="modal-head">
          <div className="modal-title">{t('modal.settings')}</div>
          <button type="button" className="modal-x" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body set-body">
          {toast ? <div className="set-toast">{toast}</div> : null}
          {loadErr ? <div className="set-err">{loadErr}</div> : null}

          <div className="set-block">
            <div className="set-sec-t">{t('set.model')}</div>
            <div className="model-list">
              {mixin ? (
                <div className="model-group">
                  <div className="model-row model-row--mixin">
                    <button
                      type="button"
                      className="model-mixin-caret"
                      onClick={() => setMixinExpanded((v) => !v)}
                    >
                      {mixinExpanded ? '▾' : '▸'}
                    </button>
                    <span className="model-row-name">{t('model.aggregation')}</span>
                  </div>
                  {mixinExpanded ? (
                    <div className="model-mixin-body">
                      {(mixin.members ?? []).length === 0 ? (
                        <div className="model-mixin-empty">{t('model.emptyMixin')}</div>
                      ) : (
                        (mixin.members ?? []).map((mName) => {
                          const mp = byName.get(mName);
                          return (
                            <div key={mName} className="model-member">
                              <span className="model-member-name">
                                {mp ? profileLabel(mp) : mName}
                              </span>
                              {mp ? (
                                <button
                                  type="button"
                                  className="model-act"
                                  title={t('model.removeFromMixin')}
                                  onClick={() => void mixRemove(mp.id)}
                                >
                                  ×
                                </button>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {natives.length === 0 ? (
                <div className="set-empty">{t('set.noModels')}</div>
              ) : (
                natives.map((p) => (
                  <div key={p.id} className="model-row">
                    <span className="model-row-name">{profileLabel(p)}</span>
                    <span className="model-row-actions">
                      {mixin ? (
                        <button
                          type="button"
                          className={`model-act${p.inMixin ? ' is-in' : ''}`}
                          title={p.inMixin ? t('model.alreadyInMixin') : t('model.addToMixin')}
                          onClick={() => void mixAdd(p.id, !!p.inMixin)}
                        >
                          ＋
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="model-act"
                        title={t('common.edit')}
                        onClick={() => void openEdit(p.id)}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="model-act model-act-del"
                        title={t('common.delete')}
                        onClick={() => void deleteModel(p.id, p.name)}
                      >
                        ×
                      </button>
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="set-presets">
              <button type="button" className="set-btn ghost" onClick={() => openAdd('deepseek')}>
                {t('model.presetDeepseek')}
              </button>
              <button type="button" className="set-btn ghost" onClick={() => openAdd('qwen')}>
                {t('model.presetQwen')}
              </button>
            </div>
            <button type="button" className="set-btn" onClick={() => openAdd()}>
              ＋ {t('set.addModel')}
            </button>
          </div>

          <div className="set-block">
            <div className="set-sec-t">{t('set.features')}</div>
            <button type="button" className="set-btn" onClick={() => fileRef.current?.click()}>
              {t('set.importMykey')}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".py,text/plain"
              hidden
              onChange={(e) => {
                void onImportFile(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
            <button type="button" className="set-btn set-btn-follow" onClick={() => void onExport()}>
              {t('set.exportMykey')}
            </button>
            <button
              type="button"
              className="set-btn set-btn-follow"
              onClick={() => void openMykeyEditor()}
            >
              {t('set.editMykey')}
            </button>
            {onNavigateServices ? (
              <button
                type="button"
                className="set-btn set-btn-follow"
                onClick={() => {
                  onClose();
                  onNavigateServices();
                }}
              >
                {t('set.serviceManager')}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {formOpen ? (
        <div className="modal-root modal-root--nested" role="presentation">
          <button
            type="button"
            className="modal-backdrop"
            aria-label={t('common.close')}
            onClick={() => setFormOpen(false)}
          />
          <div className="modal-card" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div className="modal-title">
                {editingId != null ? t('modal.editModel') : t('modal.addModel')}
              </div>
              <button type="button" className="modal-x" onClick={() => setFormOpen(false)}>
                ×
              </button>
            </div>
            <div className="modal-body model-form-body">
              <label className="mf-field">
                <span className="field-label">
                  {t('model.model')} <span className="field-req">*</span>
                </span>
                <input
                  value={form.model}
                  onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                  placeholder={t('model.modelPh')}
                  maxLength={50}
                />
                <span className="field-hint">{t('model.modelHint')}</span>
              </label>
              <label className="mf-field">
                <span className="field-label">
                  {t('model.apikey')}{' '}
                  {editingId == null ? <span className="field-req">*</span> : null}
                </span>
                <input
                  type="password"
                  value={form.apikey}
                  onChange={(e) => setForm((f) => ({ ...f, apikey: e.target.value }))}
                  placeholder={editingId != null ? t('model.apikeyKeep') : t('model.apikeyPh')}
                  maxLength={200}
                  autoComplete="off"
                />
              </label>
              <label className="mf-field">
                <span className="field-label">
                  {t('model.apibase')} <span className="field-req">*</span>
                </span>
                <input
                  value={form.apibase}
                  onChange={(e) => setForm((f) => ({ ...f, apibase: e.target.value }))}
                  placeholder={t('model.apibasePh')}
                  maxLength={200}
                />
              </label>
              <div className="mf-field">
                <span className="field-label">
                  {t('model.protocol')} <span className="field-req">*</span>
                </span>
                <div className="seg-group">
                  <label className="seg-opt">
                    <input
                      type="radio"
                      name="protocol"
                      checked={form.protocol === 'oai'}
                      onChange={() => setForm((f) => ({ ...f, protocol: 'oai' }))}
                    />
                    <span>{t('model.protocolOai')}</span>
                  </label>
                  <label className="seg-opt">
                    <input
                      type="radio"
                      name="protocol"
                      checked={form.protocol === 'claude'}
                      onChange={() => setForm((f) => ({ ...f, protocol: 'claude' }))}
                    />
                    <span>{t('model.protocolClaude')}</span>
                  </label>
                </div>
              </div>
              <div className="mf-field">
                <span className="field-label">{t('model.stream')}</span>
                <div className="seg-group">
                  <label className="seg-opt">
                    <input
                      type="radio"
                      name="stream"
                      checked={form.stream}
                      onChange={() => setForm((f) => ({ ...f, stream: true }))}
                    />
                    <span>{t('model.streamOn')}</span>
                  </label>
                  <label className="seg-opt">
                    <input
                      type="radio"
                      name="stream"
                      checked={!form.stream}
                      onChange={() => setForm((f) => ({ ...f, stream: false }))}
                    />
                    <span>{t('model.streamOff')}</span>
                  </label>
                </div>
              </div>
              <label className="mf-field">
                <span className="field-label">{t('model.name')}</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t('model.namePh')}
                  maxLength={50}
                />
              </label>
              <div className="model-form-row">
                <label className="model-form-mini">
                  <span>{t('model.retries')}</span>
                  <input
                    value={form.max_retries}
                    onChange={(e) => setForm((f) => ({ ...f, max_retries: e.target.value }))}
                    inputMode="numeric"
                  />
                </label>
                <label className="model-form-mini">
                  <span>{t('model.connTimeout')}</span>
                  <input
                    value={form.connect_timeout}
                    onChange={(e) => setForm((f) => ({ ...f, connect_timeout: e.target.value }))}
                    inputMode="numeric"
                  />
                </label>
                <label className="model-form-mini">
                  <span>{t('model.readTimeout')}</span>
                  <input
                    value={form.read_timeout}
                    onChange={(e) => setForm((f) => ({ ...f, read_timeout: e.target.value }))}
                    inputMode="numeric"
                  />
                </label>
              </div>
              {formErr ? <p className="model-form-err">{formErr}</p> : null}
              <div className="model-form-actions">
                <button type="button" className="set-btn ghost" onClick={() => setFormOpen(false)}>
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="set-btn primary"
                  disabled={saving}
                  onClick={() => void saveForm()}
                >
                  {t('model.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {mykeyOpen ? (
        <div className="modal-root modal-root--nested" role="presentation">
          <button
            type="button"
            className="modal-backdrop"
            aria-label={t('common.close')}
            onClick={() => setMykeyOpen(false)}
          />
          <div className="modal-card modal-card-wide" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div className="modal-title">{t('modal.mykeyConfig')}</div>
              <button type="button" className="modal-x" onClick={() => setMykeyOpen(false)}>
                ×
              </button>
            </div>
            <div className="modal-body chan-config-body">
              {mykeyPath ? <div className="mykey-path">{mykeyPath}</div> : null}
              <textarea
                className="mykey-editor"
                spellCheck={false}
                value={mykeyText}
                onChange={(e) => setMykeyText(e.target.value)}
                maxLength={1_000_000}
              />
              {mykeyErr ? <p className="model-form-err">{mykeyErr}</p> : null}
              <div className="chan-config-foot">
                <button type="button" className="set-btn primary" onClick={() => void saveMykeyEditor()}>
                  {t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
