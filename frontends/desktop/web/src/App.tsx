import { useState } from 'react';
import { Shell, type Page } from './layout/Shell';

export default function App() {
  const [page, setPage] = useState<Page>('chat');
  return (
    <Shell page={page} onNavigate={setPage}>
      {page === 'chat' && <div>聊天页占位</div>}
      {page === 'collab' && <div>指挥家占位</div>}
      {page === 'services' && <div>服务占位</div>}
      {page === 'token' && <div>用量占位</div>}
    </Shell>
  );
}
