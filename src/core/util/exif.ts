/**
 * JPEG の EXIF から撮影日時（DateTimeOriginal）だけを読み取る小さな処理。
 * 読めないときは null（呼び出し側でファイルの日付や今日の日付を使う）。
 */
export async function readExifDate(blob: Blob): Promise<string | null> {
  try {
    const buf = await blob.slice(0, 256 * 1024).arrayBuffer();
    const v = new DataView(buf);
    if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null;
    let off = 2;
    while (off + 4 <= v.byteLength) {
      const marker = v.getUint16(off);
      const len = v.getUint16(off + 2);
      if (marker === 0xffe1 && off + 10 <= v.byteLength && v.getUint32(off + 4) === 0x45786966) {
        return parseTiff(v, off + 10);
      }
      if ((marker & 0xff00) !== 0xff00 || len < 2) return null;
      off += 2 + len;
    }
  } catch {
    // 無視
  }
  return null;
}

function parseTiff(v: DataView, start: number): string | null {
  const little = v.getUint16(start) === 0x4949;
  const u16 = (o: number) => v.getUint16(start + o, little);
  const u32 = (o: number) => v.getUint32(start + o, little);
  const readAscii = (o: number, n: number) => {
    let s = '';
    for (let i = 0; i < n && start + o + i < v.byteLength; i++) {
      const c = v.getUint8(start + o + i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  };
  const findTag = (ifd: number, tag: number): number | null => {
    if (start + ifd + 2 > v.byteLength) return null;
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      if (start + e + 12 > v.byteLength) return null;
      if (u16(e) === tag) return e;
    }
    return null;
  };
  const ifd0 = u32(4);
  let dateStr: string | null = null;
  const exifPtr = findTag(ifd0, 0x8769);
  if (exifPtr !== null) {
    const exifIfd = u32(exifPtr + 8);
    const e = findTag(exifIfd, 0x9003);
    if (e !== null) dateStr = readAscii(u32(e + 8), 19);
  }
  if (!dateStr) {
    const e = findTag(ifd0, 0x0132);
    if (e !== null) dateStr = readAscii(u32(e + 8), 19);
  }
  const m = dateStr && /^(\d{4}):(\d{2}):(\d{2})/.exec(dateStr);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
