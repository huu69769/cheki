import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * @fontsource の CSS は woff2 と woff の両方を参照している。
 * 対象ブラウザ（iOS Safari / Android Chrome / WebView）はすべて woff2 に対応しているので、
 * woff の参照を消して、配布物に余計なフォントファイルが入らないようにする。
 */
function woff2Only(): Plugin {
  return {
    name: 'woff2-only',
    enforce: 'pre',
    transform(code, id) {
      if (!/@fontsource[\\/].+\.css(\?.*)?$/.test(id)) return null;
      return code.replace(/,\s*url\([^)]*\.woff\)\s*format\(['"]woff['"]\)/g, '');
    },
  };
}

export default defineConfig({
  // 相対パス：GitHub Pages（/リポジトリ名/ 配下）でも Capacitor（ローカルファイル）でも動く
  base: './',
  plugins: [woff2Only(), react()],
  build: {
    target: ['es2020', 'safari15'],
    assetsInlineLimit: 0,
  },
});
