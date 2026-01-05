"use client";

import { useState, useEffect } from "react";
import { Modal, Upload, Button, List, Tag, Space, message, Typography } from "antd";
import { UploadOutlined, HistoryOutlined } from "@ant-design/icons";
import type { UploadProps } from "antd";
import dayjs from "dayjs";
import type { AttendanceRecord } from "@/types/attendance";

const { Text } = Typography;

interface HistoryRecord {
  id: string;
  monthDisplay: string;
  year: number;
  monthValue: number;
  importTime: string;
  employeeCount: number;
}

interface InitialImportModalProps {
  visible: boolean;
  onClose: () => void;
  onImportCSV: (file: File) => Promise<AttendanceRecord[]>;
  onLoadHistory: (recordId: string) => Promise<void>;
}

export default function InitialImportModal({
  visible,
  onClose,
  onImportCSV,
  onLoadHistory,
}: InitialImportModalProps) {
  const [loading, setLoading] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // 加载历史记录
  const loadHistoryRecords = async () => {
    try {
      setLoadingHistory(true);
      const response = await fetch("/api/history");
      if (!response.ok) throw new Error("获取历史记录失败");
      const data = await response.json();
      setHistoryRecords(data.records || []);
    } catch (error) {
      console.error("加载历史记录失败:", error);
      // 不显示错误消息，可能是首次使用
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadHistoryRecords();
    }
  }, [visible]);

  const handleUpload: UploadProps["customRequest"] = async (options) => {
    const { file } = options;
    try {
      setLoading(true);
      message.loading({ content: "正在解析 CSV 文件...", key: "csvImport" });

      const records = await onImportCSV(file as File);

      message.success({
        content: `成功导入 ${records.length} 名员工的考勤数据`,
        key: "csvImport",
        duration: 2,
      });

      setTimeout(() => onClose(), 1000);
    } catch (error) {
      console.error("CSV导入错误:", error);
      message.error({
        content: "CSV 文件解析失败，请检查文件格式",
        key: "csvImport",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLoadHistory = async (recordId: string) => {
    try {
      setLoading(true);
      await onLoadHistory(recordId);
      message.success("历史记录加载成功");
      onClose();
    } catch (error) {
      console.error("加载历史记录失败:", error);
      message.error("加载历史记录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="欢迎使用考勤管理系统"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={700}
      closable={false}
      maskClosable={false}
    >
      <div className="space-y-6">
        {/* 导入CSV区域 */}
        <div>
          <div className="text-lg font-bold mb-3">
            <UploadOutlined className="mr-2" />
            导入飞书考勤CSV
          </div>
          <Upload
            accept=".csv"
            showUploadList={false}
            customRequest={handleUpload}
            disabled={loading}
          >
            <Button
              type="primary"
              icon={<UploadOutlined />}
              size="large"
              loading={loading}
              block
            >
              点击上传CSV文件
            </Button>
          </Upload>
          <div className="mt-2 text-xs text-gray-500">
            请上传从飞书导出的考勤CSV文件，系统将自动解析并保存
          </div>
        </div>

        {/* 或分割线 */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">或</span>
          </div>
        </div>

        {/* 历史记录区域 */}
        <div>
          <div className="text-lg font-bold mb-3">
            <HistoryOutlined className="mr-2" />
            加载历史记录
          </div>
          {loadingHistory ? (
            <div className="text-center py-8 text-gray-500">加载中...</div>
          ) : historyRecords.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              暂无历史记录，请先导入CSV文件
            </div>
          ) : (
            <List
              dataSource={historyRecords}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button
                      type="link"
                      onClick={() => handleLoadHistory(item.id)}
                      disabled={loading}
                    >
                      加载
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text strong>{item.monthDisplay}</Text>
                        <Tag color="blue">{item.employeeCount}人</Tag>
                      </Space>
                    }
                    description={`导入时间：${dayjs(item.importTime).format("YYYY-MM-DD HH:mm:ss")}`}
                  />
                </List.Item>
              )}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
