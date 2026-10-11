import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_VIDEO_SECONDS, PHOTO_DRAFT_ID } from './config';
import { createHistory, pushHistory, redoHistory, undoHistory, type HistoryState } from './core/history/history';
import { loadFontFaces } from './core/fonts/fonts';
import { createDoc, normalizeDoc, todayString } from './core/model/doc';
import type { PhotoDoc } from './core/model/types';
import { loadPhoto, type LoadedPhoto } from './core/render/photoSource';
import { releaseCanvas } from './core/util/canvas';
import { readExifDate } from './core/util/exif';
import { platform, type PickedFile } from './platform';
import { exportPhoto, type PhotoExportOptions } from './core/export/exportPhoto';
import type { VideoMedia, VideoPlayer } from './core/video/videoPlayer';
import { autoVideoLayout, createVideoSettings } from './core/video/videoLayout';
import { AboutSheet } from './ui/screens/AboutSheet';
import { ExportSheet } from './ui/editor/ExportSheet';
import { PreviewScreen, type ExportedMedia } from './ui/screens/PreviewScreen';
import { EditorScreen } from './ui/editor/EditorScreen';
import { HomeScreen, type DraftSummary } from './ui/screens/HomeScreen';
import { useToast } from './ui/components/Toast';

interface PhotoSession {
  kind: 'photo';
  draftId: string;
  photo: LoadedPhoto;
  history: HistoryState<PhotoDoc>;
}

interface VideoSession {
  kind: 'video';
  media: VideoMedia;
  player: VideoPlayer;
  history: HistoryState<PhotoDoc>;
}

type Session = PhotoSession | VideoSession;

function releaseSession(s: Session) {
  if (s.kind === 'photo') releaseCanvas(s.photo.canvas);
  else {
    s.player.dispose();
    s.media.dispose();
  }
}

/** 書き出しの間、画面が消えないようにする（対応している端末だけ） */
async function keepScreenOn(): Promise<() => void> {
  try {
    const lock = await (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen');
    return () => void lock?.release().catch(() => {});
  } catch {
    return () => {};
  }
}

type Screen = 'home' | 'editor' | 'preview';

async function photoDateOf(file: PickedFile): Promise<string> {
  const exif = await readExifDate(file.blob);
  if (exif) return exif;
  if (file.lastModified) return todayString(new Date(file.lastModified));
  return todayString();
}

export default function App() {
  const toast = useToast();
  const [screen, setScreen] = useState<Screen>('home');
  const [session, setSession] = useState<Session | null>(null);
  const [videoProgress, setVideoProgress] = useState<{ done: number; total: number } | null>(null);
  const exportSignal = useRef({ cancelled: false });
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftSummary | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [exportOpts, setExportOpts] = useState<PhotoExportOptions>({ format: 'jpeg', quality: 'high' });
  const [showExport, setShowExport] = useState(false);
  const [exported, setExported] = useState<ExportedMedia | null>(null);

  // ---- 下書き ----
  const refreshDraft = useCallback(async () => {
    try {
      const d = await platform.drafts.load(PHOTO_DRAFT_ID);
      setDraft((old) => {
        if (old) URL.revokeObjectURL(old.thumbUrl);
        return d ? { updatedAt: d.updatedAt, thumbUrl: URL.createObjectURL(d.source) } : null;
      });
    } catch {
      setDraft(null);
    }
  }, []);

  useEffect(() => {
    void refreshDraft();
    // 文字入れ用フォントの定義（CSS）は、最初の表示を軽くするため後から読み込む
    void loadFontFaces();
  }, [refreshDraft]);

  // 編集内容は少し待ってから自動で下書きに保存する
  const doc = session?.history.present ?? null;
  const photoDraftId = session?.kind === 'photo' ? session.draftId : null;
  useEffect(() => {
    // 動画の下書き保存はまだ対応していない（動画ファイルが大きいため）
    if (!photoDraftId || !doc) return;
    const id = window.setTimeout(() => {
      platform.drafts.saveDoc(photoDraftId, 'photo', doc).catch(() => {
        /* 保存できなくても編集は続けられる */
      });
    }, 700);
    return () => window.clearTimeout(id);
  }, [doc, photoDraftId]);

  const replaceSession = (next: Session | null) => {
    setSession((old) => {
      if (old && old !== next) releaseSession(old);
      return next;
    });
  };

  // ---- 写真の読み込み ----
  const startWithFile = async (file: PickedFile) => {
    setBusy('写真を読み込んでいます…');
    try {
      const [photo, date] = await Promise.all([loadPhoto(file.blob), photoDateOf(file)]);
      const newDoc = createDoc(date);
      replaceSession({ kind: 'photo', draftId: PHOTO_DRAFT_ID, photo, history: createHistory(newDoc) });
      setScreen('editor');
      await platform.drafts.saveSource(PHOTO_DRAFT_ID, file.blob, file.name).catch(() => {});
      await platform.drafts.saveDoc(PHOTO_DRAFT_ID, 'photo', newDoc).catch(() => {});
    } catch (e) {
      toast(e instanceof Error ? e.message : '写真を読み込めませんでした');
    } finally {
      setBusy(null);
    }
  };

  // ---- 動画の読み込み ----
  const startWithVideo = async (file: PickedFile) => {
    setBusy('動画を読み込んでいます…');
    try {
      // 動画の処理（Mediabunny）は、動画を選んだときだけ読み込む
      const mod = await import('./core/video/videoPlayer');
      if (!mod.videoSupported()) {
        throw new Error('このブラウザは動画の加工に対応していません。iPhone は iOS 16.4 以降、Android は最新の Chrome でお試しください。');
      }
      const media = await mod.VideoMedia.open(file.blob);
      const info = media.info;
      if (!info.canDecodeVideo) {
        media.dispose();
        throw new Error('この端末では、この動画の形式を読み込めません。');
      }
      const newDoc = createDoc(file.lastModified ? todayString(new Date(file.lastModified)) : todayString());
      // フレームの形・動画の形・使う範囲は、元の動画に合わせて自動で決める（あとから変えられる）
      newDoc.frame = { ...newDoc.frame, shapeId: autoVideoLayout(info.width, info.height).shapeId };
      newDoc.video = createVideoSettings(info.width, info.height, info.duration);
      const player = new mod.VideoPlayer(media);
      replaceSession({ kind: 'video', media, player, history: createHistory(newDoc) });
      setScreen('editor');
      if (info.duration > MAX_VIDEO_SECONDS) {
        toast(`動画が${MAX_VIDEO_SECONDS}秒より長いので、最初の${MAX_VIDEO_SECONDS}秒を使います。「長さ」で使う部分を選べます。`, 6000);
      } else if (info.hasAudio && !info.audioIsAac) {
        toast('この動画の音は形式が対応していないため、書き出した動画には音が入りません。', 6000);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : '動画を読み込めませんでした');
    } finally {
      setBusy(null);
    }
  };

  const pickVideo = () => {
    platform.media.pickVideo('library').then((file) => {
      if (file) void startWithVideo(file);
    });
  };

  const pick = (source: 'camera' | 'library') => {
    // iOS ではボタンを押した直後に呼ぶ必要があるので、ここでは await を挟まずに呼ぶ
    platform.media.pickImage(source).then((file) => {
      if (file) void startWithFile(file);
    });
  };

  const resume = async () => {
    setBusy('下書きを開いています…');
    try {
      const d = await platform.drafts.load(PHOTO_DRAFT_ID);
      const restored = d ? normalizeDoc(d.doc) : null;
      if (!d || !restored) throw new Error('下書きを開けませんでした');
      const photo = await loadPhoto(d.source);
      replaceSession({ kind: 'photo', draftId: d.id, photo, history: createHistory(restored) });
      setScreen('editor');
    } catch (e) {
      toast(e instanceof Error ? e.message : '下書きを開けませんでした');
    } finally {
      setBusy(null);
    }
  };

  const deleteDraft = async () => {
    await platform.drafts.remove(PHOTO_DRAFT_ID).catch(() => {});
    await refreshDraft();
  };

  const goHome = async () => {
    if (session?.kind === 'photo' && doc) await platform.drafts.saveDoc(session.draftId, 'photo', doc).catch(() => {});
    replaceSession(null);
    setScreen('home');
    void refreshDraft();
  };

  const changePhoto = () => {
    platform.media.pickImage('library').then(async (file) => {
      if (!file || session?.kind !== 'photo') return;
      setBusy('写真を読み込んでいます…');
      try {
        const photo = await loadPhoto(file.blob);
        const draftId = session.draftId;
        setSession((s) => {
          if (!s || s.kind !== 'photo') return s;
          releaseCanvas(s.photo.canvas);
          const nextDoc: PhotoDoc = { ...s.history.present, photo: { x: 0, y: 0, scale: 1, rotation: 0, flipX: false } };
          return { ...s, photo, history: pushHistory(s.history, nextDoc, null, performance.now()) };
        });
        await platform.drafts.saveSource(draftId, file.blob, file.name).catch(() => {});
      } catch (e) {
        toast(e instanceof Error ? e.message : '写真を読み込めませんでした');
      } finally {
        setBusy(null);
      }
    });
  };

  // ---- 書き出し ----
  const runExport = async (opts: PhotoExportOptions) => {
    if (session?.kind !== 'photo' || !doc) return;
    setShowExport(false);
    setExportOpts(opts);
    setBusy('書き出しています…');
    // 表示を更新してから重い処理を始める
    await new Promise((r) => setTimeout(r, 50));
    try {
      const r = await exportPhoto(doc, session.photo, opts);
      setExported({ file: { blob: r.blob, filename: r.filename, mimeType: r.mimeType }, width: r.width, height: r.height });
      setScreen('preview');
    } catch (e) {
      toast(e instanceof Error ? e.message : '書き出しに失敗しました');
    } finally {
      setBusy(null);
    }
  };

  const runVideoExport = async () => {
    if (session?.kind !== 'video' || !doc) return;
    const signal = { cancelled: false };
    exportSignal.current = signal;
    setVideoProgress({ done: 0, total: 1 });
    const release = await keepScreenOn();
    try {
      const { exportVideo, VideoExportCancelled } = await import('./core/export/exportVideo');
      try {
        const r = await exportVideo(session.media.file, doc, { signal, onProgress: (p) => setVideoProgress(p) });
        setExported({ file: { blob: r.blob, filename: r.filename, mimeType: r.mimeType }, width: r.width, height: r.height });
        setScreen('preview');
        if (!r.hasAudio && session.media.info.hasAudio) toast('元の動画の音の形式に対応していないため、音は入っていません。', 5000);
      } catch (e) {
        if (e instanceof VideoExportCancelled) toast('書き出しをキャンセルしました');
        else throw e;
      }
    } catch (e) {
      toast(e instanceof Error ? `書き出しに失敗しました：${e.message}` : '書き出しに失敗しました');
    } finally {
      release();
      setVideoProgress(null);
    }
  };

  /** 書き出したデータを捨てて、編集内容はそのまま編集画面に戻る */
  const backToEdit = () => {
    setExported(null);
    setScreen('editor');
  };

  // ---- 編集（元に戻す・やり直し） ----
  const apply = useCallback((fn: (d: PhotoDoc) => PhotoDoc, mergeKey?: string) => {
    setSession((s) => (s ? { ...s, history: pushHistory(s.history, fn(s.history.present), mergeKey ?? null, performance.now()) } : s));
  }, []);
  const undo = useCallback(() => setSession((s) => (s ? { ...s, history: undoHistory(s.history) } : s)), []);
  const redo = useCallback(() => setSession((s) => (s ? { ...s, history: redoHistory(s.history) } : s)), []);

  return (
    <>
      {screen === 'home' && (
        <HomeScreen
          draft={draft}
          onPick={pick}
          onPickVideo={pickVideo}
          onResume={resume}
          onDeleteDraft={deleteDraft}
          onShowAbout={() => setShowAbout(true)}
        />
      )}
      {(screen === 'editor' || screen === 'preview') && session && doc && (
        <EditorScreen
          doc={doc}
          media={session.kind === 'photo' ? { kind: 'photo', photo: session.photo } : { kind: 'video', player: session.player }}
          apply={apply}
          undo={undo}
          redo={redo}
          canUndo={session.history.past.length > 0}
          canRedo={session.history.future.length > 0}
          onHome={goHome}
          onChangePhoto={changePhoto}
          onExport={() => (session.kind === 'video' ? void runVideoExport() : setShowExport(true))}
        />
      )}
      {screen === 'editor' && showExport && doc && (
        <ExportSheet doc={doc} initial={exportOpts} onCancel={() => setShowExport(false)} onExport={runExport} />
      )}
      {screen === 'preview' && exported && <PreviewScreen media={exported} onBackToEdit={backToEdit} />}
      {showAbout && <AboutSheet onClose={() => setShowAbout(false)} />}
      {videoProgress && (
        <div className="busy busy-solid" role="alert" aria-live="polite">
          <p>動画を書き出しています… {Math.min(100, Math.round((videoProgress.done / Math.max(1, videoProgress.total)) * 100))}%</p>
          <div className="progress-bar export-progress">
            <div style={{ width: `${Math.min(100, (videoProgress.done / Math.max(1, videoProgress.total)) * 100)}%` }} />
          </div>
          <p className="busy-note">書き出しが終わるまで、画面を閉じたりほかのアプリに切り替えたりしないでください。</p>
          <button className="big-btn" onClick={() => (exportSignal.current.cancelled = true)}>
            キャンセル
          </button>
        </div>
      )}
      {busy && (
        <div className="busy" role="alert" aria-live="assertive">
          <div className="spinner" />
          <p>{busy}</p>
        </div>
      )}
    </>
  );
}
