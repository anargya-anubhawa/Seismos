let nextId = 1;

/** Buffer melingkar berkapasitas tetap untuk tampilan langsung; memori tidak bertambah selama pengukuran. */
export class RingBuffer {
  readonly id = nextId++;
  size = 0;
  version = 0;
  lastT = 0;
  private head = 0;
  private ts: Float64Array;
  private xs: Float64Array;
  private ys: Float64Array;
  private zs: Float64Array;

  constructor(readonly capacity: number) {
    this.ts = new Float64Array(capacity);
    this.xs = new Float64Array(capacity);
    this.ys = new Float64Array(capacity);
    this.zs = new Float64Array(capacity);
  }

  clear(): void {
    this.head = 0;
    this.size = 0;
    this.lastT = 0;
    this.version++;
  }

  push(t: number, x: number, y: number, z: number): void {
    let idx: number;
    if (this.size < this.capacity) {
      idx = (this.head + this.size) % this.capacity;
      this.size++;
    } else {
      idx = this.head;
      this.head = (this.head + 1) % this.capacity;
    }
    this.ts[idx] = t;
    this.xs[idx] = x;
    this.ys[idx] = y;
    this.zs[idx] = z;
    this.lastT = t;
    this.version++;
  }

  /** Indeks 0 = sampel tertua. */
  t(i: number): number { return this.ts[(this.head + i) % this.capacity]; }
  x(i: number): number { return this.xs[(this.head + i) % this.capacity]; }
  y(i: number): number { return this.ys[(this.head + i) % this.capacity]; }
  z(i: number): number { return this.zs[(this.head + i) % this.capacity]; }

  /** Indeks sampel pertama dengan waktu >= tMin (waktu bersifat menaik). */
  firstIndexAtOrAfter(tMin: number): number {
    let lo = 0;
    let hi = this.size;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.t(mid) < tMin) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
}
