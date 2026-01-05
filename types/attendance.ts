export interface AttendanceDetail {
  status: string;
  lateMinutes?: number;
  earlyLeaveTime?: string;
  overtimeMinutes?: number;
  leaveStart?: string;
  leaveEnd?: string;
  overtimeStart?: string;
  overtimeEnd?: string;
  isFullDayWeekendOvertime?: boolean;
}

export interface AttendanceRecord {
  key: string;
  userId: string;
  name: string;
  [key: string]: AttendanceDetail | string;
}

export interface User {
  id: string;
  name: string;
  department: string;
}
