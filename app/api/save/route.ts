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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      recordId,
      monthDisplay,
      year,
      monthValue,
      dataSource,
      importTime,
      employeeCount,
    } = body;

    if (!recordId || !dataSource) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    const db = await readDatabase();

    // 查找是否已存在该记录
    const existingIndex = db.records.findIndex((r) => r.id === recordId);

    const record = {
      id: recordId,
      monthDisplay,
      year,
      monthValue,
      dataSource,
      importTime,
      employeeCount,
    };

    if (existingIndex >= 0) {
      // 更新已存在的记录
      db.records[existingIndex] = record;
    } else {
      // 添加新记录
      db.records.push(record);
    }

    await writeDatabase(db);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("保存数据失败:", error);
    return NextResponse.json({ error: "保存数据失败" }, { status: 500 });
  }
}
