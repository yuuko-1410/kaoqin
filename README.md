# 考勤管理系统

一个功能完善的员工考勤管理系统，支持考勤记录、数据导入导出、薪资计算等功能。

## 功能特性

### 📊 核心功能

- **考勤记录管理**
  - 支持按月查看员工考勤记录
  - 可视化日历表格展示
  - 8种考勤状态：未选择、正常、迟到、早退、加班、全天请假、半天请假、周末加班
  - 点击单元格可快速编辑考勤状态
  - 请假状态（全天/半天请假）红色高亮显示

- **批量操作**
  - 批量设置整列考勤状态
  - 一键将所有数据设为未选择
  - 支持按日期快速批量设置

- **数据导入导出**
  - 导出考勤数据为 JSON 文件
  - 导入 JSON 文件恢复数据
  - 支持导入飞书 CSV 格式考勤数据
  - 自动解析飞书考勤数据格式

- **薪资计算**
  - 支持全职和实习生两种员工类型
  - **全职计算公式**: `(在岗天数 / 21.75) × 月工资`
  - **实习生计算公式**: `在岗天数 × 日薪 + (加班小时 / 7) × 1.5 × 日薪 - (请假小时 / 7) × 日薪`
  - 自动统计在岗天数、加班小时、请假小时
  - 实时计算并显示薪资结果

- **数据统计**
  - 在岗天数统计
  - 请假小时统计
  - 加班小时统计（平日加班 + 周末加班）

### 🎨 用户界面

- 基于 Ant Design 的现代化 UI 设计
- Tailwind CSS 样式系统
- 响应式布局，支持横向滚动
- 直观的颜色编码和标签系统
- 弹窗式编辑体验

## 技术栈

- **框架**: Next.js 16 (App Router)
- **UI 库**: Ant Design 6
- **样式**: Tailwind CSS 4
- **状态管理**: React Hooks + Immer
- **日期处理**: Day.js
- **语言**: TypeScript
- **运行时**: Bun

## 安装和运行

### 环境要求

- Node.js 18+ 或 Bun
- npm / yarn / pnpm / bun

### 安装依赖

```bash
bun install
# 或
npm install
# 或
yarn install
# 或
pnpm install
```

### 开发模式

```bash
bun dev
# 或
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

### 生产构建

```bash
bun run build
bun start
# 或
npm run build
npm start
```

## 使用指南

### 考勤状态说明

| 状态 | 标签 | 说明 |
|------|------|------|
| 未选择 | `-` | 未设置考勤状态 |
| 正常 | `✓` | 正常出勤 |
| 迟到 | `迟` | 迟到（可记录迟到分钟数） |
| 早退 | `退` | 早退（可记录早退时间） |
| 加班 | `加` | 平日加班（可记录加班分钟数） |
| 全天请假 | `假` | 全天请假 |
| 半天请假 | `半` | 半天请假（可设置请假时间段） |
| 周末加班 | `周` | 周末加班（可设置加班时间段） |

### 工作时间配置

系统默认工作时间：
- 上午：09:00 - 11:30
- 下午：13:30 - 18:00

### 数据导入格式

#### JSON 格式

系统导出的 JSON 格式包含以下字段：

```json
{
  "monthDisplay": "2025年01月",
  "year": 2025,
  "monthValue": 1,
  "exportTime": "2025-01-15 10:30:00",
  "employees": [
    {
      "id": "1",
      "name": "张三",
      "attendance": {
        "2025-01-01": {
          "status": "normal"
        },
        "2025-01-02": {
          "status": "late",
          "lateMinutes": 30
        }
      },
      "statistics": {
        "presentDays": 20,
        "leaveHours": 4,
        "overtimeHours": 8
      }
    }
  ]
}
```

#### 飞书 CSV 格式

支持导入飞书导出的考勤 CSV 文件，系统会自动：
- 解析 CSV 表头和日期信息
- 提取员工考勤记录
- 转换考勤状态（正常、迟到、早退、请假、加班等）
- 计算加班时长和请假时长

### 薪资计算说明

#### 全职员工

计算公式：
```
薪资 = (在岗天数 / 21.75) × 月工资
```

- **在岗天数**: 正常出勤 + 迟到 + 早退 + 加班 + 半天请假的天数
- **21.75**: 月平均工作天数（按国家规定）

#### 实习生

计算公式：
```
薪资 = 在岗天数 × 日薪 + (加班小时 / 7) × 1.5 × 日薪 - (请假小时 / 7) × 日薪
```

- **在岗天数 × 日薪**: 基础工资
- **加班补贴**: 加班小时按 1.5 倍日薪计算（除以 7 转换为工作日）
- **请假扣除**: 请假小时按日薪扣除（除以 7 转换为工作日）

## 项目结构

```
kaoqin/
├── app/
│   ├── layout.tsx          # 根布局
│   └── page.tsx            # 主页面（考勤管理界面）
├── utils/
│   ├── util.ts             # CSV 解析工具
│   └── parse.ts            # 数据转换工具
├── public/                 # 静态资源
├── package.json            # 项目配置
└── tsconfig.json           # TypeScript 配置
```

## 核心模块说明

### 数据模型

```typescript
interface AttendanceDetail {
  status: string;                    // 考勤状态
  lateMinutes?: number;             // 迟到分钟数
  earlyLeaveTime?: string;          // 早退时间
  overtimeMinutes?: number;         // 平日加班分钟数
  overtimeStart?: string;           // 周末加班开始时间
  overtimeEnd?: string;             // 周末加班结束时间
  leaveStart?: string;              // 请假开始时间
  leaveEnd?: string;                // 请假结束时间
}

interface AttendanceRecord {
  key: string;                      // 唯一标识
  userId: string;                   // 用户ID
  name: string;                     // 姓名
  [key: string]: AttendanceDetail | string;  // 动态日期字段
}
```

### 工具函数

- `calculateMinutes(start, end)`: 计算两个时间之间的分钟数
- `calculateWorkHours(start, end)`: 计算工作时间内的时间段
- `parseAttendanceCSV(filePath)`: 解析飞书 CSV 文件
- `convertToTargetFormat(records, year, month)`: 转换为目标格式

## 开发说明

### 代码规范

- 使用 TypeScript 进行类型检查
- 遵循 ESLint 规范
- 使用 Tailwind CSS 类名（避免内联样式）
- 使用 Immer 进行不可变状态更新

### 可用脚本

```bash
bun dev          # 启动开发服务器
bun build        # 构建生产版本
bun start        # 启动生产服务器
bun lint         # 运行 ESLint 检查
```

## 常见问题

### Q: 如何批量设置某一天所有员工的考勤状态？

A: 点击表格日期列标题的下拉菜单，选择要设置的状态即可。

### Q: 导入飞书 CSV 后数据不对怎么办？

A: 确保 CSV 文件是从飞书考勤系统导出的原始格式，包含两行表头（第一行为"每日考勤结果"，第二行为日期）。

### Q: 薪资计算的结果准确吗？

A: 薪资计算基于考勤统计数据。请确保：
- 考勤记录准确无误
- 请假时间段设置正确
- 加班时长记录完整

### Q: 如何备份数据？

A: 点击"导出数据"按钮，系统会生成 JSON 文件，保存该文件即可。需要恢复时使用"导入JSON"功能。

## 未来规划

- [ ] 支持多部门管理
- [ ] 增加考勤规则配置
- [ ] 支持自定义薪资计算公式
- [ ] 添加数据统计图表
- [ ] 支持导出 Excel 格式
- [ ] 添加用户权限管理
- [ ] 支持移动端访问

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

---

**注意**: 本系统为内部考勤管理工具，请根据实际需求调整计算公式和工作时间配置。
