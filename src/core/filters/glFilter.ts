import { getFilter, type FilterParams } from './filters';

/**
 * フィルターを GPU（WebGL）でかける。動画は1秒に30コマ処理するため、CPU の計算では間に合わない。
 * 計算式は filters.ts の applyFilterToImageData と同じ。
 */

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_b;
uniform float u_c;
uniform float u_s;
uniform float u_t;
uniform float u_ti;
uniform float u_sep;
uniform float u_fade;
uniform float u_k;
uniform vec3 u_sh;
uniform vec3 u_hi;
void main() {
  vec3 c0 = texture2D(u_tex, v_uv).rgb;
  vec3 c = c0 + u_b;
  c = (c - 0.5) * u_c + 0.5;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  c = lum + (c - lum) * u_s;
  vec3 sp = vec3(
    dot(c, vec3(0.393, 0.769, 0.189)),
    dot(c, vec3(0.349, 0.686, 0.168)),
    dot(c, vec3(0.272, 0.534, 0.131)));
  c = mix(c, sp, u_sep);
  c.r += u_t * 0.08;
  c.b -= u_t * 0.08;
  c.g -= u_ti * 0.04;
  float l2 = clamp(lum, 0.0, 1.0);
  c += u_sh * (1.0 - l2) * (1.0 - l2) + u_hi * l2 * l2;
  if (u_fade > 0.0) {
    c = u_fade + c * (1.0 - u_fade * 1.4);
  }
  gl_FragColor = vec4(clamp(mix(c0, c, u_k), 0.0, 1.0), 1.0);
}`;

type Uniforms = Record<'b' | 'c' | 's' | 't' | 'ti' | 'sep' | 'fade' | 'k' | 'sh' | 'hi' | 'tex', WebGLUniformLocation | null>;

export class GLFilter {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private uniforms: Uniforms;
  private texture: WebGLTexture;

  private constructor(canvas: HTMLCanvasElement, gl: WebGLRenderingContext) {
    this.canvas = canvas;
    this.gl = gl;
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader');
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'program');
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = (n: string) => gl.getUniformLocation(prog, n);
    this.uniforms = {
      b: u('u_b'),
      c: u('u_c'),
      s: u('u_s'),
      t: u('u_t'),
      ti: u('u_ti'),
      sep: u('u_sep'),
      fade: u('u_fade'),
      k: u('u_k'),
      sh: u('u_sh'),
      hi: u('u_hi'),
      tex: u('u_tex'),
    };

    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.uniform1i(this.uniforms.tex, 0);
  }

  /** WebGL が使えない環境では null */
  static create(): GLFilter | null {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false });
      if (!gl) return null;
      return new GLFilter(canvas, gl);
    } catch {
      return null;
    }
  }

  /**
   * src にフィルターをかけた画像（この GLFilter が持つ canvas）を返す。
   * フィルターなしのときは null（src をそのまま使えばよい）。
   * 返した canvas は次の呼び出しで書き換わるので、すぐに描くこと。
   */
  apply(src: TexImageSource, width: number, height: number, filterId: string, strength: number): HTMLCanvasElement | null {
    const f = getFilter(filterId);
    if (f.id === 'none' || strength <= 0) return null;
    const p: FilterParams = f.params;
    const gl = this.gl;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    const U = this.uniforms;
    gl.uniform1f(U.b, p.brightness ?? 0);
    gl.uniform1f(U.c, p.contrast ?? 1);
    gl.uniform1f(U.s, p.saturation ?? 1);
    gl.uniform1f(U.t, p.temperature ?? 0);
    gl.uniform1f(U.ti, p.tint ?? 0);
    gl.uniform1f(U.sep, p.sepia ?? 0);
    gl.uniform1f(U.fade, p.fade ?? 0);
    gl.uniform1f(U.k, Math.min(1, strength));
    gl.uniform3fv(U.sh, p.shadows ?? [0, 0, 0]);
    gl.uniform3fv(U.hi, p.highlights ?? [0, 0, 0]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.canvas;
  }

  dispose() {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
