import bs from "better-sqlite3";

export interface MetadataRowData {
  url: string;
  mimeType: string;
  headers: string;
  updatedAt: number;
}

class MetadataDB {
  static instances = new Map<string, MetadataDB>();

  static init_or_get(filename: string) {
    if (!MetadataDB.instances.has(filename)) MetadataDB.instances.set(filename, new MetadataDB(filename));
    return MetadataDB.instances.get(filename)!;
  }

  private readonly db: bs.Database;
  constructor(filename?: string) {
    this.db = new bs(filename);
    const stmt = this.db.prepare(`CREATE TABLE IF NOT EXISTS metadata ( url TEXT PRIMARY KEY, mimeType TEXT, headers TEXT, updatedAt INTEGER )`);
    stmt.run();
  }

  upset_metadata({ url, mimeType, headers }: Omit<MetadataRowData, "updatedAt">) {
    const stmt = this.db.prepare(`INSERT OR REPLACE INTO metadata ( url, mimeType, headers, updatedAt ) VALUES (?, ?, ?, ?)`);
    return stmt.run(url, mimeType, headers, Date.now());
  }

  get_metadata(url: string) {
    const stmt = this.db.prepare(`SELECT * FROM metadata WHERE url = ?`);
    return stmt.get(url) as MetadataRowData | null;
  }
}

export default MetadataDB;
