'use client';

import { useEffect, useImperativeHandle, useRef } from 'react';
import type { Ref } from 'react';
import { FOGO_DURACAO_DEFAULT_MS, type PaletaFogo } from './common';

// Efeito de transição em WebGL portado de "Transições de fogo e fumaça":
// somente as paletas de fogo (a fumaça ficou de fora). O canvas cobre a tela
// inteira enquanto a cena troca e é escondido ao final.

export interface TransicaoFogoHandle {
  /**
   * Toca a transição. Devolve `true` quando a animação começou; `false` quando
   * não foi possível animar (sem WebGL / movimento reduzido / já tocando) —
   * nesse caso os callbacks de cobertura e fim já podem ter sido chamados.
   */
  play: (
    paleta: PaletaFogo,
    duracaoMs: number,
    callbacks?: { onCover?: () => void; onEnd?: () => void }
  ) => boolean;
}

interface TransicaoFogoProps {
  ref?: Ref<TransicaoFogoHandle>;
}

const VERT = 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';

const FRAG = [
  '#ifdef GL_FRAGMENT_PRECISION_HIGH',
  'precision highp float;',
  '#else',
  'precision mediump float;',
  '#endif',
  'uniform vec2 uRes;',
  'uniform float uTime;',
  'uniform float uFrontIn;',
  'uniform float uFrontOut;',
  'uniform float uCover;',
  'uniform vec3 uC1;',
  'uniform vec3 uC2;',
  'uniform vec3 uC3;',
  'uniform vec3 uC4;',

  'float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }',
  'float noise(vec2 p){',
  '  vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f);',
  '  float a = hash(i), b = hash(i + vec2(1.0,0.0)), c = hash(i + vec2(0.0,1.0)), d = hash(i + vec2(1.0,1.0));',
  '  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);',
  '}',
  'float fbm(vec2 p){',
  '  float v = 0.0, a = 0.5;',
  '  for(int i = 0; i < 4; i++){ v += a * noise(p); p = p * 2.03 + vec2(17.1, 9.7); a *= 0.5; }',
  '  return v;',
  '}',

  /* Fogo: línguas esticadas na diagonal, núcleo amarelo, borda vermelha com brilho. */
  'vec4 fire(vec2 uv, vec2 p){',
  '  vec2 dir = normalize(vec2(-0.82, -0.57));',
  '  vec2 per = vec2(-dir.y, dir.x);',
  '  vec2 c = vec2(dot(p, dir) * 1.0 - uTime * 1.6, dot(p, per) * 3.2);',
  '  vec2 w = vec2(fbm(p * 1.8 + vec2(0.0, uTime * 0.4)), fbm(p * 1.8 + vec2(5.2, 1.3) - uTime * 0.35));',
  '  c += (w - 0.5) * 2.2;',
  '  float n = fbm(c);',
  '  float nt = (n - 0.47) * 2.0;',
  '  nt += (noise(p * 9.0 + uTime * 2.5) - 0.5) * 0.05;',
  '  float q = 0.55 * (1.0 - uv.x) + 0.45 * (1.0 - uv.y);',
  '  float vIn = (uFrontIn - q) * 1.4 + nt;',
  '  float vOut = (q - uFrontOut) * 0.8 + nt;',
  '  float v = min(vIn, vOut);',
  '  float vy = min(vIn - 0.12, vOut - 0.3);',
  '  v = mix(v, 1.5, uCover);',
  '  vy = mix(vy, 1.5, uCover);',
  '  float core = smoothstep(-0.02, 0.03, v);',
  '  float halo = 0.4 * smoothstep(-0.16, 0.0, v);',
  '  float a = max(core, halo);',
  '  vec3 col = mix(uC1, uC2, smoothstep(-0.03, 0.03, vy));',
  '  col = mix(col, uC3, smoothstep(0.02, 0.07, vy));',
  '  col = mix(uC4, col, smoothstep(-0.06, 0.04, v));',
  '  return vec4(col, a);',
  '}',

  'void main(){',
  '  vec2 uv = gl_FragCoord.xy / uRes;',
  '  vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);',
  '  vec4 r = fire(uv, p);',
  '  gl_FragColor = vec4(r.rgb * r.a, r.a);',
  '}',
].join('\n');

// Paletas do fogo: borda, meio, núcleo e brilho externo (RGB 0 a 1).
const PAL: Record<PaletaFogo, number[][]> = {
  orange: [
    [1.0, 0.05, 0.0],
    [1.0, 0.42, 0.0],
    [1.0, 1.0, 0.0],
    [0.9, 0.1, 0.0],
  ],
  blue: [
    [0.05, 0.2, 1.0],
    [0.0, 0.62, 1.0],
    [0.78, 1.0, 1.0],
    [0.04, 0.12, 0.8],
  ],
  purple: [
    [0.55, 0.05, 0.9],
    [0.85, 0.2, 1.0],
    [1.0, 0.82, 1.0],
    [0.4, 0.05, 0.7],
  ],
  green: [
    [0.0, 0.62, 0.1],
    [0.35, 0.9, 0.1],
    [0.9, 1.0, 0.4],
    [0.0, 0.5, 0.1],
  ],
  dark: [
    [0.1, 0.1, 0.13],
    [0.34, 0.35, 0.4],
    [0.8, 0.82, 0.87],
    [0.26, 0.27, 0.32],
  ],
};

const NOMES_UNIFORMES = [
  'uRes',
  'uTime',
  'uFrontIn',
  'uFrontOut',
  'uCover',
  'uC1',
  'uC2',
  'uC3',
  'uC4',
] as const;

function clamp(x: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, x));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smooth(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function easeSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

export default function TransicaoFogo({ ref }: TransicaoFogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const uniformesRef = useRef<Record<string, WebGLUniformLocation | null>>({});
  const rodandoRef = useRef(false);
  const cobertoRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const callbacksRef = useRef<{ onCover?: () => void; onEnd?: () => void }>({});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) canvas.style.display = 'none';
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      const gl = glRef.current;
      glRef.current = null;
      if (gl) {
        // Libera o contexto ao desmontar (a overlay fica aberta por horas).
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
    };
  }, []);

  function compilar(
    gl: WebGLRenderingContext,
    tipo: number,
    fonte: string
  ): WebGLShader | null {
    const shader = gl.createShader(tipo);
    if (!shader) return null;
    gl.shaderSource(shader, fonte);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  // Compila o shader uma única vez; chamadas seguintes reaproveitam o contexto.
  function iniciar(): boolean {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    if (glRef.current) return true;

    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!gl) return false;

    const vs = compilar(gl, gl.VERTEX_SHADER, VERT);
    const fs = compilar(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;

    const prog = gl.createProgram();
    if (!prog) return false;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(prog));
      return false;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uniformes: Record<string, WebGLUniformLocation | null> = {};
    for (const nome of NOMES_UNIFORMES) {
      uniformes[nome] = gl.getUniformLocation(prog, nome);
    }

    gl.clearColor(0, 0, 0, 0);
    glRef.current = gl;
    uniformesRef.current = uniformes;
    return true;
  }

  function redimensionar(gl: WebGLRenderingContext) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const s = Math.min(0.7, 1200 / Math.max(1, w));
    const cw = Math.max(2, Math.round(w * s));
    const ch = Math.max(2, Math.round(h * s));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    gl.viewport(0, 0, cw, ch);
    gl.uniform2f(uniformesRef.current.uRes, cw, ch);
  }

  function desenhar(
    gl: WebGLRenderingContext,
    t: number,
    segundos: number,
    paleta: PaletaFogo
  ) {
    const u = uniformesRef.current;
    const P = PAL[paleta] ?? PAL.orange;
    gl.uniform3fv(u.uC1, P[0]);
    gl.uniform3fv(u.uC2, P[1]);
    gl.uniform3fv(u.uC3, P[2]);
    gl.uniform3fv(u.uC4, P[3]);
    const e1 = easeSine(clamp(t / 0.46, 0, 1));
    const e2 = easeSine(clamp((t - 0.54) / 0.46, 0, 1));
    const cover = smooth(0.42, 0.48, t) * (1 - smooth(0.52, 0.58, t));
    gl.uniform1f(u.uTime, segundos);
    gl.uniform1f(u.uFrontIn, lerp(-0.6, 1.75, e1));
    gl.uniform1f(u.uFrontOut, lerp(-1.5, 2.2, e2));
    gl.uniform1f(u.uCover, cover);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function play(
    paleta: PaletaFogo,
    duracaoMs: number,
    callbacks?: { onCover?: () => void; onEnd?: () => void }
  ): boolean {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    const reduzido =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // Sem WebGL ou com movimento reduzido: aplica a troca na hora, sem animar.
    if (reduzido || !iniciar()) {
      callbacks?.onCover?.();
      callbacks?.onEnd?.();
      return false;
    }
    // Uma transição por vez; o layout só é trocado no onCover.
    if (rodandoRef.current) return false;

    const gl = glRef.current;
    if (!gl) return false;

    rodandoRef.current = true;
    cobertoRef.current = false;
    callbacksRef.current = callbacks ?? {};

    const duracao =
      Number.isFinite(duracaoMs) && duracaoMs > 0 ? duracaoMs : FOGO_DURACAO_DEFAULT_MS;
    const offset = Math.random() * 40;
    redimensionar(gl);
    desenhar(gl, 0, offset, paleta);
    canvas.style.display = 'block';
    const t0 = performance.now();

    const frame = (now: number) => {
      const decorrido = Math.max(0, now - t0);
      const t = Math.min(1, decorrido / duracao);
      desenhar(gl, t, offset + decorrido / 1000, paleta);
      if (!cobertoRef.current && t >= 0.5) {
        cobertoRef.current = true;
        callbacksRef.current.onCover?.();
      }
      if (t < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        canvas.style.display = 'none';
        rodandoRef.current = false;
        rafRef.current = null;
        callbacksRef.current.onEnd?.();
      }
    };
    rafRef.current = requestAnimationFrame(frame);
    return true;
  }

  useImperativeHandle(ref, () => ({ play }));

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[9999] h-full w-full"
    />
  );
}
