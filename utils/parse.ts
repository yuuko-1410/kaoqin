/**
 * 考勤数据转换工具
 * 将飞书CSV解析结果转换为目标JSON格式
 */

import type { AttendanceRecord } from "./util";

interface AttendanceDay {
  status: string;
  lateMinutes?: number;
  leaveStart?: string;
  leaveEnd?: string;
  earlyLeaveTime?: string;
  overtimeStart?: string;
  overtimeEnd?: string;
  overtimeMinutes?: number;
  isFullDayWeekendOvertime?: boolean; // 标识是否为全天周末加班
}

interface Employee {
  id: string;
  name: string;
  attendance: Record<string, AttendanceDay>;
}

export interface AttendanceData {
  monthDisplay: string;
  year: number;
  monthValue: number;
  exportTime: string;
  employees: Employee[];
}

/**
 * 从飞书notes中提取考勤状态
 */
function parseAttendanceStatus(notes: string): AttendanceDay {
  const result: AttendanceDay = {
    status: "unselected",
  };

  if (!notes || notes === "-") {
    return result;
  }

  // 检查休息日
  if (notes.includes("休息")) {
    // 休息日打卡
    const match = notes.match(/休息打卡\(([\d:]+),([\d:]+)\)/);
    if (match) {
      result.status = "weekendOvertime";
      result.overtimeStart = match[1];
      result.overtimeEnd = match[2];

      // 判断是否为全天加班（工作时长 >= 7小时）
      const startTime = match[1];
      const endTime = match[2];
      const hours = parseInt(startTime.split(":")[0] ?? "0", 10);
      const minutes = parseInt(startTime.split(":")[1] ?? "0", 10);
      const startMinutes = hours * 60 + minutes;

      const endHours = parseInt(endTime.split(":")[0] ?? "0", 10);
      const endMins = parseInt(endTime.split(":")[1] ?? "0", 10);
      const endTotalMinutes = endHours * 60 + endMins;

      const workMinutes = endTotalMinutes - startMinutes;

      // 如果工作时长 >= 7小时，标记为全天加班
      if (workMinutes >= 7 * 60) {
        result.isFullDayWeekendOvertime = true;
      }
    } else {
      result.status = "unselected";
    }
    return result;
  }

  // 检查请假
  if (notes.includes("请假")) {
    // 检查全天请假
    if (notes.includes("事假(全天)") || notes.includes("病假(全天)")) {
      result.status = "fullDayLeave";
      return result;
    }

    // 检查半天请假(上午或下午)
    if (notes.includes("上午")) {
      result.status = "halfDayLeave";
      result.leaveStart = "09:00";
      result.leaveEnd = "11:30";
      return result;
    }

    if (notes.includes("下午")) {
      result.status = "halfDayLeave";
      result.leaveStart = "13:30";
      result.leaveEnd = "18:00";
      return result;
    }

    // 如果只有请假标记但没有上下文,当作全天请假
    result.status = "fullDayLeave";
    return result;
  }

  // 检查缺卡
  if (notes.includes("缺卡")) {
    result.status = "unselected";
    return result;
  }

  // 检查迟到
  const lateMatch = notes.match(/(?:迟到|严重迟到)(\d+)分钟\(([\d:]+)\)/);
  if (lateMatch) {
    result.status = "late";
    result.lateMinutes = parseInt(lateMatch[1]!, 10);
    return result;
  }

  // 检查早退
  if (notes.includes("早退")) {
    result.status = "earlyLeave";
    result.earlyLeaveTime = "17:30"; // 默认早退时间
    return result;
  }

  // 检查正常但有加班
  if (notes.includes("正常")) {
    // 提取上班和下班时间
    const times = notes.match(/\(([\d:]+)\)/g);
    if (times && times.length >= 2) {
      const checkOut = times[1]?.replace(/[()]/g, "");

      if (checkOut && checkOut !== "-" && checkOut > "18:00") {
        // 计算加班分钟数
        const parts = checkOut.split(":").map(Number);
        const hours = parts[0] ?? 0;
        const minutes = parts[1] ?? 0;
        const overtimeMinutes = (hours - 18) * 60 + minutes;

        if (overtimeMinutes > 0) {
          result.status = "overtime";
          result.overtimeMinutes = overtimeMinutes;
          return result;
        }
      }
    }

    result.status = "normal";
    return result;
  }

  // 检查外勤
  if (notes.includes("外勤")) {
    result.status = "normal";
    return result;
  }

  return result;
}

/**
 * 将飞书CSV解析结果转换为目标格式
 * @param records 从parseAttendanceCSV解析的记录
 * @param year 年份
 * @param month 月份(1-12)
 * @returns 目标格式的考勤数据
 */
export function convertToTargetFormat(
  records: AttendanceRecord[],
  year: number,
  month: number
): AttendanceData {
  const now = new Date();
  const exportTime = `${year}-${String(month).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

  const employees: Employee[] = records.map((record, index) => {
    const attendance: Record<string, AttendanceDay> = {};

    record.dailyRecords.forEach((day) => {
      if (day.date) {
        attendance[day.date] = parseAttendanceStatus(day.notes);
      }
    });

    return {
      id: String(index + 1),
      name: record.name,
      attendance,
    };
  });

  return {
    monthDisplay: `${year}年${String(month).padStart(2, "0")}月`,
    year,
    monthValue: month,
    exportTime,
    employees,
  };
}

/**
 * 导出为JSON文件
 * @param data 考勤数据
 * @param outputPath 输出文件路径
 */
export async function exportToJSON(
  data: AttendanceData,
  outputPath: string
): Promise<void> {
  await Bun.write(outputPath, JSON.stringify(data, null, 2));
}
