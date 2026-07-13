import { useState, type ReactNode } from 'react';
import { Shell, type Page } from './layout/Shell';
import { ChatPage } from './pages/ChatPage';

export default function App() {
  const [page, setPage] = useState<Page>('chat');
  const [rail, setRail] = useState<ReactNode | null>(null);

  return (
    <Shell
      page={page}
      onNavigate={(p) => {
        setPage(p);
        if (p !== 'chat') setRail(null);
      }}
      rail={page === 'chat' ? rail : undefined}
    >
      {page === 'chat' && <ChatPage setRail={setRail} />}
      {page === 'collab' && <div>指挥家占位</div>}
      {page === 'services' && <div>服务占位</div>}
      {page === 'token' && <div>用量占位</div>}
    </Shell>
  );
}
