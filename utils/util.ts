/**
 * 考勤记录解析工具
 * 用于解析飞书导出的CSV考勤数据
 */

export interface DailyRecord {
  date: string;
  weekday: string;
  notes: string; // 原始备注
}

export interface AttendanceRecord {
  name: string;
  dailyRecords: DailyRecord[];
}

/**
 * 解析飞书考勤CSV文件
 * @param filePath CSV文件路径
 * @returns 考勤记录数组
 */
/**
 * 解析CSV行,正确处理带引号的字段
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // 转义的引号
        current += '"';
        i++;
      } else {
        // 切换引号状态
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // 字段分隔符
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  // 添加最后一个字段
  result.push(current);

  return result;
}

export async function parseAttendanceCSV(
  filePath: string
): Promise<AttendanceRecord[]> {
  const content = await Bun.file(filePath).text();
  const lines = content.split("\n").filter((line: string) => line.trim());

  if (lines.length < 3) {
    throw new Error("CSV文件格式不正确");
  }

  // 解析表头,找到日期列的起始位置
  const header = parseCSVLine(lines[0] || "");
  const header2 = parseCSVLine(lines[1] || "");

  // 找到"每日考勤结果"列的起始位置
  let dailyStartIndex = header.findIndex((h: string) =>
    h.includes("每日考勤结果")
  );
  if (dailyStartIndex === -1) {
    dailyStartIndex = 41;
  }

  // 解析日期信息(从第二行)
  const dates: { date: string; weekday: string }[] = [];
  for (let i = dailyStartIndex; i < header2.length; i++) {
    const cell = header2[i]?.trim() || "";
    if (cell && (cell.includes("星期") || cell.includes("休"))) {
      dates.push({
        date: cell.split(" ")[0] || "",
        weekday: cell.split(" ")[1] || "",
      });
    }
  }

  const records: AttendanceRecord[] = [];

  // 从第3行开始(跳过表头)解析每个员工的数据
  for (let i = 2; i < lines.length; i++) {
    const values = parseCSVLine(lines[i] || "");
    if (!values[0] || values[0].trim() === "") continue;

    const name = values[0]?.trim() || "";

    const dailyRecords = dates.map((dateInfo, index) => {
      const cellIndex = dailyStartIndex + index;
      const cell = values[cellIndex]?.trim() || "";

      return {
        date: dateInfo.date,
        weekday: dateInfo.weekday,
        notes: cell,
      };
    });

    records.push({
      name,
      dailyRecords,
    });
  }

  return records;
}
