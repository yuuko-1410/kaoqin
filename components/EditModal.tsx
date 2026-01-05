"use client";

import { useEffect } from "react";
import { Modal, Form, InputNumber, TimePicker, Select, Button, Space, Tag } from "antd";
import dayjs from "dayjs";
import type { AttendanceDetail } from "@/types/attendance";

interface EditModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (detail: AttendanceDetail) => void;
  currentDetail: AttendanceDetail;
  userName: string;
  date: string;
  onQuickSetUnselected?: () => void;
}

// 工作时间常量
const WORK_START_MORNING = "09:00";
const WORK_END_MORNING = "11:30";
const WORK_START_AFTERNOON = "13:30";
const WORK_END_AFTERNOON = "18:00";

export default function EditModal({
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
      isFullDayWeekendOvertime: currentDetail.isFullDayWeekendOvertime || false,
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
        detail.isFullDayWeekendOvertime =
          values.isFullDayWeekendOvertime || false;
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
                {/* @ts-ignore */}
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
                  label="是否全天加班（≥7小时）"
                  name="isFullDayWeekendOvertime"
                  valuePropName="checked"
                >
                  <Select
                    options={[
                      { label: "否（按实际小时计算）", value: false },
                      { label: "是（按7小时+超出18:00部分计算）", value: true },
                    ]}
                  />
                </Form.Item>
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
