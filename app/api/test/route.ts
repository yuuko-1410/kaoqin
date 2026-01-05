import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

export async function GET() {
  try {
    const cwd = process.cwd();
    const dbPath = path.join(cwd, "data", "db.json");

    const info = {
      cwd,
      dbPath,
      fileExists: false,
      recordsCount: 0,
      ids: [],
    };

    try {
      const data = await fs.readFile(dbPath, "utf-8");
      const db = JSON.parse(data);
      info.fileExists = true;
      info.recordsCount = db.records.length;
      info.ids = db.records.map((r: any) => r.id);
    } catch (error) {
      info.fileExists = false;
    }

    return NextResponse.json(info);
  } catch (error) {
    return NextResponse.json({ error: String(error) });
  }
}
