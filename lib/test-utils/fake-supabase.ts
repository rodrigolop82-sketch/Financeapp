// Supabase falso en memoria para probar lógica de servidor: from().select /
// insert / update / upsert / delete con filtros eq, in, is, lt, gt, order,
// limit, single y maybeSingle. Solo lo que usan los servicios.

type Row = Record<string, unknown>
type Filter = (r: Row) => boolean

export class FakeDb {
  tables: Record<string, Row[]> = {}
  /** Llaves únicas por tabla (para insert con 23505 y upsert). */
  unique: Record<string, string[]> = {}

  constructor(seed: Record<string, Row[]> = {}, unique: Record<string, string[]> = {}) {
    for (const [t, rows] of Object.entries(seed)) this.tables[t] = rows.map((r) => ({ ...r }))
    this.unique = unique
  }

  rows(table: string): Row[] {
    return (this.tables[table] ??= [])
  }

  from(table: string) {
    return new Query(this, table)
  }
}

class Query implements PromiseLike<{ data: unknown; error: { code?: string; message: string } | null; count?: number }> {
  private filters: Filter[] = []
  private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
  private payload: Row | Row[] | null = null
  private conflict: string | null = null
  private orderBy: { col: string; asc: boolean } | null = null
  private max: number | null = null
  private mode: 'many' | 'single' | 'maybe' = 'many'
  private returning = false
  private head = false

  constructor(private db: FakeDb, private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op !== 'select') this.returning = true
    if (opts?.head) this.head = true
    return this
  }
  insert(p: Row | Row[]) { this.op = 'insert'; this.payload = p; return this }
  update(p: Row) { this.op = 'update'; this.payload = p; return this }
  upsert(p: Row | Row[], opts?: { onConflict?: string }) { this.op = 'upsert'; this.payload = p; this.conflict = opts?.onConflict ?? 'id'; return this }
  delete() { this.op = 'delete'; return this }
  eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this }
  in(c: string, vs: unknown[]) { this.filters.push((r) => vs.includes(r[c])); return this }
  is(c: string, v: unknown) { this.filters.push((r) => (r[c] ?? null) === v); return this }
  lt(c: string, v: string) { this.filters.push((r) => r[c] != null && String(r[c]) < v); return this }
  gt(c: string, v: string) { this.filters.push((r) => r[c] != null && String(r[c]) > v); return this }
  gte(c: string, v: string) { this.filters.push((r) => r[c] != null && String(r[c]) >= v); return this }
  lte(c: string, v: string) { this.filters.push((r) => r[c] != null && String(r[c]) <= v); return this }
  order(col: string, opts?: { ascending?: boolean }) { this.orderBy = { col, asc: opts?.ascending !== false }; return this }
  limit(n: number) { this.max = n; return this }
  single() { this.mode = 'single'; return this }
  maybeSingle() { this.mode = 'maybe'; return this }

  private match(r: Row) {
    return this.filters.every((f) => f(r))
  }

  private run() {
    const rows = this.db.rows(this.table)
    const keys = this.db.unique[this.table] ?? []
    const out = (data: Row[]) => {
      if (this.head) return { data: null, error: null, count: data.length }
      if (this.mode === 'many') return { data, error: null, count: data.length }
      if (data.length === 0) return { data: null, error: this.mode === 'single' ? { code: 'PGRST116', message: 'no rows' } : null }
      return { data: data[0], error: null }
    }

    switch (this.op) {
      case 'select': {
        let data = rows.filter((r) => this.match(r)).map((r) => ({ ...r }))
        if (this.orderBy) {
          const { col, asc } = this.orderBy
          data.sort((a, b) => (String(a[col] ?? '') < String(b[col] ?? '') ? -1 : 1) * (asc ? 1 : -1))
        }
        if (this.max != null) data = data.slice(0, this.max)
        return out(data)
      }
      case 'insert': {
        const list = Array.isArray(this.payload) ? this.payload : [this.payload!]
        for (const p of list) {
          if (keys.some((k) => p[k] != null && rows.some((r) => r[k] === p[k]))) {
            return { data: null, error: { code: '23505', message: 'duplicate key' } }
          }
        }
        const added = list.map((p) => ({ id: p.id ?? `${this.table}_${rows.length + 1}`, ...p }))
        rows.push(...added)
        return out(this.returning ? added : [])
      }
      case 'upsert': {
        const list = Array.isArray(this.payload) ? this.payload : [this.payload!]
        const done: Row[] = []
        for (const p of list) {
          const hit = rows.find((r) => r[this.conflict!] === p[this.conflict!])
          if (hit) { Object.assign(hit, p); done.push(hit) } else {
            const row = { id: `${this.table}_${rows.length + 1}`, ...p }
            rows.push(row)
            done.push(row)
          }
        }
        return out(this.returning ? done : [])
      }
      case 'update': {
        const hits = rows.filter((r) => this.match(r))
        hits.forEach((r) => Object.assign(r, this.payload))
        return out(this.returning ? hits.map((r) => ({ ...r })) : [])
      }
      case 'delete': {
        const keep = rows.filter((r) => !this.match(r))
        this.db.tables[this.table] = keep
        return out([])
      }
    }
  }

  then<A, B>(ok?: ((v: { data: unknown; error: { code?: string; message: string } | null; count?: number }) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null) {
    try {
      return Promise.resolve(this.run()).then(ok, bad)
    } catch (e) {
      return Promise.reject(e).then(ok, bad)
    }
  }
}
