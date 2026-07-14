export type ProviderPreset = {
  key: string;
  label: string;
  protocol: 'oai' | 'claude';
  apibase: string;
  model: string;
  name: string;
  keyUrl: string;
};

/** Matches static/app.js PROVIDER_PRESETS (DeepSeek / 通义千问). */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    key: 'deepseek',
    label: 'DeepSeek',
    protocol: 'oai',
    apibase: 'https://api.deepseek.com/v1',
    model: 'deepseek-v4-pro',
    name: 'DeepSeek',
    keyUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    key: 'qwen',
    label: '通义千问',
    protocol: 'oai',
    apibase: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3.6-max-preview',
    name: '通义千问',
    keyUrl: 'https://bailian.console.aliyun.com/?apiKey=1',
  },
];

export function findProviderPreset(key: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.key === key);
}
