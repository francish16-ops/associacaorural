import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase, uploadFile, addRole, updateRole, deleteRole, deleteFileByUrl, logAction } from './supabaseClient';
import type { Settings, User, Role, Page, GranularPermissions, LogEntry } from './types';
import Card from './Card';
import Button from './Button';
import Input from './Input';
import Select from './Select';
import Modal from './Modal';
import { UploadIcon, PlusIcon, PencilIcon, TrashIcon, ClipboardDocumentListIcon } from './components/icons';

const pageNames: { [key in Page]?: string } = {
    services: 'Serviços',
    billing: 'Faturamento',
    fueling: 'Abastecimento',
    registries: 'Cadastros',
    schedules: 'Agendamentos',
    maintenance: 'Manutenção',
    settings: 'Configurações',
};
const permissionActions: (keyof NonNullable<GranularPermissions[Page]>)[] = ['view', 'create', 'edit'];
const actionLabels: Record<keyof NonNullable<GranularPermissions[Page]>, string> = { view: 'Ver', create: 'Criar', edit: 'Editar/Excluir' };


const RoleFormModal: React.FC<{
    role: Role | null;
    onSave: (role: Role | Omit<Role, 'id' | 'created_at'>) => void;
    onClose: () => void;
}> = ({ role, onSave, onClose }) => {
    const [name, setName] = useState(role?.name || '');
    const [permissions, setPermissions] = useState<GranularPermissions>(role?.permissions || {});

    const handlePermissionChange = (page: Page, action: keyof NonNullable<GranularPermissions[Page]>, value: boolean) => {
        setPermissions(prev => ({
            ...prev,
            [page]: {
                ...prev[page],
                [action]: value
            }
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const roleData = {
            name,
            permissions
        };
        
        if (role) {
            onSave({ ...role, ...roleData });
        } else {
            onSave(roleData);
        }
    };

    return (
        <Modal title={role ? 'Editar Perfil' : 'Novo Perfil'} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-6">
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do Perfil" required />
                <div>
                    <h3 className="font-semibold mb-2">Permissões do Perfil</h3>
                    <div className="space-y-4">
                        {(Object.keys(pageNames) as Page[]).map(pageKey => (
                            <div key={pageKey}>
                                <h4 className="font-semibold text-stone-700 dark:text-stone-200">{pageNames[pageKey]}</h4>
                                <div className="flex space-x-4 mt-1">
                                    {permissionActions.map(action => (
                                        <label key={action} className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={permissions[pageKey]?.[action] || false}
                                                onChange={e => handlePermissionChange(pageKey, action, e.target.checked)}
                                                className="h-4 w-4 rounded border-stone-300 text-orange-600 focus:ring-orange-500"
                                            />
                                            <span>{actionLabels[action]}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <Button type="submit">Salvar Perfil</Button>
            </form>
        </Modal>
    );
};

const formatLogMessage = (log: LogEntry): string => {
    const { action, details } = log;
    switch (action) {
        case 'user_login': return 'Fez login no sistema.';
        case 'update_settings': return 'Atualizou as configurações gerais.';
        // Service Orders
        case 'create_service_order': return `Abriu a O.S. #${details.orderNumber} para ${details.producerName}.`;
        case 'close_service_order': return `Fechou a O.S. #${details.orderNumber} (${details.producerName}) com valor de R$ ${details.totalCost?.toFixed(2)}.`;
        // Registries
        case 'create_producer': return `Cadastrou o produtor: ${details.producerName}.`;
        case 'update_producer': return `Atualizou o cadastro do produtor: ${details.producerName}.`;
        case 'delete_producer': return `Excluiu o produtor: ${details.producerName}.`;
        case 'create_tractor': return `Cadastrou o trator: ${details.tractorName}.`;
        case 'update_tractor': return `Atualizou o cadastro do trator: ${details.tractorName}.`;
        case 'delete_tractor': return `Excluiu o trator: ${details.tractorName}.`;
        case 'create_implement': return `Cadastrou o implemento: ${details.implementName}.`;
        case 'update_implement': return `Atualizou o cadastro do implemento: ${details.implementName}.`;
        case 'delete_implement': return `Excluiu o implemento: ${details.implementName}.`;
        // Fueling
        case 'create_fueling': return `Registrou abastecimento para ${details.tractorName} (${details.liters}L).`;
        case 'delete_fueling': return `Excluiu um abastecimento de ${details.tractorName} (${details.liters}L).`;
        // Maintenance
        case 'confirm_maintenance_review': return `Confirmou a revisão de ${details.tractorName} no horímetro ${details.horimeter}h.`;
        case 'create_expense': return `Registrou a despesa "${details.expense}" para ${details.tractorName}.`;
        case 'update_expense': return `Atualizou a despesa "${details.expense}" para ${details.tractorName}.`;
        case 'delete_expense': return `Excluiu a despesa "${details.expense}" de ${details.tractorName}.`;
        case 'create_maintenance': return `Registrou manutenção "${details.type}" para ${details.tractorName}.`;
        case 'update_maintenance': return `Atualizou a manutenção "${details.type}" para ${details.tractorName}.`;
        case 'delete_maintenance': return `Excluiu a manutenção "${details.type}" de ${details.tractorName}.`;
        // Schedules
        case 'create_schedule': return `Criou agendamento para ${details.producerName} com ${details.equipmentName}.`;
        case 'update_schedule': return `Atualizou agendamento de ${details.producerName}.`;
        case 'delete_schedule': return `Excluiu agendamento de ${details.producerName}.`;
        // Settings
        case 'create_role': return `Criou o perfil de permissão: ${details.roleName}.`;
        case 'update_role': return `Atualizou o perfil de permissão: ${details.roleName}.`;
        case 'delete_role': return `Excluiu o perfil de permissão: ${details.roleName}.`;
        case 'update_user': return `Atualizou o usuário ${details.targetUserName} (Status: ${details.status}, Perfil: ${details.roleName}).`;
        default: return `Ação desconhecida: ${action}`;
    }
};

const LogsPanel: React.FC<{ logs: LogEntry[] }> = ({ logs }) => {
    const groupedLogs = useMemo(() => {
        return logs.reduce((acc, log) => {
            const userId = log.user_id;
            if (!acc[userId]) {
                acc[userId] = {
                    userName: log.user_name,
                    entries: []
                };
            }
            acc[userId].entries.push(log);
            return acc;
        }, {} as Record<string, { userName: string; entries: LogEntry[] }>);
    }, [logs]);

    const userIds = Object.keys(groupedLogs);

    if (logs.length === 0) {
        return (
            <Card className="text-center py-8">
                <ClipboardDocumentListIcon className="w-12 h-12 mx-auto text-stone-400" />
                <p className="mt-2 text-stone-600 font-semibold">Nenhum registro de atividade encontrado.</p>
            </Card>
        );
    }
    
    return (
        <div className="space-y-4">
            {userIds.map(userId => (
                <Card key={userId}>
                    <h3 className="text-lg font-bold mb-3 border-b pb-2 dark:border-white/20">{groupedLogs[userId].userName}</h3>
                    <ul className="space-y-2 text-sm max-h-96 overflow-y-auto pr-2">
                        {groupedLogs[userId].entries.map(log => (
                            <li key={log.id} className="flex justify-between items-start gap-2">
                                <span className="flex-1">{formatLogMessage(log)}</span>
                                <span className="text-xs text-stone-500 dark:text-stone-400 shrink-0">{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                            </li>
                        ))}
                    </ul>
                </Card>
            ))}
        </div>
    );
};


const SettingsPage: React.FC<{
    settings: Settings;
    currentUser: User;
    users: User[];
    roles: Role[];
    logs: LogEntry[];
    onDataChange: () => Promise<void>;
}> = ({ settings, currentUser, users, roles, logs, onDataChange }) => {
    const [formData, setFormData] = useState(settings);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const backgroundFileInputRef = useRef<HTMLInputElement>(null);
    const appBackgroundFileInputRef = useRef<HTMLInputElement>(null);
    const [view, setView] = useState<'general' | 'roles' | 'users' | 'logs'>('general');
    const [isSaving, setIsSaving] = useState(false);
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);

    useEffect(() => {
        setFormData(settings);
    }, [settings]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({...prev, [e.target.name]: e.target.value}));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logo' | 'loginBackground' | 'appBackground') => {
        const file = e.target.files?.[0];
        if (file) {
            setIsSaving(true);
            const oldFileUrl = formData[field];
            if (oldFileUrl) {
                await deleteFileByUrl(oldFileUrl);
            }
            const publicUrl = await uploadFile('images', file);
            if(publicUrl) {
                setFormData(prev => ({ ...prev, [field]: publicUrl }));
            } else {
                alert('Erro ao fazer upload da imagem.');
            }
            setIsSaving(false);
        }
    };
    
    const handleSaveSettings = async () => {
        setIsSaving(true);
        const updateData = { ...formData };
        delete (updateData as any).id;
        delete (updateData as any).created_at;
        const { error } = await supabase.from('settings').update(updateData).eq('id', 1);
        if (error) {
            alert(`Erro ao salvar configurações: ${error.message}`);
        }
        else {
            await logAction(currentUser.id, currentUser.fullName, 'update_settings');
            alert("Configurações salvas!");
        }
        await onDataChange();
        setIsSaving(false);
    };
    
    const handleSaveRole = async (roleData: Role | Omit<Role, 'id' | 'created_at'>) => {
        const action = 'id' in roleData ? 'update_role' : 'create_role';
        await logAction(currentUser.id, currentUser.fullName, action, { roleName: roleData.name });

        if ('id' in roleData) {
            await updateRole(roleData as Role);
        } else {
            await addRole(roleData as Omit<Role, 'id' | 'created_at'>);
        }
        await onDataChange();
        setIsRoleModalOpen(false);
        setEditingRole(null);
    };

    const handleDeleteRole = async (roleId: string) => {
        if (window.confirm("Tem certeza que deseja excluir este perfil? Usuários neste perfil perderão seus acessos.")) {
            const roleToDelete = roles.find(r => r.id === roleId);
            if (roleToDelete) {
                await logAction(currentUser.id, currentUser.fullName, 'delete_role', { roleName: roleToDelete.name });
            }
            await deleteRole(roleId);
            await onDataChange();
        }
    };

    const handleUpdateUser = async (userId: string, newStatus: 'approved' | 'pending', newRoleId: string | null) => {
        const targetUser = users.find(u => u.id === userId);
        if (!targetUser) return;
        
        // Apenas loga e atualiza se houver mudança
        if(targetUser.status !== newStatus || targetUser.roleId !== newRoleId) {
            const newRoleName = roles.find(r => r.id === newRoleId)?.name || 'Nenhum';
            await logAction(currentUser.id, currentUser.fullName, 'update_user', { targetUserName: targetUser.fullName, status: newStatus, roleName: newRoleName });
            await supabase.from('users').update({ status: newStatus, roleId: newRoleId === '' ? null : newRoleId }).eq('id', userId);
            await onDataChange();
        }
    };

    const adminRole = roles.find(r => r.name.toLowerCase() === 'admin');

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold dark:text-white">Ajustes</h1>
            
            <div className="flex border-b border-stone-200 dark:border-white/30 overflow-x-auto">
                <button onClick={() => setView('general')} className={`px-4 py-2 font-semibold text-lg transition-colors shrink-0 ${view === 'general' ? 'border-b-2 border-orange-500 text-orange-600' : 'text-stone-500 hover:text-orange-600 dark:text-stone-300 dark:hover:text-orange-500'}`}>Geral</button>
                <button onClick={() => setView('roles')} className={`px-4 py-2 font-semibold text-lg transition-colors shrink-0 ${view === 'roles' ? 'border-b-2 border-orange-500 text-orange-600' : 'text-stone-500 hover:text-orange-600 dark:text-stone-300 dark:hover:text-orange-500'}`}>Perfis</button>
                <button onClick={() => setView('users')} className={`px-4 py-2 font-semibold text-lg transition-colors shrink-0 ${view === 'users' ? 'border-b-2 border-orange-500 text-orange-600' : 'text-stone-500 hover:text-orange-600 dark:text-stone-300 dark:hover:text-orange-500'}`}>Usuários</button>
                <button onClick={() => setView('logs')} className={`px-4 py-2 font-semibold text-lg transition-colors shrink-0 ${view === 'logs' ? 'border-b-2 border-orange-500 text-orange-600' : 'text-stone-500 hover:text-orange-600 dark:text-stone-300 dark:hover:text-orange-500'}`}>Logs</button>
            </div>

            {view === 'general' && (
                <Card className="space-y-6">
                    <div>
                        <label className="block font-semibold mb-2">Logo da Associação</label>
                        <div className="flex items-center gap-4">
                            <img src={formData.logo || 'https://placehold.co/150x150/e2e8f0/64748b?text=Logo'} alt="Logo" className="w-24 h-24 rounded-full object-cover border-2 border-stone-200" />
                            <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'logo')} className="hidden" ref={fileInputRef}/>
                            <Button onClick={() => fileInputRef.current?.click()} variant="secondary" className="w-auto"><UploadIcon className="w-5 h-5"/> Alterar Logo</Button>
                        </div>
                    </div>
                    <div>
                        <label className="block font-semibold mb-2">Imagem de Fundo do Login</label>
                        <div className="flex items-center gap-4">
                            <img src={formData.loginBackground || 'https://placehold.co/150x100/e2e8f0/64748b?text=Fundo'} alt="Fundo Login" className="w-32 h-20 rounded-lg object-cover border-2 border-stone-200" />
                            <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'loginBackground')} className="hidden" ref={backgroundFileInputRef}/>
                            <Button onClick={() => backgroundFileInputRef.current?.click()} variant="secondary" className="w-auto"><UploadIcon className="w-5 h-5"/> Alterar Imagem</Button>
                        </div>
                    </div>
                    <div>
                        <label className="block font-semibold mb-2">Imagem de Fundo do App</label>
                        <div className="flex items-center gap-4">
                            <img src={formData.appBackground || 'https://placehold.co/150x100/e2e8f0/64748b?text=Fundo'} alt="Fundo App" className="w-32 h-20 rounded-lg object-cover border-2 border-stone-200" />
                            <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'appBackground')} className="hidden" ref={appBackgroundFileInputRef}/>
                            <Button onClick={() => appBackgroundFileInputRef.current?.click()} variant="secondary" className="w-auto"><UploadIcon className="w-5 h-5"/> Alterar Imagem</Button>
                        </div>
                    </div>
                    <Input name="associationName" value={formData.associationName} onChange={handleChange} placeholder="Nome da Associação" />
                    <Input name="pixKey" value={formData.pixKey} onChange={handleChange} placeholder="Chave PIX para Pagamento" />
                    <Button onClick={handleSaveSettings} disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar Configurações'}</Button>
                </Card>
            )}

            {view === 'roles' && (
                <div>
                    <div className="flex justify-end mb-4">
                        <Button onClick={() => { setEditingRole(null); setIsRoleModalOpen(true); }} className="w-auto"><PlusIcon /> Novo Perfil</Button>
                    </div>
                    <Card>
                        <ul className="divide-y divide-stone-200 dark:divide-white/20">
                            {roles.map(role => (
                                <li key={role.id} className="py-3 flex justify-between items-center">
                                    <span className="font-semibold">{role.name}</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setEditingRole(role); setIsRoleModalOpen(true); }} className="text-orange-600"><PencilIcon /></button>
                                        {role.id !== adminRole?.id && <button onClick={() => handleDeleteRole(role.id)} className="text-red-600"><TrashIcon /></button>}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </Card>
                </div>
            )}
             {isRoleModalOpen && <RoleFormModal role={editingRole} onSave={handleSaveRole} onClose={() => setIsRoleModalOpen(false)} />}


            {view === 'users' && (
                 <Card>
                    <h2 className="text-xl font-bold mb-4">Gerenciamento de Usuários</h2>
                     <div className="space-y-4">
                        {users.map(user => (
                            <div key={user.id} className="p-4 border rounded-lg dark:border-white/20">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold">{user.fullName} {user.id === currentUser.id && '(Você)'}</p>
                                        <p className="text-sm text-stone-500 dark:text-stone-400">@{user.username}</p>
                                    </div>
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.status === 'approved' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>{user.status}</span>
                                </div>
                                {user.id !== currentUser.id && (
                                <div className="mt-4 space-y-3 border-t pt-3 dark:border-white/20">
                                    <Select 
                                        defaultValue={user.status} 
                                        onChange={e => handleUpdateUser(user.id, e.target.value as 'approved' | 'pending', user.roleId || null)}
                                    >
                                        <option value="approved">Aprovado</option>
                                        <option value="pending">Pendente</option>
                                    </Select>
                                    <Select 
                                        defaultValue={user.roleId || ''} 
                                        onChange={e => handleUpdateUser(user.id, user.status, e.target.value === '' ? null : e.target.value)}
                                    >
                                        <option value="">Sem Perfil</option>
                                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </Select>
                                </div>
                                )}
                            </div>
                        ))}
                     </div>
                </Card>
            )}

            {view === 'logs' && <LogsPanel logs={logs} />}
        </div>
    );
};

export default SettingsPage;