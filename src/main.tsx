import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App';
import { ToastProvider } from './ui/components/Toast';

// 開発用の検証ページ（?lab=video）。動画ライブラリはこのページを開いたときだけ読み込む
const VideoLab = lazy(() => import('./lab/VideoLab').then((m) => ({ default: m.VideoLab })));
const lab = new URLSearchParams(location.search).get('lab');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      {lab === 'video' ? (
        <Suspense fallback={<div className="busy"><div className="spinner" /></div>}>
          <VideoLab />
        </Suspense>
      ) : (
        <App />
      )}
    </ToastProvider>
  </StrictMode>,
);
