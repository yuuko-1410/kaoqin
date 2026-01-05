import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

interface AttendanceRecord {
  id: string;
  monthDisplay: string;
  year: number;
  monthValue: number;
  dataSource: any[];
  importTime: string;
  employeeCount: number;
}

interface Database {
  records: AttendanceRecord[];
}

const dbPath = path.join(process.cwd(), "data", "db.json");

const defaultData: Database = { records: [] };

async function readDatabase(): Promise<Database> {
  try {
    const data = await fs.readFile(dbPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    // 如果文件不存在或读取失败，返回默认数据
    return defaultData;
  }
}

async function writeDatabase(data: Database): Promise<void> {
  await fs.writeFile(dbPath, JSON.stringify(data, null, 2), "utf-8");
}

export async function GET() {
  try {
    const db = await readDatabase();

    // 按导入时间倒序排列
    const records = db.records.sort((a, b) =>
      new Date(b.importTime).getTime() - new Date(a.importTime).getTime()
    );

    return NextResponse.json({ records });
  } catch (error) {
    console.error("获取历史记录失败:", error);
    return NextResponse.json(
      { error: "获取历史记录失败" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "缺少记录ID" }, { status: 400 });
    }

    const db = await readDatabase();

    const initialLength = db.records.length;
    db.records = db.records.filter((r) => r.id !== id);

    if (db.records.length === initialLength) {
      return NextResponse.json({ error: "记录不存在" }, { status: 404 });
    }

    await writeDatabase(db);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除记录失败:", error);
    return NextResponse.json({ error: "删除记录失败" }, { status: 500 });
  }
}
