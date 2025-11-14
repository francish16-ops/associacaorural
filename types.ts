import type { Session, User as SupabaseUser } from '@supabase/supabase-js';

export type Page = 'dashboard' | 'services' | 'billing' | 'fueling' | 'registries' | 'settings' | 'schedules' | 'maintenance';

export interface User {
  id: string;
  fullName: string;
  username: string;
  email: string;
  roleId?: string | null; 
  role?: string; // Para retrocompatibilidade com o admin original
  status: 'approved' | 'pending';
}

export type GranularPermissions = {
  [key in Page]?: {
    view?: boolean;
    create?: boolean;
    edit?: boolean;
  };
};

export interface Role {
  id: string;
  name: string;
  permissions: GranularPermissions;
  created_at?: string;
}

export interface Settings {
  associationName: string;
  pixKey: string;
  logo: string;
  loginBackground: string;
  appBackground: string;
}

export interface Producer {
  id: string;
  fullName: string;
  cpf: string;
  address: string;
  propertyName: string;
  propertyLocation: string;
  addressIsProperty: boolean;
}

export interface BaseEquipment {
  id: string;
  name: string;
}

export interface Tractor extends BaseEquipment {
  hourlyRate: number;
  maintenanceIntervalHours?: number;
  lastMaintenanceHorimeter?: number;
}

export interface Implement extends BaseEquipment {
  dailyRate: number;
}

export interface ServiceOrder {
  id: string;
  orderNumber?: number;
  producerId: string;
  tractorId?: string;
  implementId?: string;
  initialHorimeter?: number;
  initialPhoto?: string;
  status: 'open' | 'closed';
  createdAt: string;
  finalHorimeter?: number;
  finalPhoto?: string;
  rentalDays?: number;
  closedAt?: string;
  totalCost?: number;
}

export interface Fueling {
  id: string;
  tractorId: string;
  horimeter: number;
  liters: number;
  cost: number;
  date: string;
}

export type ScheduleEntry = {
  id: string;
  equipment_id: string;
  equipment_type: 'tractor' | 'implement';
  producer_id: string;
  start_time: string;
  description?: string;
  created_at: string;
};

export interface Expense {
  id: string;
  tractorId: string;
  description: string;
  cost: number;
  type: 'Peça' | 'Mão de obra' | 'Óleo' | 'Filtro' | 'Outros';
  date: string;
  created_at: string;
}

export interface MaintenanceRecord {
  id: string;
  tractorId: string;
  type: string;
  description?: string;
  cost?: number;
  horimeter: number;
  date: string;
  created_at: string;
}

export interface LogEntry {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  details: any;
  created_at: string;
}