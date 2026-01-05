"use client";

import { useState, useEffect } from "react";
import { Modal, List, Tag, Space, Button, message, Popconfirm, Typography } from "antd";
import { DeleteOutlined, HistoryOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const { Text } = Typography;

interface HistoryRecord {
  id: string;
  monthDisplay: string;
  year: number;
  monthValue: number;
  importTime: string;
  employeeCount: number;
}

interface HistoryModalProps {
  visible: boolean;
  onClose: () => void;
  onLoadHistory: (recordId: string) => Promise<void>;
  currentRecordId?: string | null;
}

export default function HistoryModal({
  visible,
  onClose,
  onLoadHistory,
  currentRecordId,
}: HistoryModalProps) {
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistoryRecords = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/history");
      if (!response.ok) throw new Error("获取历史记录失败");
      const data = await response.json();
      setHistoryRecords(data.records || []);
    } catch (error) {
      console.error("加载历史记录失败:", error);
      message.error("加载历史记录失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadHistoryRecords();
    }
  }, [visible]);

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

  const handleDelete = async (recordId: string) => {
    try {
      const response = await fetch(`/api/history?id=${recordId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "删除失败");
      }

      message.success("删除成功");
      // 重新加载列表
      loadHistoryRecords();
    } catch (error) {
      console.error("删除失败:", error);
      message.error("删除失败，请重试");
    }
  };

  const isCurrentRecord = (recordId: string) => {
    return recordId === currentRecordId;
  };

  return (
    <Modal
      title="历史记录管理"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={700}
    >
      {loading ? (
        <div className="text-center py-8 text-gray-500">加载中...</div>
      ) : historyRecords.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          暂无历史记录
        </div>
      ) : (
        <List
          dataSource={historyRecords}
          renderItem={(item) => (
            <List.Item
              actions={[
                isCurrentRecord(item.id) ? (
                  <Tag color="green">当前记录</Tag>
                ) : (
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => handleLoadHistory(item.id)}
                    disabled={loading}
                  >
                    加载
                  </Button>
                ),
                !isCurrentRecord(item.id) && (
                  <Popconfirm
                    title="确认删除"
                    description="确定要删除这条历史记录吗？"
                    onConfirm={() => handleDelete(item.id)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      disabled={loading}
                    >
                      删除
                    </Button>
                  </Popconfirm>
                ),
              ].filter(Boolean)}
            >
              <List.Item.Meta
                avatar={<HistoryOutlined style={{ fontSize: 24 }} />}
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
    </Modal>
  );
}
