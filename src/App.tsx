import { useCallback, useEffect, useState } from 'react';
import { PHOTO_DRAFT_ID } from './config';
import { createHistory, pushHistory, redoHistory, undoHistory, type HistoryState } from './core/history/history';
import { loadFontFaces } from './core/fonts/fonts';
import { createDoc, normalizeDoc, todayString } from './core/model/doc';
import type { PhotoDoc } from './core/model/types';
import { loadPhoto, type LoadedPhoto } from './core/render/photoSource';
import { releaseCanvas } from './core/util/canvas';
import { readExifDate } from './core/util/exif';
import { platform, type PickedFile } from './platform';
import { exportPhoto, type PhotoExportOptions } from './core/export/exportPhoto';
import { AboutSheet } from './ui/screens/AboutSheet';
import { ExportSheet } from './ui/editor/ExportSheet';
import { PreviewScreen, type ExportedMedia } from './ui/screens/PreviewScreen';
import { EditorScreen } from './ui/editor/EditorScreen';
import { HomeScreen, type DraftSummary } from './ui/screens/HomeScreen';
import { useToast } from './ui/components/Toast';

interface PhotoSession {
  draftId: string;
  photo: LoadedPhoto;
  history: HistoryState<PhotoDoc>;
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
  const [session, setSession] = useState<PhotoSession | null>(null);
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
  useEffect(() => {
    if (!session || !doc) return;
    const id = window.setTimeout(() => {
      platform.drafts.saveDoc(session.draftId, 'photo', doc).catch(() => {
        /* 保存できなくても編集は続けられる */
      });
    }, 700);
    return () => window.clearTimeout(id);
  }, [doc, session?.draftId]);

  const replaceSession = (next: PhotoSession | null) => {
    setSession((old) => {
      if (old && old.photo !== next?.photo) releaseCanvas(old.photo.canvas);
      return next;
    });
  };

  // ---- 写真の読み込み ----
  const startWithFile = async (file: PickedFile) => {
    setBusy('写真を読み込んでいます…');
    try {
      const [photo, date] = await Promise.all([loadPhoto(file.blob), photoDateOf(file)]);
      const newDoc = createDoc(date);
      replaceSession({ draftId: PHOTO_DRAFT_ID, photo, history: createHistory(newDoc) });
      setScreen('editor');
      await platform.drafts.saveSource(PHOTO_DRAFT_ID, file.blob, file.name).catch(() => {});
      await platform.drafts.saveDoc(PHOTO_DRAFT_ID, 'photo', newDoc).catch(() => {});
    } catch (e) {
      toast(e instanceof Error ? e.message : '写真を読み込めませんでした');
    } finally {
      setBusy(null);
    }
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
      replaceSession({ draftId: d.id, photo, history: createHistory(restored) });
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
    if (session && doc) await platform.drafts.saveDoc(session.draftId, 'photo', doc).catch(() => {});
    replaceSession(null);
    setScreen('home');
    void refreshDraft();
  };

  const changePhoto = () => {
    platform.media.pickImage('library').then(async (file) => {
      if (!file || !session) return;
      setBusy('写真を読み込んでいます…');
      try {
        const photo = await loadPhoto(file.blob);
        const draftId = session.draftId;
        setSession((s) => {
          if (!s) return s;
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
    if (!session || !doc) return;
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
          onResume={resume}
          onDeleteDraft={deleteDraft}
          onShowAbout={() => setShowAbout(true)}
        />
      )}
      {(screen === 'editor' || screen === 'preview') && session && doc && (
        <EditorScreen
          doc={doc}
          photo={session.photo}
          apply={apply}
          undo={undo}
          redo={redo}
          canUndo={session.history.past.length > 0}
          canRedo={session.history.future.length > 0}
          onHome={goHome}
          onChangePhoto={changePhoto}
          onExport={() => setShowExport(true)}
        />
      )}
      {screen === 'editor' && showExport && doc && (
        <ExportSheet doc={doc} initial={exportOpts} onCancel={() => setShowExport(false)} onExport={runExport} />
      )}
      {screen === 'preview' && exported && <PreviewScreen media={exported} onBackToEdit={backToEdit} />}
      {showAbout && <AboutSheet onClose={() => setShowAbout(false)} />}
      {busy && (
        <div className="busy" role="alert" aria-live="assertive">
          <div className="spinner" />
          <p>{busy}</p>
        </div>
      )}
    </>
  );
}
