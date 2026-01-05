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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Next.js 15+ params is a Promise
    const { id } = await params;

    // 直接使用fs读取JSON文件
    const data = await fs.readFile(dbPath, "utf-8");
    const db: Database = JSON.parse(data);

    const record = db.records.find((r) => r.id === id);

    if (!record) {
      return NextResponse.json({ error: "记录不存在" }, { status: 404 });
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error("获取记录失败:", error);
    return NextResponse.json({ error: "获取记录失败" }, { status: 500 });
  }
}
