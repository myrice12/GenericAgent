export const zh = {
  'brand.name': 'Generic Agent',
  'brand.sub': '本机智能体工作台',
  'nav.chat': '聊天',
  'nav.collab': '指挥家',
  'nav.services': '服务',
  'nav.token': '用量',
  'chat.placeholder': '输入消息…',
  'chat.send': '发送',
  'chat.stop': '强行停止',
  'chat.newSession': '新会话',
  'chat.sessions': '会话',
  'collab.placeholder': '请对指挥家描述你想完成的目标',
  'page.services.title': '服务',
  'page.token.title': '用量',
} as const;

export type ZhKey = keyof typeof zh;
