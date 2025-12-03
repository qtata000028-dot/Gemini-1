import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, LayoutDashboard, Settings, Menu, Table as TableIcon,
  Save, Filter, ArrowRight, Calendar as CalendarIcon, X, Maximize2,
  Minimize2, Sparkles, Bot, Loader2, Edit3, Code
} from 'lucide-react';

import { MasterRow, DetailRow, ColumnDef, DevDocs } from './types';
import { generateDailyReport, generateSmartFill } from './services/geminiService';
import { DevHotspot } from './components/DevHotspot';
import { MasterGrid } from './components/MasterGrid';

// --- Static Data & Helpers ---

const devDocs: DevDocs = {
  sidebar: {
    title: "A. 全局布局与状态",
    techStack: "Flexbox + React State",
    desc: "控制主视图区域。'全屏模式' 会切换侧边栏的渲染条件。"
  },
  toolbar: {
    title: "B. 控制中心",
    techStack: "Event Handlers + API Triggers",
    desc: [
      "1. 日期控制: 触发重新生成动态列。",
      "2. 视图切换: 在每日/每周聚合策略之间切换。",
      "3. AI 分析: 将当前网格状态发送到 Gemini 2.5 Flash 进行总结。"
    ]
  },
  masterGrid: {
    title: "C. 主排程表格",
    techStack: "Sticky Positioning + Virtualization Concepts",
    desc: [
      "1. 多列冻结: 计算 `left` 偏移量，确保序号、代码、产品和车间列固定。",
      "2. 可视化甘特图: `getLastActiveIndex` 动态应用渐变样式。",
      "3. 渲染优化: 使用只读单元格以提高性能。"
    ]
  },
  detailGrid: {
    title: "D. BOM 明细视图",
    techStack: "Master-Detail Linkage",
    desc: "依赖数据获取。当选择主行时，此组件接收新属性并重新渲染物料列表。"
  },
  rightPanel: {
    title: "E. 智能编辑面板",
    techStack: "useMemo + Immutable Updates",
    desc: [
      "1. 反透视 (Unpivoting): 将横向日期键转换为纵向编辑列表。",
      "2. Gemini 智能填充: 自然语言处理将 '未来3天填充100' 转换为 JSON 指令。"
    ]
  }
};

const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getWeekday = (date: Date) => {
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return '周' + weekdays[date.getDay()];
};

const getWeekNumber = (d: Date) => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
};

// --- Mock Generators ---

const generateMasterData = (rowCount: number): MasterRow[] => {
  return Array.from({ length: rowCount }).map((_, i) => ({
    id: i + 1,
    code: `MPS-2405-${String(i + 1).padStart(3, '0')}`,
    productName: i % 2 === 0 ? '伺服电机 X系列 ' + i : '控制模组 Y代 ' + i,
    workshop: i % 3 === 0 ? '一车间' : 'SMT线',
    status: i % 4 === 0 ? '待排' : '生产中',
    planData: {} 
  }));
};

const generateDetailData = (masterId: number): DetailRow[] => {
  if (!masterId) return [];
  const count = Math.floor(Math.random() * 4) + 2;
  return Array.from({ length: count }).map((_, i) => ({
    id: `D-${masterId}-${i}`,
    materialCode: `MAT-${masterId}-${100+i}`,
    materialName: `零部件 ${String.fromCharCode(65 + i)}-${masterId}`,
    unit: '个',
    requiredQty: Math.floor(Math.random() * 100) + 10,
    inventory: Math.floor(Math.random() * 50)
  }));
};

// --- Main Component ---

export default function App() {
  const [searchDate, setSearchDate] = useState(formatDate(new Date()));
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day'); 
  const [masterData, setMasterData] = useState<MasterRow[]>([]);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<DetailRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);

  // AI State
  const [showAiReportModal, setShowAiReportModal] = useState(false);
  const [aiReportContent, setAiReportContent] = useState('');
  const [isAiReporting, setIsAiReporting] = useState(false);
  const [aiFillPrompt, setAiFillPrompt] = useState('');
  const [isAiFilling, setIsAiFilling] = useState(false);
  
  const [columns, setColumns] = useState<ColumnDef[]>([]);

  // --- Logic ---

  const generateColumns = useCallback((baseDateStr: string, mode: 'day' | 'week') => {
    const cols: ColumnDef[] = [];
    const startDate = new Date(baseDateStr);
    const daysToGenerate = 90; 

    if (mode === 'day') {
      for (let i = 0; i < daysToGenerate; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        const dateStr = formatDate(d);
        cols.push({
          key: dateStr,
          topHeader: dateStr,
          bottomHeader: getWeekday(d),
          type: 'day',
          dateObj: d
        });
      }
    } else {
      const tempWeekMap = new Map<string, ColumnDef>();
      for (let i = 0; i < daysToGenerate; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        const weekNum = getWeekNumber(d);
        const year = d.getFullYear();
        const weekKey = `${year}-W${weekNum}`;
        const dateStr = formatDate(d);

        if (!tempWeekMap.has(weekKey)) {
          tempWeekMap.set(weekKey, {
            key: weekKey,
            topHeader: `${year} 第${weekNum}周`,
            bottomHeader: '总计',
            type: 'week',
            includedDays: [] 
          });
          cols.push(tempWeekMap.get(weekKey)!);
        }
        tempWeekMap.get(weekKey)!.includedDays!.push(dateStr);
      }
    }
    return cols;
  }, []);

  const handleSearch = useCallback(() => {
    setLoading(true);
    // Simulate API fetch
    setTimeout(() => {
      const dayCols = generateColumns(searchDate, 'day');
      const data = generateMasterData(25); // More data to test scroll
      
      // Populate some random data
      data.forEach(row => {
        const startIdx = Math.floor(Math.random() * 10);
        const duration = Math.floor(Math.random() * 20) + 5;
        for (let i = startIdx; i < startIdx + duration && i < dayCols.length; i++) {
            if (Math.random() > 0.2) {
                row.planData[dayCols[i].key] = Math.floor(Math.random() * 40) + 5;
            }
        }
      });

      setMasterData(data);
      setSelectedRowId(null);
      setDetailData([]);
      setColumns(generateColumns(searchDate, viewMode));
      setLoading(false);
    }, 400);
  }, [searchDate, viewMode, generateColumns]);

  // Initial Load
  useEffect(() => {
    handleSearch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setColumns(generateColumns(searchDate, viewMode));
  }, [viewMode, searchDate, generateColumns]);

  const handleRowClick = (id: number) => {
    if (selectedRowId === id) return;
    setSelectedRowId(id);
    setDetailData(generateDetailData(id));
  };

  const handleCellChange = (rowId: number, dateKey: string, value: string) => {
    setMasterData(prevData => prevData.map(row => {
        if (row.id === rowId) {
            const newPlanData = { ...row.planData };
            if (value === '' || value === '0') {
                delete newPlanData[dateKey];
            } else {
                newPlanData[dateKey] = parseInt(value, 10) || 0;
            }
            return { ...row, planData: newPlanData };
        }
        return row;
    }));
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      alert(`成功保存 ${masterData.length} 条排产记录。`);
    }, 800);
  };

  // --- AI Handlers ---

  const handleAiReport = async () => {
    setShowAiReportModal(true);
    setAiReportContent("正在分析生产排程数据...");
    setIsAiReporting(true);

    try {
      const contextData = masterData.slice(0, 10).map(r => {
        // Explicitly type accumulator to avoid 'unknown' type error in reduce
        const total = Object.values(r.planData).reduce((a: number, b) => a + Number(b), 0);
        return `ID:${r.code}, 产品:${r.productName}, 车间:${r.workshop}, 总数量:${total}, 状态:${r.status}`;
      }).join('\n');

      const text = await generateDailyReport(contextData);
      setAiReportContent(text);
    } catch (error) {
       // handled in service, but safety catch
       setAiReportContent("生成报告出错。");
    } finally {
      setIsAiReporting(false);
    }
  };

  const handleAiSmartFill = async () => {
    if (!selectedRowId) {
      alert("请先选择一条排产计划。");
      return;
    }
    if (!aiFillPrompt.trim()) return;

    setIsAiFilling(true);
    try {
      const scheduleItems = await generateSmartFill(searchDate, aiFillPrompt);

      if (Array.isArray(scheduleItems)) {
        setMasterData(prevData => prevData.map(r => {
            if (r.id === selectedRowId) {
                const newPlanData = { ...r.planData };
                scheduleItems.forEach(item => {
                    if (item.qty === 0) {
                        delete newPlanData[item.date];
                    } else {
                        newPlanData[item.date] = item.qty;
                    }
                });
                return { ...r, planData: newPlanData };
            }
            return r;
        }));
        setAiFillPrompt('');
      }
    } catch (e) {
      alert("AI 处理失败，请尝试更简单的指令。");
    } finally {
      setIsAiFilling(false);
    }
  };

  // --- Memos ---

  const selectedRowData = useMemo(() => {
    return masterData.find(r => r.id === selectedRowId);
  }, [masterData, selectedRowId]);

  const unpivotedData = useMemo(() => {
    if (!selectedRowData) return [];
    const allDays = generateColumns(searchDate, 'day');
    return allDays
      .map(col => ({
        date: col.key,
        weekday: col.bottomHeader,
        value: selectedRowData.planData[col.key] || ''
      }))
      .filter(item => item.value !== '' && item.value !== 0); 
  }, [selectedRowData, searchDate, generateColumns]);


  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-sm text-slate-800 overflow-hidden relative selection:bg-blue-200">
      
      {/* 1. Left Sidebar */}
      {!isFullScreen && (
        <div className="w-16 bg-slate-900 flex flex-col items-center py-6 space-y-6 text-slate-400 shrink-0 z-50 shadow-xl transition-all duration-300 relative group">
          {isDevMode && <DevHotspot data={devDocs.sidebar} position="top-2 left-10" />}
          
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-900/50 mb-4">
            <LayoutDashboard size={22} />
          </div>
          <NavItem icon={<TableIcon size={20} />} active label="排产" />
          <NavItem icon={<Filter size={20} />} label="物料" />
          <NavItem icon={<Settings size={20} />} label="配置" />
          <div className="flex-1"></div>
          <NavItem icon={<Menu size={20} />} label="菜单" />
        </div>
      )}

      {/* 2. Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 bg-white border-r border-slate-200 relative z-0">
        
        {/* Toolbar */}
        <div className="h-16 bg-white border-b border-slate-200 flex items-center px-6 justify-between shrink-0 shadow-sm z-30 relative">
           {isDevMode && <DevHotspot data={devDocs.toolbar} position="top-2 left-1/2" />}

          <div className="flex items-center space-x-4">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 hover:border-slate-300 transition-colors">
               <CalendarIcon size={16} className="text-slate-400 mr-2"/>
               <input 
                type="date" 
                className="bg-transparent border-none focus:ring-0 text-sm p-0 h-5 text-slate-700 w-32 font-semibold"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
              />
            </div>
            
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button 
                onClick={() => setViewMode('day')}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all shadow-sm ${viewMode === 'day' ? 'bg-white text-blue-600 shadow' : 'text-slate-500 hover:text-slate-700 shadow-none'}`}
              >
                日视图
              </button>
              <button 
                onClick={() => setViewMode('week')}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all shadow-sm ${viewMode === 'week' ? 'bg-white text-blue-600 shadow' : 'text-slate-500 hover:text-slate-700 shadow-none'}`}
              >
                周视图
              </button>
            </div>

            <button 
              onClick={handleSearch}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 text-xs font-semibold transition-colors shadow-sm active:translate-y-0.5 shadow-blue-200"
            >
              <Search size={16} />
              <span>查询</span>
            </button>
          </div>

          <div className="flex items-center space-x-3">
            
            <button
                onClick={() => setIsDevMode(!isDevMode)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${isDevMode ? 'bg-rose-50 text-rose-600 border-rose-200 ring-2 ring-rose-100' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
            >
                <Code size={14} />
                <span>开发模式: {isDevMode ? '开' : '关'}</span>
            </button>

            <div className="h-6 w-px bg-slate-200 mx-2"></div>

            <button 
              onClick={handleAiReport}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors"
            >
              <Sparkles size={16} />
              <span>AI 分析</span>
            </button>

            <button 
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center space-x-2 px-5 py-2 rounded-lg text-xs font-semibold border transition-colors ${saving ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}
            >
              <Save size={16} />
              <span>{saving ? '保存中...' : '保存更改'}</span>
            </button>
            
            <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                className={`p-2 rounded-lg transition-colors ${isFullScreen ? 'bg-slate-100 text-blue-600' : 'text-slate-400 hover:bg-slate-100'}`}
                title={isFullScreen ? "退出全屏" : "全屏模式"}
            >
                {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </div>

        {/* 2.1 Master Grid (The Core) */}
        <MasterGrid 
          data={masterData}
          columns={columns}
          viewMode={viewMode}
          selectedRowId={selectedRowId}
          loading={loading}
          isDevMode={isDevMode}
          devDocs={devDocs}
          onRowClick={handleRowClick}
        />

        {/* 2.2 Detail Grid (Bottom Panel) */}
        <div className="h-64 border-t border-slate-200 bg-white flex flex-col shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] z-20 relative">
             {isDevMode && <DevHotspot data={devDocs.detailGrid} position="top-4 right-20" />}

             <div className="h-10 bg-slate-50/80 backdrop-blur border-b border-slate-200 px-6 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center tracking-wide">
                    <TableIcon size={14} className="mr-2 text-slate-400"/>
                    BOM 物料明细
                    {selectedRowData && (
                        <span className="ml-3 flex items-center space-x-2">
                             <ArrowRight size={12} className="text-slate-300"/>
                             <span className="font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{selectedRowData.code}</span>
                        </span>
                    )}
                </span>
             </div>
             <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left">
                    <thead className="bg-white sticky top-0 z-10">
                        <tr>
                             <th className="px-6 py-2 text-[10px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-100">序号</th>
                             <th className="px-6 py-2 text-[10px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-100">物料编码</th>
                             <th className="px-6 py-2 text-[10px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-100">名称</th>
                             <th className="px-6 py-2 text-[10px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-100 text-right">需求量</th>
                             <th className="px-6 py-2 text-[10px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-100 text-right">库存</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {detailData.length > 0 ? (
                            detailData.map((d, i) => (
                                <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-2 text-xs text-slate-500">{i + 1}</td>
                                    <td className="px-6 py-2 text-xs font-mono text-slate-600">{d.materialCode}</td>
                                    <td className="px-6 py-2 text-xs text-slate-700 font-medium">{d.materialName}</td>
                                    <td className="px-6 py-2 text-xs text-slate-700 text-right">{d.requiredQty} <span className="text-slate-400 text-[10px]">{d.unit}</span></td>
                                    <td className="px-6 py-2 text-xs text-slate-700 text-right font-medium">{d.inventory}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={5} className="py-12 text-center">
                                    <div className="flex flex-col items-center justify-center text-slate-300">
                                        <Filter size={32} className="mb-2 opacity-50"/>
                                        <span className="text-xs">选择一个排产计划以查看 BOM 明细</span>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
             </div>
        </div>
      </div>

      {/* 3. Right Side Panel */}
      {!isFullScreen && (
        <div className="w-96 bg-white border-l border-slate-200 flex flex-col shrink-0 z-40 shadow-xl transition-all duration-300 relative">
          {isDevMode && <DevHotspot data={devDocs.rightPanel} position="top-16 left-4" />}

          <div className="h-16 border-b border-slate-200 flex items-center px-6 bg-slate-50/50 backdrop-blur shrink-0 justify-between">
              <h3 className="font-bold text-slate-700 text-sm flex items-center">
                  <Edit3 size={16} className="mr-2.5 text-blue-500"/>
                  智能排程
              </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-0 flex flex-col custom-scrollbar">
              {selectedRowId ? (
                  <>
                      <div className="p-5 bg-blue-50/50 border-b border-blue-100/50">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1 font-bold">当前选中</div>
                          <div className="font-mono font-bold text-blue-700 text-lg">{selectedRowData?.code}</div>
                          <div className="text-xs text-slate-600 mt-1 font-medium">{selectedRowData?.productName}</div>
                      </div>

                      {/* AI Fill Area */}
                      <div className="p-5 bg-gradient-to-b from-purple-50/80 to-white border-b border-slate-100">
                        <div className="flex items-center justify-between text-purple-700 mb-3">
                           <div className="flex items-center">
                               <Bot size={16} className="mr-2" />
                               <span className="text-xs font-bold">Gemini 助手</span>
                           </div>
                           <span className="text-[10px] bg-purple-100 px-2 py-0.5 rounded-full text-purple-600">Beta</span>
                        </div>
                        <div className="relative">
                            <textarea 
                            className="w-full text-xs border-0 bg-white ring-1 ring-slate-200 rounded-lg p-3 mb-3 focus:ring-2 focus:ring-purple-400 shadow-sm min-h-[80px] resize-none placeholder:text-slate-400"
                            placeholder="例如：'下周每天生产150个' 或 '清空下周一的所有数据'..."
                            value={aiFillPrompt}
                            onChange={(e) => setAiFillPrompt(e.target.value)}
                            />
                            <div className="absolute bottom-5 right-2 text-[10px] text-slate-300 pointer-events-none">起始: {searchDate}</div>
                        </div>
                        
                        <button 
                           onClick={handleAiSmartFill}
                           disabled={isAiFilling || !aiFillPrompt}
                           className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold py-2.5 rounded-lg flex justify-center items-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-purple-200"
                        >
                           {isAiFilling ? <Loader2 size={14} className="animate-spin mr-2"/> : <Sparkles size={14} className="mr-2 text-purple-200"/>}
                           {isAiFilling ? '正在处理指令...' : '生成并应用'}
                        </button>
                      </div>
                      
                      {/* Unpivoted List */}
                      <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-100">
                         <span className="text-[10px] uppercase font-bold text-slate-400">每日明细</span>
                         <span className="text-[10px] text-slate-400">{unpivotedData.length} 个活跃天</span>
                      </div>

                      <div className="divide-y divide-slate-100 flex-1">
                          {unpivotedData.length > 0 ? (
                            unpivotedData.map((item) => (
                                <div key={item.date} className="flex items-center px-5 py-3 hover:bg-slate-50 bg-white transition-colors group">
                                    <div className="w-24 text-xs text-slate-500 flex flex-col">
                                        <span className="font-bold text-slate-700">{item.date}</span>
                                        <span className="text-[10px] text-slate-400">{item.weekday}</span>
                                    </div>
                                    <div className="flex-1 relative">
                                        <input 
                                            type="number" 
                                            className="w-full text-right text-sm border-transparent bg-transparent rounded px-2 py-1 focus:bg-white focus:border-blue-300 focus:border-blue-300 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 font-bold text-slate-800 transition-all hover:bg-slate-100"
                                            value={item.value}
                                            onChange={(e) => handleCellChange(selectedRowId, item.date, e.target.value)}
                                        />
                                    </div>
                                    <div className="ml-3 w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-sm shadow-emerald-200"></div>
                                </div>
                            ))
                          ) : (
                            <div className="p-8 text-center text-slate-300 flex flex-col items-center">
                                <span className="text-xs">暂无每日数据。</span>
                                <span className="text-[10px] mt-1">请在上方使用 AI 助手生成排程。</span>
                            </div>
                          )}
                      </div>
                  </>
              ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 p-8 text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                        <ArrowRight size={24} className="opacity-50" />
                      </div>
                      <p className="text-sm font-medium text-slate-400">请从左侧表格选择一个计划</p>
                      <p className="text-xs mt-2 max-w-[200px] leading-relaxed">点击左侧任意一行以查看详细信息并编辑每日排程。</p>
                  </div>
              )}
          </div>
        </div>
      )}

      {/* AI Report Modal */}
      {showAiReportModal && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white rounded-2xl shadow-2xl w-[640px] max-h-[85vh] flex flex-col border border-slate-200 overflow-hidden transform transition-all scale-100">
              <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                 <h3 className="text-base font-bold text-slate-800 flex items-center">
                    <div className="bg-purple-100 p-1.5 rounded-lg mr-3">
                        <Bot size={18} className="text-purple-600" />
                    </div>
                    生产排程分析报告
                 </h3>
                 <button onClick={() => setShowAiReportModal(false)} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded-full transition-colors">
                    <X size={20} />
                 </button>
              </div>
              <div className="p-8 overflow-y-auto flex-1 prose prose-sm prose-slate max-w-none">
                 {isAiReporting ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                       <Loader2 size={40} className="animate-spin text-purple-500" />
                       <p className="text-slate-500 font-medium">Gemini 正在分析工厂产能...</p>
                    </div>
                 ) : (
                    <div className="whitespace-pre-wrap leading-relaxed font-sans text-slate-600">
                        {aiReportContent}
                    </div>
                 )}
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                 <button 
                    onClick={() => setShowAiReportModal(false)}
                    className="px-5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-sm"
                 >
                    关闭报告
                 </button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
}

// --- Styled Components ---

const NavItem = ({ icon, label, active }: { icon: React.ReactNode, label: string, active?: boolean }) => (
  <div className={`flex flex-col items-center cursor-pointer group w-full px-2 ${active ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>
    <div className={`p-2.5 rounded-xl transition-all duration-200 ${active ? 'bg-slate-800 shadow-inner ring-1 ring-slate-700' : 'group-hover:bg-slate-800 group-hover:translate-x-1'}`}>
      {icon}
    </div>
    <span className="text-[10px] mt-1.5 font-medium text-slate-500 group-hover:text-slate-400">{label}</span>
  </div>
);