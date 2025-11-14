import { createClient } from '@supabase/supabase-js';
import type { User, Role, ScheduleEntry, Expense, MaintenanceRecord } from './types';

// ATENÇÃO: Substitua com a URL e a Chave Annon do seu projeto Supabase!
const supabaseUrl: string = 'https://seshyqljcemkkzqeenui.supabase.co'; 
const supabaseAnonKey: string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlc2h5cWxqY2Vta2t6cWVlbnVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0NzgxNDAsImV4cCI6MjA3ODA1NDE0MH0.DQk4x8sWL5WWbvxSPg9QoxbyRCsB3u5traJBBrf8rq4';

export const isSupabaseConfigured = supabaseUrl !== 'SUA_URL_SUPABASE_AQUI' && supabaseAnonKey !== 'SUA_CHAVE_ANON_SUPABASE_AQUI';

if (!isSupabaseConfigured) {
    console.warn("Supabase não configurado. Por favor, adicione sua URL e Chave Annon no arquivo supabaseClient.ts");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper para upload de imagens
export const uploadFile = async (bucket: string, file: File) => {
    const fileName = `${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage.from(bucket).upload(fileName, file);
    if (error) {
        console.error('Erro no upload:', error);
        return null;
    }
    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return publicUrlData.publicUrl;
};

export const deleteFileByUrl = async (fileUrl: string) => {
    if (!fileUrl) return;

    try {
        const url = new URL(fileUrl);
        const pathParts = url.pathname.split('/');
        const bucketName = 'images'; // O bucket está fixo como 'images'
        const bucketIndex = pathParts.indexOf(bucketName);
        
        if (bucketIndex === -1 || bucketIndex + 1 >= pathParts.length) {
            console.error("Não foi possível extrair o caminho do arquivo da URL:", fileUrl);
            return;
        }

        const filePath = pathParts.slice(bucketIndex + 1).join('/');
        const { error } = await supabase.storage.from(bucketName).remove([filePath]);

        if (error) {
            console.error('Erro ao deletar arquivo:', error.message);
        } else {
            console.log('Arquivo antigo deletado com sucesso:', filePath);
        }
    } catch (e) {
        console.error("URL inválida para deleção:", fileUrl, e);
    }
};


// Funções para gerenciar o perfil do usuário na tabela 'users'
export const getUserProfile = async (userId: string): Promise<User | null> => {
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
    if (error) {
        console.error('Erro ao buscar perfil do usuário:', error.message);
        return null;
    }
    return data;
};

// Helper para buscar o email de um usuário pelo username
export const getEmailByUsername = async (username: string): Promise<string | null> => {
    const { data, error } = await supabase
        .from('users') 
        .select('email')
        .eq('username', username)
        .single();

    if (error) {
        console.error('Erro ao buscar email por username:', error.message);
        return null;
    }
    return data?.email || null;
};

// Funções para gerenciar Perfis (Roles)
export const getRoles = async (): Promise<Role[]> => {
    const { data, error } = await supabase.from('roles').select('*');
    if (error) {
        console.error('Error fetching roles:', error.message);
        return [];
    }
    return data || [];
};

export const addRole = async (role: Omit<Role, 'id' | 'created_at'>): Promise<Role | null> => {
    const { data, error } = await supabase.from('roles').insert(role).select().single();
    if (error) {
        console.error('Error adding role:', error.message);
        return null;
    }
    return data;
};

export const updateRole = async (role: Role): Promise<Role | null> => {
    const { data, error } = await supabase.from('roles').update({ name: role.name, permissions: role.permissions }).eq('id', role.id).select().single();
    if (error) {
        console.error('Error updating role:', error.message);
        return null;
    }
    return data;
};

export const deleteRole = async (id: string): Promise<void> => {
    const { error } = await supabase.from('roles').delete().eq('id', id);
    if (error) {
        console.error('Error deleting role:', error.message);
    }
};


// Funções para gerenciar agendamentos
export const getSchedules = async (): Promise<ScheduleEntry[]> => {
    const { data, error } = await supabase.from('schedules').select('*').order('startTime', { ascending: true });
    if (error) {
        console.error('Erro ao buscar agendamentos:', error.message);
        return [];
    }
    return data as ScheduleEntry[];
};

export const addScheduleEntry = async (entry: Omit<ScheduleEntry, 'id' | 'created_at'>): Promise<ScheduleEntry | null> => {
    const { data, error } = await supabase.from('schedules').insert(entry).select().single();
    if (error) {
        console.error('Erro ao adicionar agendamento:', error.message);
        return null;
    }
    return data as ScheduleEntry;
};

export const updateScheduleEntry = async (entry: ScheduleEntry): Promise<ScheduleEntry | null> => {
    const { data, error } = await supabase.from('schedules').update(entry).eq('id', entry.id).select().single();
    if (error) {
        console.error('Erro ao atualizar agendamento:', error.message);
        return null;
    }
    return data as ScheduleEntry;
};

export const deleteScheduleEntry = async (id: string): Promise<void> => {
    const { error } = await supabase.from('schedules').delete().eq('id', id);
    if (error) {
        console.error('Erro ao excluir agendamento:', error.message);
    }
};

// Funções para gerenciar despesas
export const addExpense = async (expense: Omit<Expense, 'id' | 'created_at'>): Promise<Expense | null> => {
    const { data, error } = await supabase.from('expenses').insert(expense).select().single();
    if (error) {
        console.error('Erro ao adicionar despesa:', error.message);
        return null;
    }
    return data as Expense;
};

export const updateExpense = async (expense: Expense): Promise<Expense | null> => {
    const { data, error } = await supabase.from('expenses').update(expense).eq('id', expense.id).select().single();
    if (error) {
        console.error('Erro ao atualizar despesa:', error.message);
        return null;
    }
    return data as Expense;
};

export const deleteExpense = async (id: string): Promise<void> => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) {
        console.error('Erro ao excluir despesa:', error.message);
    }
};

// Funções para gerenciar histórico de manutenção
export const addMaintenanceRecord = async (record: Omit<MaintenanceRecord, 'id' | 'created_at'>): Promise<MaintenanceRecord | null> => {
    const { data, error } = await supabase.from('maintenance_records').insert(record).select().single();
    if (error) {
        console.error('Erro ao adicionar registro de manutenção:', error.message);
        return null;
    }
    return data as MaintenanceRecord;
};

export const updateMaintenanceRecord = async (record: MaintenanceRecord): Promise<MaintenanceRecord | null> => {
    const { data, error } = await supabase.from('maintenance_records').update(record).eq('id', record.id).select().single();
    if (error) {
        console.error('Erro ao atualizar registro de manutenção:', error.message);
        return null;
    }
    return data as MaintenanceRecord;
};

export const deleteMaintenanceRecord = async (id: string): Promise<void> => {
    const { error } = await supabase.from('maintenance_records').delete().eq('id', id);
    if (error) {
        console.error('Erro ao excluir registro de manutenção:', error.message);
    }
};

// Funções para Logging
export const logAction = async (userId: string, userName: string, action: string, details?: object): Promise<void> => {
    const { error } = await supabase.from('logs').insert({
        user_id: userId,
        user_name: userName,
        action,
        details: details || {},
    });

    if (error) {
        console.error('Erro ao registrar log:', error.message);
    }
};