"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { produce } from "immer";
import {
  Card,
  DatePicker,
  Table,
  Button,
  Space,
  Tag,
  message,
  Typography,
  Modal,
  Tooltip,
  Dropdown,
} from "antd";
import {
  LeftOutlined,
  RightOutlined,
  DownOutlined,
  SaveOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { MenuProps } from "antd";
import dayjs, { Dayjs } from "dayjs";
import { convertToTargetFormat, type AttendanceData } from "@/utils/parse";
import EditModal from "@/components/EditModal";
import SalaryModal from "@/components/SalaryModal";
import InitialImportModal from "@/components/InitialImportModal";
import HistoryModal from "@/components/HistoryModal";
import type { AttendanceDetail, AttendanceRecord } from "@/types/attendance";

const { Title } = Typography;

// 工作时间常量
const WORK_START_MORNING = "09:00";
const WORK_END_MORNING = "11:30";
const WORK_START_AFTERNOON = "13:30";
const WORK_END_AFTERNOON = "18:00";

// 计算两个时间之间的分钟数
function calculateMinutes(start: string, end: string): number {
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  return endH * 60 + endM - (startH * 60 + startM);
}

// 计算工作时间内的时间段分钟数
function calculateWorkHours(start: string, end: string): number {
  let workMinutes = 0;

  // 检查是否在上午工作时段
  if (start <= WORK_END_MORNING && end >= WORK_START_MORNING) {
    const overlapStart = Math.max(
      dayjs(start, "HH:mm").valueOf(),
      dayjs(WORK_START_MORNING, "HH:mm").valueOf()
    );
    const overlapEnd = Math.min(
      dayjs(end, "HH:mm").valueOf(),
      dayjs(WORK_END_MORNING, "HH:mm").valueOf()
    );
    if (overlapEnd > overlapStart) {
      workMinutes += (overlapEnd - overlapStart) / 60000;
    }
  }

  // 检查是否在下午工作时段
  if (start <= WORK_END_AFTERNOON && end >= WORK_START_AFTERNOON) {
    const overlapStart = Math.max(
      dayjs(start, "HH:mm").valueOf(),
      dayjs(WORK_START_AFTERNOON, "HH:mm").valueOf()
    );
    const overlapEnd = Math.min(
      dayjs(end, "HH:mm").valueOf(),
      dayjs(WORK_END_AFTERNOON, "HH:mm").valueOf()
    );
    if (overlapEnd > overlapStart) {
      workMinutes += (overlapEnd - overlapStart) / 60000;
    }
  }

  return workMinutes;
}

export default function AttendancePage() {
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [dataSource, setDataSource] = useState<AttendanceRecord[]>([]);
  const [columns, setColumns] = useState<ColumnsType<AttendanceRecord>>([]);
  const [loading, setLoading] = useState(false);
  const [showInitialModal, setShowInitialModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);
  const [importTime, setImportTime] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 使用ref存储最新的数据，避免闭包陷阱
  const dataSourceRef = useRef(dataSource);
  const currentDateRef = useRef(currentDate);
  const importTimeRef = useRef(importTime);
  const currentRecordIdRef = useRef(currentRecordId);

  // 更新ref
  useEffect(() => {
    dataSourceRef.current = dataSource;
    currentDateRef.current = currentDate;
    importTimeRef.current = importTime;
    currentRecordIdRef.current = currentRecordId;
  }, [dataSource, currentDate, importTime, currentRecordId]);

  // Only show initial modal on client-side after mount
  useEffect(() => {
    setShowInitialModal(true);
  }, []);

  // 页面卸载前保存数据
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const [editModal, setEditModal] = useState<{
    visible: boolean;
    record: AttendanceRecord | null;
    day: number;
    userName: string;
    date: string;
    currentDetail: AttendanceDetail;
  }>({
    visible: false,
    record: null,
    day: 0,
    userName: "",
    date: "",
    currentDetail: { status: "unselected" },
  });
  const [salaryModal, setSalaryModal] = useState<{
    visible: boolean;
    record: AttendanceRecord | null;
  }>({
    visible: false,
    record: null,
  });

  // 自动保存函数
  const autoSave = useCallback(async () => {
    // 从ref中获取最新数据，避免闭包陷阱
    const latestRecordId = currentRecordIdRef.current;
    const latestDataSource = dataSourceRef.current;
    const latestCurrentDate = currentDateRef.current;
    const latestImportTime = importTimeRef.current;

    if (!latestRecordId || latestDataSource.length === 0) return;

    try {
      const response = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId: latestRecordId,
          monthDisplay: latestCurrentDate.format("YYYY年MM月"),
          year: latestCurrentDate.year(),
          monthValue: latestCurrentDate.month() + 1,
          dataSource: latestDataSource,
          importTime: latestImportTime,
          employeeCount: latestDataSource.length,
        }),
      });

      if (!response.ok) {
        console.error("自动保存失败");
      }
    } catch (error) {
      console.error("自动保存错误:", error);
    }
  }, []); // 移除依赖，始终使用ref中的最新值

  // 触发自动保存（带防抖）
  const triggerAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      autoSave();
    }, 200); // 200ms后保存，更快响应
  }, [autoSave]);

  // 处理飞书CSV导入
  const handleImportCSV = async (file: File): Promise<AttendanceRecord[]> => {
    const text = await file.text();

    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === "," && !inQuotes) {
          result.push(current);
          current = "";
        } else {
          current += char;
        }
      }

      result.push(current);
      return result;
    };

    const lines = text.split("\n").filter((line) => line.trim());

    if (lines.length < 3) {
      throw new Error("CSV 文件格式不正确");
    }

    const header = parseCSVLine(lines[0]);
    const header2 = parseCSVLine(lines[1]);

    let dailyStartIndex = header.findIndex((h) => h.includes("每日考勤结果"));
    if (dailyStartIndex === -1) {
      dailyStartIndex = 41;
    }

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

    const parsedRecords: any[] = [];

    for (let i = 2; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
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

      parsedRecords.push({
        name,
        dailyRecords,
      });
    }

    if (dates.length > 0 && dates[0].date) {
      const dateMatch = dates[0].date.match(/(\d{4})-(\d{2})/);
      if (dateMatch) {
        const year = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]);
        const targetDate = dayjs()
          .year(year)
          .month(month - 1);
        setCurrentDate(targetDate);
      }
    }

    const convertedData = convertToTargetFormat(
      parsedRecords,
      currentDate.year(),
      currentDate.month() + 1
    );

    const daysInMonth = currentDate.daysInMonth();
    const newData: AttendanceRecord[] = convertedData.employees.map((emp) => {
      const record: AttendanceRecord = {
        key: emp.id,
        userId: emp.id,
        name: emp.name,
      };

      if (emp.attendance && typeof emp.attendance === "object") {
        Object.keys(emp.attendance).forEach((dateKey) => {
          const dayMatch = dateKey.match(/-(\d{2})$/);
          if (dayMatch) {
            const day = parseInt(dayMatch[1], 10);
            record[`day_${day}`] = emp.attendance[dateKey];
          }
        });
      }

      for (let day = 1; day <= daysInMonth; day++) {
        if (!record[`day_${day}`]) {
          record[`day_${day}`] = { status: "unselected" };
        }
      }

      return record;
    });

    // 生成记录ID并保存
    const recordId = `attendance_${currentDate.format("YYYYMM")}_${Date.now()}`;
    setCurrentRecordId(recordId);
    setImportTime(dayjs().format("YYYY-MM-DD HH:mm:ss"));

    setDataSource(newData);
    const newColumns = generateColumns(currentDate);
    setColumns(newColumns);

    // 保存到数据库
    await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recordId,
        monthDisplay: currentDate.format("YYYY年MM月"),
        year: currentDate.year(),
        monthValue: currentDate.month() + 1,
        dataSource: newData,
        importTime: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        employeeCount: newData.length,
      }),
    });

    return newData;
  };

  // 加载历史记录
  const handleLoadHistory = async (recordId: string) => {
    const response = await fetch(`/api/history/${recordId}`);
    if (!response.ok) {
      throw new Error("加载历史记录失败");
    }

    const data = await response.json();

    setCurrentRecordId(recordId);
    setImportTime(data.importTime);
    setDataSource(data.dataSource);

    const targetDate = dayjs()
      .year(data.year)
      .month(data.monthValue - 1);
    setCurrentDate(targetDate);

    const newColumns = generateColumns(targetDate);
    setColumns(newColumns);
  };

  // 获取状态显示信息
  const getStatusDisplay = (
    detail: AttendanceDetail | string
  ): { color: string; text: string } => {
    const attendanceDetail: AttendanceDetail =
      typeof detail === "string" ? { status: detail } : detail;

    const statusMap: Record<string, { color: string; text: string }> = {
      unselected: { color: "default", text: "-" },
      normal: { color: "success", text: "✓" },
      late: { color: "warning", text: "迟" },
      earlyLeave: { color: "orange", text: "退" },
      overtime: { color: "blue", text: "加" },
      fullDayLeave: { color: "default", text: "假" },
      halfDayLeave: { color: "lime", text: "半" },
      weekendOvertime: { color: "purple", text: "周" },
    };

    const baseInfo = statusMap[attendanceDetail.status] || {
      color: "default",
      text: "-",
    };

    let extraText = "";
    if (attendanceDetail.status === "late" && attendanceDetail.lateMinutes) {
      extraText = ` (${attendanceDetail.lateMinutes}分)`;
    } else if (
      attendanceDetail.status === "earlyLeave" &&
      attendanceDetail.earlyLeaveTime
    ) {
      extraText = ` (${attendanceDetail.earlyLeaveTime})`;
    } else if (
      attendanceDetail.status === "overtime" &&
      attendanceDetail.overtimeMinutes
    ) {
      extraText = ` (${attendanceDetail.overtimeMinutes}分)`;
    } else if (
      attendanceDetail.status === "halfDayLeave" &&
      attendanceDetail.leaveStart &&
      attendanceDetail.leaveEnd
    ) {
      extraText = ` (${attendanceDetail.leaveStart}-${attendanceDetail.leaveEnd})`;
    } else if (
      attendanceDetail.status === "weekendOvertime" &&
      attendanceDetail.overtimeStart &&
      attendanceDetail.overtimeEnd
    ) {
      extraText = ` (${attendanceDetail.overtimeStart}-${attendanceDetail.overtimeEnd})`;
    }

    return { color: baseInfo.color, text: baseInfo.text + extraText };
  };

  // 处理单元格点击
  const handleCellClick = useCallback(
    (
      record: AttendanceRecord,
      day: number,
      detail: AttendanceDetail | string
    ) => {
      const attendanceDetail: AttendanceDetail =
        typeof detail === "string" ? { status: detail } : detail;
      const dateStr = currentDate.format("YYYY年MM月") + `${day}日`;
      setEditModal({
        visible: true,
        record,
        day,
        userName: record.name,
        date: dateStr,
        currentDetail: attendanceDetail,
      });
    },
    [currentDate]
  );

  // 保存编辑
  // 保存编辑
  const handleSaveEdit = (newDetail: AttendanceDetail) => {
    if (editModal.record) {
      const { record, day } = editModal;
      const newData = produce(dataSource, (draft) => {
        const item = draft.find((d) => d.key === record.key);
        if (item) {
          item[`day_${day}`] = newDetail;
        }
      });
      setDataSource(newData);
      message.success("考勤状态更新成功");
      triggerAutoSave();
    }
  };

  // 一键设为未选择
  const handleQuickSetUnselected = () => {
    if (editModal.record) {
      const { record, day } = editModal;
      const newData = produce(dataSource, (draft) => {
        const item = draft.find((d) => d.key === record.key);
        if (item) {
          item[`day_${day}`] = { status: "unselected" };
        }
      });
      setDataSource(newData);
      message.success("已设为未选择");
      handleCloseModal();
      triggerAutoSave();
    }
  };

  // 批量设置整列状态
  const handleBatchSetColumn = useCallback(
    (day: number, status: string) => {
      setDataSource((prevDataSource) => {
        const newData = produce(prevDataSource, (draft) => {
          draft.forEach((item) => {
            const newDetail: AttendanceDetail = {
              status: status,
            };
            item[`day_${day}`] = newDetail;
          });
        });
        return newData;
      });

      message.success(
        `已将 ${currentDate.format(
          "YYYY年MM月"
        )}${day}日 所有员工设为${getStatusName(status)}`
      );
      triggerAutoSave();
    },
    [currentDate, triggerAutoSave]
  );

  // 获取状态名称
  const getStatusName = (status: string): string => {
    const names: Record<string, string> = {
      unselected: "未选择",
      normal: "正常出勤",
      late: "迟到",
      earlyLeave: "早退",
      overtime: "加班",
      fullDayLeave: "全天请假",
      halfDayLeave: "半天请假",
      weekendOvertime: "周末加班",
    };
    return names[status] || status;
  };

  // 批量设置整个表格为未选择
  const handleSetAllUnselected = () => {
    Modal.confirm({
      title: "确认操作",
      content: `确定要将 ${currentDate.format(
        "YYYY年MM月"
      )} 所有员工的所有考勤数据都设为未选择吗?`,
      okText: "确定",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: () => {
        const daysInMonth = currentDate.daysInMonth();

        const newData = produce(dataSource, (draft) => {
          draft.forEach((item) => {
            for (let day = 1; day <= daysInMonth; day++) {
              item[`day_${day}`] = { status: "unselected" };
            }
          });
        });

        setDataSource(newData);
        message.success("已将所有考勤数据设为未选择");
        triggerAutoSave();
      },
    });
  };

  // 关闭弹窗
  const handleCloseModal = () => {
    setEditModal({
      visible: false,
      record: null,
      day: 0,
      userName: "",
      date: "",
      currentDetail: { status: "unselected" },
    });
  };

  // 计算请假小时数
  const calculateLeaveHours = (
    record: AttendanceRecord,
    daysInMonth: number
  ): number => {
    let totalMinutes = 0;

    for (let i = 1; i <= daysInMonth; i++) {
      const detail = record[`day_${i}`] as AttendanceDetail;
      if (detail && typeof detail === "object") {
        if (
          detail.status === "halfDayLeave" &&
          detail.leaveStart &&
          detail.leaveEnd
        ) {
          totalMinutes += calculateWorkHours(
            detail.leaveStart,
            detail.leaveEnd
          );
        } else if (detail.status === "earlyLeave" && detail.earlyLeaveTime) {
          totalMinutes += calculateWorkHours(
            detail.earlyLeaveTime,
            WORK_END_AFTERNOON
          );
        } else if (detail.status === "late" && detail.lateMinutes) {
          totalMinutes += detail.lateMinutes;
        }
      }
    }

    return Math.round((totalMinutes / 60) * 10) / 10;
  };

  // 计算加班小时数
  const calculateOvertimeHours = (
    record: AttendanceRecord,
    daysInMonth: number
  ): number => {
    let totalMinutes = 0;

    for (let i = 1; i <= daysInMonth; i++) {
      const detail = record[`day_${i}`] as AttendanceDetail;
      if (detail && typeof detail === "object") {
        if (detail.status === "overtime" && detail.overtimeMinutes) {
          totalMinutes += detail.overtimeMinutes;
        } else if (
          detail.status === "weekendOvertime" &&
          detail.overtimeStart &&
          detail.overtimeEnd
        ) {
          if (detail.isFullDayWeekendOvertime) {
            const [endHour, endMin] = detail.overtimeEnd.split(":").map(Number);
            const endTotalMinutes = (endHour ?? 0) * 60 + (endMin ?? 0);
            const endOfDay = 18 * 60;

            if (endTotalMinutes > endOfDay) {
              totalMinutes += 7 * 60 + (endTotalMinutes - endOfDay);
            } else {
              totalMinutes += 7 * 60;
            }
          } else {
            totalMinutes += calculateMinutes(
              detail.overtimeStart,
              detail.overtimeEnd
            );
          }
        }
      }
    }

    return Math.round((totalMinutes / 60) * 10) / 10;
  };

  // 生成表格列和日期列
  const generateColumns = useCallback(
    (date: Dayjs) => {
      const daysInMonth = date.daysInMonth();

      const baseColumns: ColumnsType<AttendanceRecord> = [
        {
          title: "姓名",
          dataIndex: "name",
          key: "name",
          fixed: "left",
          width: 100,
        },
      ];

      // 生成日期列
      const dateColumns = Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;

        const batchMenuItems: MenuProps["items"] = [
          {
            key: "unselected",
            label: "设为未选择",
            onClick: () => handleBatchSetColumn(day, "unselected"),
          },
          {
            key: "normal",
            label: "设为正常出勤",
            onClick: () => handleBatchSetColumn(day, "normal"),
          },
          {
            key: "fullDayLeave",
            label: "设为全天请假",
            onClick: () => handleBatchSetColumn(day, "fullDayLeave"),
          },
          {
            type: "divider",
          },
          {
            key: "others",
            label: "其他状态(需单独设置)",
            disabled: true,
          },
        ];

        return {
          title: (
            <Dropdown menu={{ items: batchMenuItems }} trigger={["click"]}>
              <Button type="text" size="small" className="px-1 h-auto">
                <Space size={4}>
                  <span>{day}</span>
                  <DownOutlined className="text-[10px]" />
                </Space>
              </Button>
            </Dropdown>
          ),
          dataIndex: `day_${day}`,
          key: `day_${day}`,
          width: 80,
          align: "center" as const,
          render: (
            detail: AttendanceDetail | string,
            record: AttendanceRecord
          ) => {
            const displayInfo = getStatusDisplay(detail);
            const attendanceDetail: AttendanceDetail =
              typeof detail === "string" ? { status: detail } : detail;
            const isLeave =
              attendanceDetail.status === "fullDayLeave" ||
              attendanceDetail.status === "halfDayLeave";

            return (
              <Tag
                color={displayInfo.color}
                className={`cursor-pointer min-w-8 text-center transition-all duration-200 ${
                  isLeave ? "bg-red-100 border-red-500 border-2" : ""
                }`}
                onClick={() => handleCellClick(record, day, detail)}
              >
                {displayInfo.text}
              </Tag>
            );
          },
        };
      });

      const statsColumns: ColumnsType<AttendanceRecord> = [
        {
          title: (
            <Tooltip title="在公司天数 = 正常出勤 + 迟到 + 早退 + 加班 + 半天请假">
              <span>在(天)</span>
            </Tooltip>
          ),
          key: "normalCount",
          width: 120,
          align: "center" as const,
          fixed: "right",
          render: (_, record) => {
            let count = 0;
            for (let i = 1; i <= daysInMonth; i++) {
              const detail = record[`day_${i}`] as AttendanceDetail;
              if (
                detail &&
                typeof detail === "object" &&
                (detail.status === "normal" ||
                  detail.status === "late" ||
                  detail.status === "earlyLeave" ||
                  detail.status === "overtime" ||
                  detail.status === "halfDayLeave")
              )
                count++;
            }
            return <span className="text-[#52c41a] font-bold">{count}</span>;
          },
        },
        {
          title: "扣(小时)",
          key: "leaveHours",
          width: 100,
          align: "center" as const,
          fixed: "right",
          render: (_, record) => {
            const hours = calculateLeaveHours(record, daysInMonth);
            return <span className="text-[#999] font-bold">{hours}</span>;
          },
        },
        {
          title: (
            <Tooltip title="平日加班 + 周末加班">
              <span>加班(小时)</span>
            </Tooltip>
          ),
          key: "overtimeHours",
          width: 100,
          align: "center" as const,
          fixed: "right",
          render: (_, record) => {
            const hours = calculateOvertimeHours(record, daysInMonth);
            return <span className="text-[#1890ff] font-bold">{hours}</span>;
          },
        },
        {
          title: "操作",
          key: "action",
          width: 100,
          align: "center" as const,
          fixed: "right",
          render: (_, record) => (
            <Button
              type="primary"
              size="small"
              onClick={() => {
                setSalaryModal({
                  visible: true,
                  record,
                });
              }}
            >
              计算薪资
            </Button>
          ),
        },
      ];

      return [...baseColumns, ...dateColumns, ...statsColumns];
    },
    [handleBatchSetColumn, handleCellClick]
  );

  return (
    <div>
      <div className="flex justify-between items-center px-4">
        <Title level={2}>飞书考勤管理</Title>

        <Space>
          <Button danger onClick={handleSetAllUnselected}>
            全部设为未选择
          </Button>

          <Button icon={<HistoryOutlined />} onClick={() => setShowHistoryModal(true)}>
            历史记录
          </Button>

          <Button type="primary" icon={<SaveOutlined />} onClick={autoSave}>
            保存
          </Button>
        </Space>
      </div>

      <Card>
        <div className="mb-4">
          <div className="text-xs text-[#999] mb-2">考勤状态说明</div>
          <Space wrap>
            <Tag color="default">- 未选择</Tag>
            <Tag color="success">✓ 正常</Tag>
            <Tag color="warning">迟 迟到</Tag>
            <Tag color="orange">退 早退</Tag>
            <Tag color="blue">加 加班</Tag>
            <Tag color="default">假 全天请假</Tag>
            <Tag color="lime">半 半天请假</Tag>
            <Tag color="purple">周 周末加班</Tag>
          </Space>
        </div>
        <div className="mb-4 p-3 bg-[#f0f2f5] rounded">
          <div className="text-xs text-[#666]">
            <strong>工作时间:</strong> 09:00-11:30, 13:30-18:00
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={dataSource}
          loading={loading}
          bordered
          size="small"
          scroll={{ x: "max-content" }}
          pagination={false}
        />
      </Card>

      <InitialImportModal
        visible={showInitialModal}
        onClose={() => setShowInitialModal(false)}
        onImportCSV={handleImportCSV}
        onLoadHistory={handleLoadHistory}
      />

      <HistoryModal
        visible={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        onLoadHistory={handleLoadHistory}
        currentRecordId={currentRecordId}
      />

      <EditModal
        visible={editModal.visible}
        onClose={handleCloseModal}
        onSave={handleSaveEdit}
        currentDetail={editModal.currentDetail}
        userName={editModal.userName}
        date={editModal.date}
        onQuickSetUnselected={handleQuickSetUnselected}
      />

      <SalaryModal
        visible={salaryModal.visible}
        onClose={() => setSalaryModal({ visible: false, record: null })}
        record={salaryModal.record}
        currentDate={currentDate}
      />
    </div>
  );
}
