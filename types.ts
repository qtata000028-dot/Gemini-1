
export interface PlanData {
  [dateKey: string]: number;
}

export interface MasterRow {
  id: number;
  code: string;
  productName: string;
  workshop: string;
  status: string; // Changed to string to support Chinese status text flexibility
  planData: PlanData;
}

export interface DetailRow {
  id: string;
  materialCode: string;
  materialName: string;
  unit: string;
  requiredQty: number;
  inventory: number;
}

export interface ColumnDef {
  key: string;
  topHeader: string;
  bottomHeader: string;
  type: 'day' | 'week';
  dateObj?: Date;
  includedDays?: string[];
}

export interface DevDocItem {
  title: string;
  techStack: string;
  desc: string | string[];
}

export interface DevDocs {
  [key: string]: DevDocItem;
}