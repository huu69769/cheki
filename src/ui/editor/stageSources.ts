import { useEffect, useMemo, useRef } from 'react';
import { GLFilter } from '../../core/filters/glFilter';
import type { PhotoDoc } from '../../core/model/types';
import { filterCanvasInPlace, PreviewPhotoCache, type LoadedPhoto } from '../../core/render/photoSource';
import { createCanvas, get2d } from '../../core/util/canvas';
import type { StageSource } from './Stage';

/** 写真を編集画面に表示するためのもの（フィルターをかけた写真をキャッシュして使い回す） */
export function usePhotoStageSource(photo: LoadedPhoto | null): StageSource | null {
  const cacheRef = useRef<PreviewPhotoCache | null>(null);
  useEffect(() => {
    cacheRef.current = new PreviewPhotoCache();
    return () => {
      cacheRef.current?.dispose();
      cacheRef.current = null;
    };
  }, []);
  return useMemo(() => {
    if (!photo) return null;
    return {
      get: (doc: PhotoDoc) => {
        cacheRef.current ??= new PreviewPhotoCache();
        return cacheRef.current.get(photo, doc.effects.filterId, doc.effects.filterStrength);
      },
      width: photo.width,
      height: photo.height,
      version: 0,
    };
  }, [photo]);
}

/**
 * 動画のいまのコマを編集画面に表示するためのもの。
 * フィルターは GPU（WebGL）でかける。使えない端末では CPU で計算する。
 */
export function useVideoStageSource(
  frame: HTMLCanvasElement | null,
  frameVersion: number,
  size: { width: number; height: number } | null,
): StageSource | null {
  const glRef = useRef<GLFilter | null | undefined>(undefined);
  const cpuRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    return () => {
      glRef.current?.dispose();
      glRef.current = undefined;
    };
  }, []);
  return useMemo(() => {
    if (!size) return null;
    return {
      get: (doc: PhotoDoc) => {
        if (!frame) return null;
        const { filterId, filterStrength } = doc.effects;
        if (glRef.current === undefined) glRef.current = GLFilter.create();
        let image: HTMLCanvasElement = frame;
        const gl = glRef.current;
        if (gl) {
          image = gl.apply(frame, frame.width, frame.height, filterId, filterStrength) ?? frame;
        } else if (filterId !== 'none' && filterStrength > 0) {
          let c = cpuRef.current;
          if (!c || c.width !== frame.width || c.height !== frame.height) c = cpuRef.current = createCanvas(frame.width, frame.height);
          get2d(c, { willReadFrequently: true }).drawImage(frame, 0, 0);
          filterCanvasInPlace(c, filterId, filterStrength);
          image = c;
        }
        return { image, width: size.width, height: size.height };
      },
      width: size.width,
      height: size.height,
      version: frameVersion,
    };
  }, [frame, frameVersion, size]);
}
