"use client";

import { useState, useEffect, useCallback } from "react";
import { produce } from "immer";
import {
  Card,
  DatePicker,
  Table,
  Button,
  Select,
  Space,
  Tag,
  message,
  Typography,
  Modal,
  Form,
  InputNumber,
  TimePicker,
  Tooltip,
  Dropdown,
  Upload,
} from "antd";
import {
  LeftOutlined,
  RightOutlined,
  DownOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { MenuProps } from "antd";
import dayjs, { Dayjs } from "dayjs";
import { convertToTargetFormat, type AttendanceData } from "@/utils/parse";

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

interface AttendanceDetail {
  status: string;
  lateMinutes?: number;
  earlyLeaveTime?: string;
  overtimeMinutes?: number;
  leaveStart?: string;
  leaveEnd?: string;
  overtimeStart?: string;
  overtimeEnd?: string;
}

interface AttendanceRecord {
  key: string;
  userId: string;
  name: string;
  [key: string]: AttendanceDetail | string; // 动态日期字段
}

interface User {
  id: string;
  name: string;
  department: string;
}

interface EditModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (detail: AttendanceDetail) => void;
  currentDetail: AttendanceDetail;
  userName: string;
  date: string;
  onQuickSetUnselected?: () => void;
}

interface SalaryModalProps {
  visible: boolean;
  onClose: () => void;
  record: AttendanceRecord | null;
  currentDate: Dayjs;
}

// 编辑弹窗组件
function EditModal({
  visible,
  onClose,
  onSave,
  currentDetail,
  userName,
  date,
  onQuickSetUnselected,
}: EditModalProps) {
  const [form] = Form.useForm();

  useEffect(() => {
    form.setFieldsValue({
      status: currentDetail.status || "unselected",
      lateMinutes: currentDetail.lateMinutes,
      earlyLeaveTime: currentDetail.earlyLeaveTime
        ? dayjs(currentDetail.earlyLeaveTime, "HH:mm")
        : null,
      overtimeMinutes: currentDetail.overtimeMinutes,
      leaveStart: currentDetail.leaveStart
        ? dayjs(currentDetail.leaveStart, "HH:mm")
        : null,
      leaveEnd: currentDetail.leaveEnd
        ? dayjs(currentDetail.leaveEnd, "HH:mm")
        : null,
      overtimeStart: currentDetail.overtimeStart
        ? dayjs(currentDetail.overtimeStart, "HH:mm")
        : null,
      overtimeEnd: currentDetail.overtimeEnd
        ? dayjs(currentDetail.overtimeEnd, "HH:mm")
        : null,
    });
  }, [currentDetail, visible, form]);

  const handleSave = () => {
    form.validateFields().then((values) => {
      const detail: AttendanceDetail = {
        status: values.status,
      };

      // 根据状态收集对应字段
      if (values.status === "late") {
        detail.lateMinutes = values.lateMinutes || 0;
      } else if (values.status === "earlyLeave") {
        detail.earlyLeaveTime = values.earlyLeaveTime
          ? dayjs(values.earlyLeaveTime).format("HH:mm")
          : undefined;
      } else if (values.status === "overtime") {
        detail.overtimeMinutes = values.overtimeMinutes || 0;
      } else if (values.status === "halfDayLeave") {
        detail.leaveStart = values.leaveStart
          ? dayjs(values.leaveStart).format("HH:mm")
          : undefined;
        detail.leaveEnd = values.leaveEnd
          ? dayjs(values.leaveEnd).format("HH:mm")
          : undefined;
      } else if (values.status === "weekendOvertime") {
        detail.overtimeStart = values.overtimeStart
          ? dayjs(values.overtimeStart).format("HH:mm")
          : undefined;
        detail.overtimeEnd = values.overtimeEnd
          ? dayjs(values.overtimeEnd).format("HH:mm")
          : undefined;
      }

      onSave(detail);
      onClose();
    });
  };

  const statusOptions = [
    { label: "- 未选择", value: "unselected", color: "default" },
    { label: "✓ 正常", value: "normal", color: "success" },
    { label: "迟 迟到", value: "late", color: "warning" },
    { label: "退 早退", value: "earlyLeave", color: "orange" },
    { label: "加 加班", value: "overtime", color: "blue" },
    { label: "假 全天请假", value: "fullDayLeave", color: "default" },
    { label: "半 半天请假", value: "halfDayLeave", color: "lime" },
    { label: "周 周末加班", value: "weekendOvertime", color: "purple" },
  ];

  const handleQuickSetUnselected = () => {
    if (onQuickSetUnselected) {
      onQuickSetUnselected();
    }
  };

  return (
    <Modal
      title={`编辑考勤状态 - ${userName} (${date})`}
      open={visible}
      onOk={handleSave}
      onCancel={onClose}
      okText="保存"
      cancelText="取消"
      width={500}
      footer={
        <Space className="w-full justify-between">
          {onQuickSetUnselected && (
            <Button danger onClick={handleQuickSetUnselected}>
              设为未选择
            </Button>
          )}
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" onClick={handleSave}>
              保存
            </Button>
          </Space>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="考勤状态"
          name="status"
          rules={[{ required: true, message: "请选择考勤状态" }]}
        >
          <Select
            options={statusOptions}
            optionRender={(option) => (
              <Space>
                <Tag color={option.data.color}>{option.data.label}</Tag>
              </Space>
            )}
          />
        </Form.Item>

        {/* 迟到 - 输入迟到分钟 */}
        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) =>
            prevValues.status !== currentValues.status
          }
        >
          {({ getFieldValue }) =>
            getFieldValue("status") === "late" ? (
              <Form.Item
                label="迟到时间（分钟）"
                name="lateMinutes"
                rules={[{ required: true, message: "请输入迟到分钟数" }]}
              >
                <InputNumber
                  min={1}
                  max={480}
                  className="w-full"
                  placeholder="例如: 30"
                />
              </Form.Item>
            ) : null
          }
        </Form.Item>

        {/* 早退 - 输入几点早退 */}
        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) =>
            prevValues.status !== currentValues.status
          }
        >
          {({ getFieldValue }) =>
            getFieldValue("status") === "earlyLeave" ? (
              <Form.Item
                label="早退时间"
                name="earlyLeaveTime"
                rules={[{ required: true, message: "请选择早退时间" }]}
              >
                <TimePicker
                  className="w-full"
                  format="HH:mm"
                  placeholder="选择早退时间"
                />
              </Form.Item>
            ) : null
          }
        </Form.Item>

        {/* 加班 - 输入加班分钟 */}
        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) =>
            prevValues.status !== currentValues.status
          }
        >
          {({ getFieldValue }) =>
            getFieldValue("status") === "overtime" ? (
              <Form.Item
                label="加班时间（分钟）"
                name="overtimeMinutes"
                rules={[{ required: true, message: "请输入加班分钟数" }]}
              >
                <InputNumber
                  min={1}
                  max={720}
                  className="w-full"
                  placeholder="例如: 120"
                />
              </Form.Item>
            ) : null
          }
        </Form.Item>

        {/* 半天请假 - 输入时间段 */}
        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) =>
            prevValues.status !== currentValues.status
          }
        >
          {({ getFieldValue }) =>
            getFieldValue("status") === "halfDayLeave" ? (
              <>
                <Form.Item
                  label="请假开始时间"
                  name="leaveStart"
                  rules={[{ required: true, message: "请选择开始时间" }]}
                >
                  <TimePicker
                    className="w-full"
                    format="HH:mm"
                    placeholder="开始时间"
                  />
                </Form.Item>
                <Form.Item
                  label="请假结束时间"
                  name="leaveEnd"
                  rules={[{ required: true, message: "请选择结束时间" }]}
                >
                  <TimePicker
                    className="w-full"
                    format="HH:mm"
                    placeholder="结束时间"
                  />
                </Form.Item>
              </>
            ) : null
          }
        </Form.Item>

        {/* 周末加班 - 输入时间段 */}
        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) =>
            prevValues.status !== currentValues.status
          }
        >
          {({ getFieldValue }) =>
            getFieldValue("status") === "weekendOvertime" ? (
              <>
                <Form.Item
                  label="加班开始时间"
                  name="overtimeStart"
                  rules={[{ required: true, message: "请选择开始时间" }]}
                >
                  <TimePicker
                    className="w-full"
                    format="HH:mm"
                    placeholder="开始时间"
                  />
                </Form.Item>
                <Form.Item
                  label="加班结束时间"
                  name="overtimeEnd"
                  rules={[{ required: true, message: "请选择结束时间" }]}
                >
                  <TimePicker
                    className="w-full"
                    format="HH:mm"
                    placeholder="结束时间"
                  />
                </Form.Item>
              </>
            ) : null
          }
        </Form.Item>
      </Form>
    </Modal>
  );
}

// 薪资计算弹窗组件
function SalaryModal({
  visible,
  onClose,
  record,
  currentDate,
}: SalaryModalProps) {
  const [form] = Form.useForm();
  const [employeeType, setEmployeeType] = useState<"fulltime" | "intern">(
    "fulltime"
  );
  const [salary, setSalary] = useState<number>(0);

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
          overtimeHours +=
            calculateMinutes(detail.overtimeStart, detail.overtimeEnd) / 60;
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
        }
      }
    }

    return { presentDays, overtimeHours, leaveHours };
  };

  const stats = calculateAttendanceStats();

  // 计算薪资
  const calculateSalary = () => {
    const monthlySalary = form.getFieldValue("monthlySalary");
    const dailySalary = form.getFieldValue("dailySalary");

    if (employeeType === "fulltime") {
      // 全职: (在(天)/21.75) * 月工资
      if (!monthlySalary) return 0;
      return (stats.presentDays / 21.75) * monthlySalary;
    } else {
      // 实习生: 在(天)*日薪 + (加班h/7)*1.5*日薪 - (请假h/7)*日薪
      if (!dailySalary) return 0;
      const workDaySalary = stats.presentDays * dailySalary;
      const overtimePay = (stats.overtimeHours / 7) * 1.5 * dailySalary;
      const leaveDeduct = (stats.leaveHours / 7) * dailySalary;
      return workDaySalary + overtimePay - leaveDeduct;
    }
  };

  const handleEmployeeTypeChange = (value: "fulltime" | "intern") => {
    setEmployeeType(value);
    setSalary(0);
    form.resetFields();
  };

  const handleCalculate = () => {
    form.validateFields().then(() => {
      const calculatedSalary = calculateSalary();
      setSalary(calculatedSalary);
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
              <div>薪资 = (在岗天数 / 21.75) × 月工资</div>
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
          {salary > 0 && (
            <div className="mt-4 p-4 bg-[#e6f7ff] border-2 border-[#1890ff] rounded text-center">
              <div className="text-sm text-[#666] mb-1">计算结果</div>
              <div className="text-3xl font-bold text-[#1890ff]">
                ¥ {salary.toFixed(2)}
              </div>
            </div>
          )}
        </Form>
      </div>
    </Modal>
  );
}

export default function AttendancePage() {
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [dataSource, setDataSource] = useState<AttendanceRecord[]>([]);
  const [columns, setColumns] = useState<ColumnsType<AttendanceRecord>>([]);
  const [loading, setLoading] = useState(false);
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

  // 模拟用户数据
  const mockUsers: User[] = [
    { id: "1", name: "张三", department: "技术部" },
    { id: "2", name: "李四", department: "市场部" },
    { id: "3", name: "王五", department: "财务部" },
    { id: "4", name: "赵六", department: "技术部" },
    { id: "5", name: "钱七", department: "市场部" },
    { id: "6", name: "孙八", department: "人事部" },
    { id: "7", name: "周九", department: "技术部" },
    { id: "8", name: "吴十", department: "财务部" },
  ];

  // 生成考勤状态
  const generateAttendanceDetail = (): AttendanceDetail => {
    const random = Math.random();
    if (random < 0.3) return { status: "unselected" };
    if (random < 0.6) return { status: "normal" };
    if (random < 0.7)
      return {
        status: "late",
        lateMinutes: Math.floor(Math.random() * 60) + 10,
      };
    if (random < 0.75) return { status: "earlyLeave", earlyLeaveTime: "17:30" };
    if (random < 0.8)
      return {
        status: "overtime",
        overtimeMinutes: Math.floor(Math.random() * 180) + 60,
      };
    if (random < 0.85) return { status: "fullDayLeave" };
    if (random < 0.9)
      return { status: "halfDayLeave", leaveStart: "14:00", leaveEnd: "18:00" };
    return {
      status: "weekendOvertime",
      overtimeStart: "09:00",
      overtimeEnd: "18:00",
    };
  };

  // 获取状态显示信息
  const getStatusDisplay = (
    detail: AttendanceDetail | string
  ): { color: string; text: string } => {
    // 确保detail是对象类型
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

    // 添加详细信息
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

  // 处理单元格点击 - 使用useCallback避免闭包问题
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
    }
  };

  // 批量设置整列状态 - 使用函数式更新避免闭包问题
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
    },
    [currentDate]
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
            // 将该员工的所有日期设为未选择
            for (let day = 1; day <= daysInMonth; day++) {
              item[`day_${day}`] = { status: "unselected" };
            }
          });
        });

        setDataSource(newData);
        message.success("已将所有考勤数据设为未选择");
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
          // 计算半天请假的时间段内的工作时间
          totalMinutes += calculateWorkHours(
            detail.leaveStart,
            detail.leaveEnd
          );
        } else if (detail.status === "earlyLeave" && detail.earlyLeaveTime) {
          // 计算早退时间到下班时间(18:00)的工作时间
          totalMinutes += calculateWorkHours(
            detail.earlyLeaveTime,
            WORK_END_AFTERNOON
          );
        }
      }
    }

    return Math.round((totalMinutes / 60) * 10) / 10; // 保留1位小数
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
          // 平日加班
          totalMinutes += detail.overtimeMinutes;
        } else if (
          detail.status === "weekendOvertime" &&
          detail.overtimeStart &&
          detail.overtimeEnd
        ) {
          // 周末加班 - 计算总时间
          totalMinutes += calculateMinutes(
            detail.overtimeStart,
            detail.overtimeEnd
          );
        }
      }
    }

    return Math.round((totalMinutes / 60) * 10) / 10; // 保留1位小数
  };

  // 生成表格列和日期列 - 使用useCallback避免闭包问题
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

        // 创建批量设置菜单
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

            // 确保detail是对象类型
            const attendanceDetail: AttendanceDetail =
              typeof detail === "string" ? { status: detail } : detail;

            // 判断是否为请假状态（全天请假或半天请假）
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

  // 生成表格数据
  const generateData = (date: Dayjs) => {
    const daysInMonth = date.daysInMonth();

    return mockUsers.map((user) => {
      const record: AttendanceRecord = {
        key: user.id,
        userId: user.id,
        name: user.name,
      };

      // 为每一天生成考勤状态
      for (let day = 1; day <= daysInMonth; day++) {
        record[`day_${day}`] = generateAttendanceDetail();
      }

      return record;
    });
  };

  // 加载数据
  const loadData = (date: Dayjs) => {
    setLoading(true);
    setTimeout(() => {
      const newColumns = generateColumns(date);
      const newData = generateData(date);
      setColumns(newColumns);
      setDataSource(newData);
      setLoading(false);
    }, 300);
  };

  // 切换月份
  const handlePrevMonth = () => {
    const newDate = currentDate.subtract(1, "month");
    setCurrentDate(newDate);
    loadData(newDate);
  };

  const handleNextMonth = () => {
    const newDate = currentDate.add(1, "month");
    setCurrentDate(newDate);
    loadData(newDate);
  };

  const handleDateChange = (date: Dayjs | null) => {
    if (date) {
      setCurrentDate(date);
      loadData(date);
    }
  };

  // 初始化
  useEffect(() => {
    loadData(currentDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 导出考勤数据为 JSON 文件
  const handleExport = () => {
    const daysInMonth = currentDate.daysInMonth();

    // 构建导出数据结构
    const exportData = {
      monthDisplay: currentDate.format("YYYY年MM月"),
      year: currentDate.year(),
      monthValue: currentDate.month() + 1,
      exportTime: dayjs().format("YYYY-MM-DD HH:mm:ss"),
      employees: dataSource.map((record) => {
        const attendance: Record<string, AttendanceDetail> = {};
        let presentDays = 0;

        // 遍历每一天的考勤数据
        for (let day = 1; day <= daysInMonth; day++) {
          const detail = record[`day_${day}`] as AttendanceDetail;
          if (detail && typeof detail === "object") {
            const dateKey =
              currentDate.format("YYYY-MM") +
              `-${day.toString().padStart(2, "0")}`;
            attendance[dateKey] = detail;

            // 统计数据
            if (
              detail.status === "normal" ||
              detail.status === "late" ||
              detail.status === "earlyLeave" ||
              detail.status === "overtime" ||
              detail.status === "halfDayLeave"
            ) {
              presentDays++;
            }
          }
        }

        return {
          id: record.userId,
          name: record.name,
          attendance,
          statistics: {
            presentDays,
            leaveHours: calculateLeaveHours(record, daysInMonth),
            overtimeHours: calculateOvertimeHours(record, daysInMonth),
          },
        };
      }),
    };

    // 转换为 JSON 字符串
    const jsonString = JSON.stringify(exportData, null, 2);

    // 创建 Blob 对象
    const blob = new Blob([jsonString], { type: "application/json" });

    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `考勤数据_${currentDate.format("YYYYMM")}.json`;

    // 触发下载
    document.body.appendChild(link);
    link.click();

    // 清理
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    message.success(
      `考勤数据已导出: 考勤数据_${currentDate.format("YYYYMM")}.json`
    );
  };

  // 导入 JSON 文件
  const handleImport = (file: File) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text) as AttendanceData;

        // 验证数据结构
        if (!data.employees || !Array.isArray(data.employees)) {
          message.error("JSON 文件格式错误: 缺少 employees 数组");
          return;
        }

        // 解析年月信息
        let targetDate = currentDate;
        if (data.year && data.monthValue) {
          targetDate = dayjs()
            .year(data.year)
            .month(data.monthValue - 1);
          setCurrentDate(targetDate);
        } else if (data.monthDisplay) {
          // 尝试从显示格式解析
          const match = data.monthDisplay.match(/(\d{4})年(\d{2})月/);
          if (match) {
            targetDate = dayjs()
              .year(parseInt(match[1]))
              .month(parseInt(match[2]) - 1);
            setCurrentDate(targetDate);
          }
        }

        // 转换数据为表格格式
        const daysInMonth = targetDate.daysInMonth();
        const newData: AttendanceRecord[] = data.employees.map((emp) => {
          const record: AttendanceRecord = {
            key: emp.id,
            userId: emp.id,
            name: emp.name,
          };

          // 填充每日考勤数据
          if (emp.attendance && typeof emp.attendance === "object") {
            Object.keys(emp.attendance).forEach((dateKey) => {
              // 从日期字符串中提取日期 (格式: YYYY-MM-DD)
              const dayMatch = dateKey.match(/-(\d{2})$/);
              if (dayMatch) {
                const day = parseInt(dayMatch[1], 10);
                record[`day_${day}`] = emp.attendance[dateKey];
              }
            });
          }

          // 填充未设置的日期为 unselected
          for (let day = 1; day <= daysInMonth; day++) {
            if (!record[`day_${day}`]) {
              record[`day_${day}`] = { status: "unselected" };
            }
          }

          return record;
        });

        setDataSource(newData);

        // 重新生成列
        const newColumns = generateColumns(targetDate);
        setColumns(newColumns);

        message.success(`成功导入 ${data.employees.length} 名员工的考勤数据`);
      } catch (error) {
        console.error("导入错误:", error);
        message.error("JSON 文件解析失败，请检查文件格式");
      }
    };

    reader.readAsText(file);

    // 返回 false 阻止自动上传
    return false;
  };

  // 导入飞书 CSV 文件（使用 utils 中的解析工具）
  const handleImportFeishuCSV = async (file: File) => {
    try {
      message.loading({ content: "正在解析 CSV 文件...", key: "csvImport" });

      // 将文件转换为文本
      const text = await file.text();

      // 创建临时文件路径（用于 parseAttendanceCSV）
      // 注意：由于浏览器环境限制，我们需要模拟文件读取
      // 这里直接解析 CSV 内容而不使用文件路径

      // 解析 CSV 行（复用 util.ts 中的 parseCSVLine 逻辑）
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
        message.error({
          content: "CSV 文件格式不正确，至少需要3行数据",
          key: "csvImport",
        });
        return false;
      }

      // 解析表头
      const header = parseCSVLine(lines[0]);
      const header2 = parseCSVLine(lines[1]);

      // 找到"每日考勤结果"列的起始位置
      let dailyStartIndex = header.findIndex((h) => h.includes("每日考勤结果"));
      if (dailyStartIndex === -1) {
        dailyStartIndex = 41;
      }

      // 解析日期信息
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

      // 解析员工数据
      const parsedRecords: import("@/utils/util").AttendanceRecord[] = [];

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

      // 从第一个日期推断年月
      let targetDate = currentDate;
      if (dates.length > 0 && dates[0].date) {
        const dateMatch = dates[0].date.match(/(\d{4})-(\d{2})/);
        if (dateMatch) {
          const year = parseInt(dateMatch[1]);
          const month = parseInt(dateMatch[2]);
          targetDate = dayjs()
            .year(year)
            .month(month - 1);
          setCurrentDate(targetDate);
        }
      }

      // 使用 convertToTargetFormat 转换数据
      const convertedData = convertToTargetFormat(
        parsedRecords,
        targetDate.year(),
        targetDate.month() + 1
      );

      // 转换为表格格式
      const daysInMonth = targetDate.daysInMonth();
      const newData: AttendanceRecord[] = convertedData.employees.map((emp) => {
        const record: AttendanceRecord = {
          key: emp.id,
          userId: emp.id,
          name: emp.name,
        };

        // 填充每日考勤数据
        if (emp.attendance && typeof emp.attendance === "object") {
          Object.keys(emp.attendance).forEach((dateKey) => {
            const dayMatch = dateKey.match(/-(\d{2})$/);
            if (dayMatch) {
              const day = parseInt(dayMatch[1], 10);
              record[`day_${day}`] = emp.attendance[dateKey];
            }
          });
        }

        // 填充未设置的日期为 unselected
        for (let day = 1; day <= daysInMonth; day++) {
          if (!record[`day_${day}`]) {
            record[`day_${day}`] = { status: "unselected" };
          }
        }

        return record;
      });

      setDataSource(newData);

      // 重新生成列
      const newColumns = generateColumns(targetDate);
      setColumns(newColumns);

      message.success({
        content: `成功从飞书 CSV 导入 ${newData.length} 名员工的考勤数据`,
        key: "csvImport",
        duration: 3,
      });
    } catch (error) {
      console.error("飞书 CSV 导入错误:", error);
      message.error({
        content: "CSV 文件解析失败，请检查文件格式",
        key: "csvImport",
      });
    }

    return false;
  };

  return (
    <div>
      <div className="flex justify-between items-center px-4">
        <Title level={2}>飞书考勤管理</Title>

        <Space>
          <Button icon={<LeftOutlined />} onClick={handlePrevMonth}>
            上月
          </Button>

          <DatePicker
            picker="month"
            value={currentDate}
            onChange={handleDateChange}
            format="YYYY年MM月"
            className="w-36"
          />

          <Button icon={<RightOutlined />} onClick={handleNextMonth}>
            下月
          </Button>

          <Button danger onClick={handleSetAllUnselected}>
            全部设为未选择
          </Button>

          <Upload
            accept=".json"
            showUploadList={false}
            beforeUpload={handleImport}
          >
            <Button icon={<UploadOutlined />}>导入JSON</Button>
          </Upload>

          <Upload
            accept=".csv"
            showUploadList={false}
            beforeUpload={handleImportFeishuCSV}
          >
            <Button icon={<UploadOutlined />}>导入飞书CSV</Button>
          </Upload>

          <Button type="primary" onClick={handleExport}>
            导出数据
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
