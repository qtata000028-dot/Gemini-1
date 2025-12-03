import React from 'react';
import { MasterRow, ColumnDef, DevDocs } from '../types';
import { DevHotspot } from './DevHotspot';

interface MasterGridProps {
  data: MasterRow[];
  columns: ColumnDef[];
  viewMode: 'day' | 'week';
  selectedRowId: number | null;
  loading: boolean;
  isDevMode: boolean;
  devDocs: DevDocs;
  onRowClick: (id: number) => void;
}

// Fixed column configurations
const COL_WIDTHS = {
  index: 50,
  code: 140,
  product: 180,
  workshop: 90,
  dateCol: 50,
  weekCol: 80
};

// Calculate left positions for sticky columns to avoid overlap
const STICKY_LEFT = {
  index: 0,
  code: COL_WIDTHS.index,
  product: COL_WIDTHS.index + COL_WIDTHS.code,
  workshop: COL_WIDTHS.index + COL_WIDTHS.code + COL_WIDTHS.product
};

const TOTAL_FROZEN_WIDTH = COL_WIDTHS.index + COL_WIDTHS.code + COL_WIDTHS.product + COL_WIDTHS.workshop;

// Helper for frozen bottom header cells (Individual Columns) - Moved outside
const FrozenThBottom: React.FC<{ left: number, width: number, children: React.ReactNode, isLast?: boolean }> = ({ left, width, children, isLast = false }) => (
  <th 
    className={`sticky z-[60] bg-slate-100 border-b border-slate-300 text-slate-600 font-semibold text-[11px] tracking-wide text-center ${isLast ? 'border-r-2 border-r-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]' : 'border-r border-slate-200'}`}
    style={{ 
      left: `${left}px`, 
      width: `${width}px`, 
      minWidth: `${width}px`, 
      maxWidth: `${width}px`,
      top: '32px', // Height of the top row
      height: '32px'
    }}
  >
    <div className="flex items-center justify-center h-full px-2 truncate">
      {children}
    </div>
  </th>
);

// Helper for frozen body cells - Moved outside
const FrozenTd: React.FC<{ left: number, width: number, children: React.ReactNode, isSelected: boolean, isLast?: boolean, align?: 'left'|'center'|'right', className?: string }> = ({ left, width, children, isSelected, isLast = false, align = 'left', className = '' }) => (
  <td 
    className={`sticky z-40 border-b border-slate-200 text-xs transition-colors duration-150 ${isSelected ? 'bg-blue-50' : 'bg-white group-hover:bg-slate-50'} ${isLast ? 'border-r-2 border-r-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]' : 'border-r border-slate-100'} ${className}`}
    style={{ 
      left: `${left}px`, 
      width: `${width}px`, 
      minWidth: `${width}px`, 
      maxWidth: `${width}px` 
    }}
  >
    <div className={`h-full flex items-center px-3 w-full truncate ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'}`}>
      {children}
    </div>
  </td>
);

export const MasterGrid: React.FC<MasterGridProps> = ({
  data,
  columns,
  viewMode,
  selectedRowId,
  loading,
  isDevMode,
  devDocs,
  onRowClick
}) => {

  const getWeekValue = (row: MasterRow, col: ColumnDef) => {
    if (col.type !== 'week' || !col.includedDays) return 0;
    let sum = 0;
    col.includedDays.forEach(dayKey => {
      sum += (row.planData[dayKey] || 0);
    });
    return sum > 0 ? sum : '';
  };

  const getLastActiveIndex = (row: MasterRow) => {
    if (viewMode === 'week') return -1;
    let lastIndex = -1;
    columns.forEach((col, idx) => {
      if (row.planData[col.key]) {
        lastIndex = idx;
      }
    });
    return lastIndex;
  };

  return (
    <div className="flex-1 bg-white flex flex-col min-h-0 overflow-hidden relative shadow-inner">
      {isDevMode && <DevHotspot data={devDocs.masterGrid} position="top-12 left-20" />}

      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="border-collapse w-full relative min-w-max">
          <thead className="h-16 shadow-sm z-50">
            {/* --- HEADER ROW 1: Group Headers --- */}
            <tr className="h-8">
              {/* Merged Frozen Header - Darker background for distinction */}
              <th 
                colSpan={4}
                className="sticky left-0 top-0 z-[60] bg-slate-200 border-b border-slate-300 border-r-2 border-r-slate-300 text-slate-800 font-bold text-xs text-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]"
                style={{ 
                  width: `${TOTAL_FROZEN_WIDTH}px`,
                  minWidth: `${TOTAL_FROZEN_WIDTH}px`,
                  height: '32px'
                }}
              >
                  基础信息
              </th>

              {/* Scrollable Group Headers (Year/Month/Week) */}
              {columns.map((col, idx) => (
                <th key={`th-top-${idx}`} 
                    className="sticky top-0 z-50 border-b border-r border-slate-200 bg-slate-100 px-1 text-center text-[11px] font-medium text-slate-600 whitespace-nowrap"
                    style={{ minWidth: viewMode === 'day' ? COL_WIDTHS.dateCol : COL_WIDTHS.weekCol }}
                >
                  {col.topHeader}
                </th>
              ))}
            </tr>
            
            {/* --- HEADER ROW 2: Individual Column Headers --- */}
            <tr className="h-8">
               {/* Frozen Individual Headers */}
               <FrozenThBottom left={STICKY_LEFT.index} width={COL_WIDTHS.index}>#</FrozenThBottom>
               <FrozenThBottom left={STICKY_LEFT.code} width={COL_WIDTHS.code}>计划单号</FrozenThBottom>
               <FrozenThBottom left={STICKY_LEFT.product} width={COL_WIDTHS.product}>产品名称</FrozenThBottom>
               <FrozenThBottom left={STICKY_LEFT.workshop} width={COL_WIDTHS.workshop} isLast>生产车间</FrozenThBottom>

               {/* Scrollable Individual Headers (Day/Weekday) */}
               {columns.map((col, idx) => {
                  const isWeekend = col.bottomHeader.includes('六') || col.bottomHeader.includes('日') || col.bottomHeader.includes('Sat') || col.bottomHeader.includes('Sun');
                  return (
                    <th key={`th-btm-${idx}`} 
                        className={`sticky top-8 z-50 border-b border-r border-slate-200 px-1 text-center text-[10px] font-medium ${isWeekend ? 'bg-orange-50/50 text-orange-600' : 'bg-slate-50 text-slate-500'}`}
                    >
                        {col.bottomHeader}
                    </th>
                  );
               })}
            </tr>
          </thead>
          
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={columns.length + 4} className="p-20 text-center text-slate-400 flex flex-col items-center justify-center w-full"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>正在加载排产数据...</td></tr>
            ) : (
              data.map((row, rIdx) => {
                const lastActiveIdx = getLastActiveIndex(row);
                const isSelected = selectedRowId === row.id;

                return (
                  <tr 
                    key={row.id} 
                    onClick={() => onRowClick(row.id)}
                    className={`group cursor-pointer h-10 ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                  >
                    {/* Frozen Columns Body */}
                    <FrozenTd left={STICKY_LEFT.index} width={COL_WIDTHS.index} isSelected={isSelected} align="center" className="text-slate-400 font-normal bg-slate-50/50">
                        {rIdx + 1}
                    </FrozenTd>
                    <FrozenTd left={STICKY_LEFT.code} width={COL_WIDTHS.code} isSelected={isSelected} className="font-mono text-blue-600 font-medium">
                        {row.code}
                    </FrozenTd>
                    <FrozenTd left={STICKY_LEFT.product} width={COL_WIDTHS.product} isSelected={isSelected} className="text-slate-700">
                        {row.productName}
                    </FrozenTd>
                    <FrozenTd left={STICKY_LEFT.workshop} width={COL_WIDTHS.workshop} isSelected={isSelected} isLast align="center" className="text-slate-500">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${row.workshop === '一车间' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                            {row.workshop}
                        </span>
                    </FrozenTd>

                    {/* Scrollable Data Columns */}
                    {columns.map((col, cIdx) => {
                      const isProgressBar = viewMode === 'day' && cIdx <= lastActiveIdx;
                      let cellClass = '';
                      
                      // Visual GANTT bar logic
                      if (isProgressBar) {
                        if (cIdx === lastActiveIdx) {
                          cellClass = 'bg-gradient-to-r from-blue-100 to-blue-200 border-r-2 border-r-blue-500 border-y border-blue-200';
                        } else {
                          cellClass = 'bg-blue-50/50 border-y border-blue-100';
                        }
                      }

                      const val = viewMode === 'week' ? getWeekValue(row, col) : row.planData[col.key];
                      
                      return (
                        <td 
                          key={`${row.id}-${col.key}`} 
                          className={`p-0 border-r border-slate-100 relative h-10 ${cellClass}`}
                        >
                          {viewMode === 'day' ? (
                            <div className={`w-full h-full flex items-center justify-center text-xs ${val ? 'font-bold text-slate-700' : 'text-transparent'}`}>
                              {val || ''}
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-slate-600 font-bold bg-slate-50/30">
                              {val || ''}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
