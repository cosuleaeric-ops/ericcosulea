// Catmull-Rom cu punctele de control ținute între minimul și maximul datelor.
//
// Splineul monoton nu depășea valorile, dar punea tangentă zero în fiecare vârf,
// deci linia se frângea. Splineul natural curge frumos, dar depășește: cu trei
// puncte (3, 4, 0) arcul urca peste 4 și ieșea din grafic.
//
// Un bezier cubic are, la orice t, y-ul o combinație convexă a celor patru
// puncte de control. Deci dacă toate patru stau în [sus, jos], curba nu poate
// ieși din bandă. Asta prinde depășirea fără să aplatizeze vârfurile.

export type Punct = [number, number];

function controale(p: Punct[], i: number, sus: number, jos: number) {
  const prinde = (v: number) => Math.min(jos, Math.max(sus, v));
  const [x0, y0] = p[i - 1] ?? p[i];
  const [x1, y1] = p[i];
  const [x2, y2] = p[i + 1];
  const [x3, y3] = p[i + 2] ?? p[i + 1];
  return {
    c1x: x1 + (x2 - x0) / 6,
    c1y: prinde(y1 + (y2 - y0) / 6),
    c2x: x2 - (x3 - x1) / 6,
    c2y: prinde(y2 - (y3 - y1) / 6),
    x2,
    y2,
  };
}

function banda(p: Punct[]): [number, number] {
  const ys = p.map((q) => q[1]);
  return [Math.min(...ys), Math.max(...ys)];
}

// Varianta care întoarce un `d` de SVG, pentru sparkline-urile desenate de mână.
export function caleLina(p: Punct[]): string {
  if (p.length === 0) return "";
  const f = (v: number) => v.toFixed(1);
  if (p.length === 1) return `M${f(p[0][0])},${f(p[0][1])}`;
  const [sus, jos] = banda(p);
  let d = `M${f(p[0][0])},${f(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const c = controale(p, i, sus, jos);
    d += ` C${f(c.c1x)},${f(c.c1y)} ${f(c.c2x)},${f(c.c2y)} ${f(c.x2)},${f(c.y2)}`;
  }
  return d;
}

// Varianta de curbă d3, pe care o înțelege recharts prin prop-ul `type`.
// Adun punctele și desenez abia la lineEnd, fiindcă banda de prindere se știe
// doar după ce le-am văzut pe toate.
type Ctx = {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  bezierCurveTo(a: number, b: number, c: number, d: number, e: number, f: number): void;
  closePath(): void;
};

class CurbaLina {
  private p: Punct[] = [];
  private linie = NaN;
  constructor(private ctx: Ctx) {}
  areaStart() { this.linie = 0; }
  areaEnd() { this.linie = NaN; }
  lineStart() { this.p = []; }
  point(x: number, y: number) { this.p.push([+x, +y]); }
  lineEnd() {
    const p = this.p;
    if (p.length > 0) {
      if (this.linie) this.ctx.lineTo(p[0][0], p[0][1]);
      else this.ctx.moveTo(p[0][0], p[0][1]);
      const [sus, jos] = banda(p);
      for (let i = 0; i < p.length - 1; i++) {
        const c = controale(p, i, sus, jos);
        this.ctx.bezierCurveTo(c.c1x, c.c1y, c.c2x, c.c2y, c.x2, c.y2);
      }
    }
    if (this.linie || (this.linie !== 0 && p.length === 1)) this.ctx.closePath();
    this.linie = 1 - this.linie;
  }
}

export const curbaLina = (ctx: Ctx) => new CurbaLina(ctx);
