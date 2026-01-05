"use client";

import { useState, useEffect } from "react";
import { Modal, Form, InputNumber, Select, Button, message } from "antd";
import dayjs, { Dayjs } from "dayjs";
import type { AttendanceDetail, AttendanceRecord } from "@/types/attendance";

// 工作时间常量
const WORK_START_MORNING = "09:00";
const WORK_END_MORNING = "11:30";
const WORK_START_AFTERNOON = "13:30";
const WORK_END_AFTERNOON = "18:00";

interface SalaryModalProps {
  visible: boolean;
  onClose: () => void;
  record: AttendanceRecord | null;
  currentDate: Dayjs;
}

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

export default function SalaryModal({
  visible,
  onClose,
  record,
  currentDate,
}: SalaryModalProps) {
  const [form] = Form.useForm();
  const [employeeType, setEmployeeType] = useState<"fulltime" | "intern">(
    "fulltime"
  );
  const [salaryDetails, setSalaryDetails] = useState<{
    baseSalary: number;
    addedSalary: number;
    leaveDeductSalary: number;
    totalSalary: number;
  }>({
    baseSalary: 0,
    addedSalary: 0,
    leaveDeductSalary: 0,
    totalSalary: 0,
  });

  const daysInMonth = currentDate.daysInMonth();

  // 计算在岗天数、加班小时、请假小时
  const calculateAttendanceStats = () => {
    if (!record) return { presentDays: 0, overtimeHours: 0, leaveHours: 0 };

    let presentDays = 0;
    let overtimeHours = 0;
    let leaveHours = 0;

    for (let i = 1; i <= daysInMonth; i++) {
      const detail = record[`day_${i}`] as AttendanceDetail;
      if (detail && typeof detail === "object") {
        // 在岗天数统计
        if (
          detail.status === "normal" ||
          detail.status === "late" ||
          detail.status === "earlyLeave" ||
          detail.status === "overtime" ||
          detail.status === "halfDayLeave"
        ) {
          presentDays++;
        }

        // 加班小时统计
        if (detail.status === "overtime" && detail.overtimeMinutes) {
          overtimeHours += detail.overtimeMinutes / 60;
        } else if (
          detail.status === "weekendOvertime" &&
          detail.overtimeStart &&
          detail.overtimeEnd
        ) {
          // 周末加班计算
          if (detail.isFullDayWeekendOvertime) {
            // 全天周末加班：基础7小时 + 超出18:00的部分
            const [endHour, endMin] = detail.overtimeEnd.split(":").map(Number);
            const endTotalMinutes = (endHour ?? 0) * 60 + (endMin ?? 0);
            const endOfDay = 18 * 60; // 18:00

            if (endTotalMinutes > endOfDay) {
              // 超过18:00，计算超出部分
              overtimeHours += (7 * 60 + (endTotalMinutes - endOfDay)) / 60;
            } else {
              // 未超过18:00，按7小时计算
              overtimeHours += 7;
            }
          } else {
            // 半天周末加班：按实际时间计算（不考虑午休）
            overtimeHours +=
              calculateMinutes(detail.overtimeStart, detail.overtimeEnd) / 60;
          }
        }

        // 请假小时统计
        if (
          detail.status === "halfDayLeave" &&
          detail.leaveStart &&
          detail.leaveEnd
        ) {
          leaveHours +=
            calculateWorkHours(detail.leaveStart, detail.leaveEnd) / 60;
        } else if (detail.status === "earlyLeave" && detail.earlyLeaveTime) {
          leaveHours +=
            calculateWorkHours(detail.earlyLeaveTime, WORK_END_AFTERNOON) / 60;
        } else if (detail.status === "late" && detail.lateMinutes) {
          // 迟到按分钟数扣除
          leaveHours += detail.lateMinutes / 60;
        }
      }
    }

    return { presentDays, overtimeHours, leaveHours };
  };

  const stats = calculateAttendanceStats();

  // 计算薪资详情
  const calculateSalaryDetails = () => {
    const monthlySalary = form.getFieldValue("monthlySalary");
    const dailySalary = form.getFieldValue("dailySalary");

    if (employeeType === "fulltime") {
      // 全职: 月工资 + 加班工资 - 请假扣款
      if (!monthlySalary)
        return {
          baseSalary: 0,
          addedSalary: 0,
          leaveDeductSalary: 0,
          totalSalary: 0,
        };
      const baseSalary = monthlySalary;
      // 加班工资：(加班小时 / 7) × 1.5 × (月工资 / 21.75)
      const addedSalary =
        (stats.overtimeHours / 7) * 1.5 * (monthlySalary / 21.75);
      // 请假扣款：(请假小时 / 7) × (月工资 / 21.75)
      const leaveDeductSalary =
        (stats.leaveHours / 7) * (monthlySalary / 21.75);
      const totalSalary = baseSalary + addedSalary - leaveDeductSalary;
      return {
        baseSalary,
        addedSalary,
        leaveDeductSalary,
        totalSalary,
      };
    } else {
      // 实习生: 在(天)*日薪 + (加班h/7)*1.5*日薪 - (请假h/7)*日薪
      if (!dailySalary)
        return {
          baseSalary: 0,
          addedSalary: 0,
          leaveDeductSalary: 0,
          totalSalary: 0,
        };
      const baseSalary = stats.presentDays * dailySalary;
      const addedSalary = (stats.overtimeHours / 7) * 1.5 * dailySalary;
      const leaveDeductSalary = (stats.leaveHours / 7) * dailySalary;
      const totalSalary = baseSalary + addedSalary - leaveDeductSalary;
      return {
        baseSalary,
        addedSalary,
        leaveDeductSalary,
        totalSalary,
      };
    }
  };

  const handleEmployeeTypeChange = (value: "fulltime" | "intern") => {
    setEmployeeType(value);
    setSalaryDetails({
      baseSalary: 0,
      addedSalary: 0,
      leaveDeductSalary: 0,
      totalSalary: 0,
    });
    form.resetFields();
  };

  const handleCalculate = () => {
    form.validateFields().then(() => {
      const details = calculateSalaryDetails();
      setSalaryDetails(details);
    });
  };

  return (
    <Modal
      title={`薪资计算 - ${record?.name || ""}`}
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
      ]}
      width={600}
    >
      <div className="space-y-4">
        {/* 考勤统计 */}
        <div className="p-4 bg-[#f0f2f5] rounded">
          <div className="font-bold mb-2">
            考勤统计 ({currentDate.format("YYYY年MM月")})
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-[#999]">在岗天数</div>
              <div className="text-xl font-bold text-[#52c41a]">
                {stats.presentDays} 天
              </div>
            </div>
            <div>
              <div className="text-[#999]">加班小时</div>
              <div className="text-xl font-bold text-[#1890ff]">
                {stats.overtimeHours.toFixed(1)} 小时
              </div>
            </div>
            <div>
              <div className="text-[#999]">请假小时</div>
              <div className="text-xl font-bold text-[#ff4d4f]">
                {stats.leaveHours.toFixed(1)} 小时
              </div>
            </div>
          </div>
        </div>

        <Form form={form} layout="vertical">
          {/* 员工类型选择 */}
          <Form.Item label="员工类型">
            <Select
              value={employeeType}
              onChange={handleEmployeeTypeChange}
              options={[
                { label: "全职", value: "fulltime" },
                { label: "实习生", value: "intern" },
              ]}
            />
          </Form.Item>

          {/* 全职：输入月工资 */}
          {employeeType === "fulltime" && (
            <Form.Item
              label="月工资"
              name="monthlySalary"
              rules={[{ required: true, message: "请输入月工资" }]}
            >
              <InputNumber
                min={0}
                precision={2}
                className="w-full"
                placeholder="请输入月工资"
                addonAfter="元"
              />
            </Form.Item>
          )}

          {/* 实习生：输入日薪 */}
          {employeeType === "intern" && (
            <Form.Item
              label="日薪"
              name="dailySalary"
              rules={[{ required: true, message: "请输入日薪" }]}
            >
              <InputNumber
                min={0}
                precision={2}
                className="w-full"
                placeholder="请输入日薪"
                addonAfter="元"
              />
            </Form.Item>
          )}

          {/* 计算公式说明 */}
          <div className="text-xs text-[#999] bg-[#fafafa] p-3 rounded">
            <div className="font-bold mb-1">计算公式：</div>
            {employeeType === "fulltime" ? (
              <div>
                实际工资 = 月工资 + 加班工资 - 请假扣款
                <br />
                • 加班工资 = (加班小时 / 7) × 1.5 × (月工资 / 21.75)
                <br />
                • 请假扣款 = (请假小时 / 7) × (月工资 / 21.75)
              </div>
            ) : (
              <div>
                <div>
                  薪资 = 在岗天数 × 日薪 + (加班小时 / 7) × 1.5 × 日薪 -
                  (请假小时 / 7) × 日薪
                </div>
              </div>
            )}
          </div>

          {/* 计算按钮 */}
          <Button
            type="primary"
            onClick={handleCalculate}
            className="w-full"
            block
          >
            计算薪资
          </Button>

          {/* 计算结果 */}
          {salaryDetails.totalSalary > 0 && (
            <div className="mt-4 space-y-3">
              {/* 基本工资 */}
              <div className="p-3 bg-[#f0f2f5] rounded flex justify-between items-center">
                <div className="text-sm text-[#666]">基本工资</div>
                <div className="text-lg font-bold text-[#52c41a]">
                  ¥ {salaryDetails.baseSalary.toFixed(2)}
                </div>
              </div>

              {/* 增加的工资 */}
              {salaryDetails.addedSalary > 0 && (
                <div className="p-3 bg-[#e6f7ff] rounded flex justify-between items-center">
                  <div className="text-sm text-[#666]">加班工资</div>
                  <div className="text-lg font-bold text-[#1890ff]">
                    + ¥ {salaryDetails.addedSalary.toFixed(2)}
                  </div>
                </div>
              )}

              {/* 扣除的工资 */}
              {salaryDetails.leaveDeductSalary > 0 && (
                <div className="p-3 bg-[#fff1f0] rounded flex justify-between items-center">
                  <div className="text-sm text-[#666]">请假扣款</div>
                  <div className="text-lg font-bold text-[#ff4d4f]">
                    - ¥ {salaryDetails.leaveDeductSalary.toFixed(2)}
                  </div>
                </div>
              )}

              {/* 总计 */}
              <div className="p-4 bg-[#e6f7ff] border-2 border-[#1890ff] rounded flex justify-between items-center">
                <div className="text-sm text-[#666]">实际工资</div>
                <div className="text-3xl font-bold text-[#1890ff]">
                  ¥ {salaryDetails.totalSalary.toFixed(2)}
                </div>
              </div>
            </div>
          )}
        </Form>
      </div>
    </Modal>
  );
}
