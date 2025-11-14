import React, { useState, useMemo } from 'react';
import type { Tractor, Expense, Fueling, ServiceOrder, MaintenanceRecord, GranularPermissions, User } from './types';
import { addExpense, updateExpense, deleteExpense, addMaintenanceRecord, updateMaintenanceRecord, deleteMaintenanceRecord, logAction } from './supabaseClient';
import Card from './Card';
import Button from './Button';
import Modal from './Modal';
import Input from './Input';
import Select from './Select';
import { PlusIcon, TrashIcon, PencilIcon, ExclamationTriangleIcon } from './components/icons';

const ExpenseForm: React.FC<{
    expense?: Expense | null;
    tractors: Tractor[];
    onSave: (entry: Omit<Expense, 'id' | 'created_at'> | Expense) => void;
    onClose: () => void;
}> = ({ expense, tractors, onSave, onClose }) => {
    const [tractorId, setTractorId] = useState(expense?.tractorId || '');
    const [description, setDescription] = useState(expense?.description || '');
    const [cost, setCost] = useState<number | ''>(expense?.cost || '');
    const [type, setType] = useState(expense?.type || 'Outros');
    const [date, setDate] = useState(expense?.date ? new Date(expense.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tractorId || !description || cost === '' || !date) {
            alert('Por favor, preencha todos os campos obrigatórios.');
            return;
        }

        setIsSaving(true);
        const newExpenseData = {
            tractorId,
            description,
            cost: Number(cost),
            type: type as Expense['type'],
            date: new Date(date).toISOString(),
        };

        onSave(expense ? { ...expense, ...newExpenseData } : newExpenseData);
        setIsSaving(false);
    };

    return (
        <Modal title={expense ? 'Editar Despesa' : 'Nova Despesa'} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Select value={tractorId} onChange={e => setTractorId(e.target.value)} required>
                    <option value="">Selecione um Trator</option>
                    {tractors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
                <Input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição da Despesa" required />
                <Input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Custo (R$)" required />
                <Select value={type} onChange={e => setType(e.target.value as Expense['type'])} required>
                    <option>Peça</option>
                    <option>Mão de obra</option>
                    <option>Óleo</option>
                    <option>Filtro</option>
                    <option>Outros</option>
                </Select>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                <Button type="submit" disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar Despesa'}</Button>
            </form>
        </Modal>
    );
};

const ExpensesPanel: React.FC<{
    expenses: Expense[];
    tractors: Tractor[];
    onDataChange: () => void;
    permissions: GranularPermissions;
    currentUser: User;
}> = ({ expenses, tractors, onDataChange, permissions, currentUser }) => {
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

    const getTractorName = (id: string) => tractors.find(t => t.id === id)?.name || 'Desconhecido';

    const handleSave = async (expense: Omit<Expense, 'id' | 'created_at'> | Expense) => {
        const action = 'id' in expense ? 'update_expense' : 'create_expense';
        const tractorName = getTractorName(expense.tractorId);
        await logAction(currentUser.id, currentUser.fullName, action, { expense: expense.description, tractorName, cost: expense.cost });
        if ('id' in expense) {
            await updateExpense(expense as Expense);
        } else {
            await addExpense(expense);
        }
        onDataChange();
        setIsFormModalOpen(false);
        setEditingExpense(null);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Tem certeza que deseja excluir esta despesa?')) {
            const expenseToDelete = expenses.find(e => e.id === id);
            if (expenseToDelete) {
                const tractorName = getTractorName(expenseToDelete.tractorId);
                await logAction(currentUser.id, currentUser.fullName, 'delete_expense', { expense: expenseToDelete.description, tractorName });
            }
            await deleteExpense(id);
            onDataChange();
        }
    };

    return (
        <div className="space-y-4">
            {permissions.maintenance?.create && (
                <div className="flex justify-end">
                    <Button onClick={() => { setEditingExpense(null); setIsFormModalOpen(true); }} className="w-auto">
                        <PlusIcon className="w-5 h-5"/> Nova Despesa
                    </Button>
                </div>
            )}
            <Card>
                {expenses.length === 0 ? (
                    <p className="text-center text-stone-500 py-8">Nenhuma despesa registrada.</p>
                ) : (
                    <ul className="divide-y divide-stone-200 dark:divide-white/20">
                        {expenses.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(e => (
                            <li key={e.id} className="py-4 flex justify-between items-start">
                                <div>
                                    <p className="font-semibold">{e.description}</p>
                                    <p className="text-sm font-bold text-red-600">R$ {e.cost.toFixed(2)}</p>
                                    <p className="text-xs text-stone-500 dark:text-stone-400">{getTractorName(e.tractorId)} - {new Date(e.date).toLocaleDateString('pt-BR')}</p>
                                </div>
                                {permissions.maintenance?.edit && (
                                    <div className="flex gap-2 shrink-0 ml-4">
                                        <button onClick={() => { setEditingExpense(e); setIsFormModalOpen(true); }} className="text-orange-600 hover:text-orange-800">
                                            <PencilIcon className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => handleDelete(e.id)} className="text-red-600 hover:text-red-800">
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
            {isFormModalOpen && (
                <ExpenseForm
                    expense={editingExpense}
                    tractors={tractors}
                    onSave={handleSave}
                    onClose={() => { setIsFormModalOpen(false); setEditingExpense(null); }}
                />
            )}
        </div>
    );
};

const MaintenanceRecordForm: React.FC<{
    record?: MaintenanceRecord | null;
    tractors: Tractor[];
    onSave: (entry: Omit<MaintenanceRecord, 'id' | 'created_at'> | MaintenanceRecord) => void;
    onClose: () => void;
}> = ({ record, tractors, onSave, onClose }) => {
    const [tractorId, setTractorId] = useState(record?.tractorId || '');
    const [type, setType] = useState(record?.type || '');
    const [description, setDescription] = useState(record?.description || '');
    const [cost, setCost] = useState<number | ''>(record?.cost || '');
    const [horimeter, setHorimeter] = useState<number | ''>(record?.horimeter || '');
    const [date, setDate] = useState(record?.date ? new Date(record.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tractorId || !type || horimeter === '' || !date) {
            alert('Por favor, preencha os campos obrigatórios: Trator, Tipo, Horímetro e Data.');
            return;
        }

        setIsSaving(true);
        const newRecordData = {
            tractorId,
            type,
            description,
            cost: cost !== '' ? Number(cost) : 0,
            horimeter: Number(horimeter),
            date: new Date(date).toISOString(),
        };

        onSave(record ? { ...record, ...newRecordData } : newRecordData);
        setIsSaving(false);
    };

    return (
        <Modal title={record ? 'Editar Manutenção' : 'Nova Manutenção'} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Select value={tractorId} onChange={e => setTractorId(e.target.value)} required>
                    <option value="">Selecione um Trator</option>
                    {tractors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
                <Input type="text" value={type} onChange={e => setType(e.target.value)} placeholder="Tipo de Manutenção (Ex: Troca de óleo)" required />
                <Input type="number" step="0.1" value={horimeter} onChange={e => setHorimeter(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Horímetro" required />
                 <Input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição (Opcional)" />
                <Input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Custo (R$) (Opcional)" />
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                <Button type="submit" disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar Registro'}</Button>
            </form>
        </Modal>
    );
};

const MaintenanceHistoryPanel: React.FC<{
    maintenanceHistory: MaintenanceRecord[];
    tractors: Tractor[];
    onDataChange: () => void;
    permissions: GranularPermissions;
    currentUser: User;
}> = ({ maintenanceHistory, tractors, onDataChange, permissions, currentUser }) => {
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);

    const getTractorName = (id: string) => tractors.find(t => t.id === id)?.name || 'Desconhecido';

    const handleSave = async (record: Omit<MaintenanceRecord, 'id' | 'created_at'> | MaintenanceRecord) => {
        const action = 'id' in record ? 'update_maintenance' : 'create_maintenance';
        const tractorName = getTractorName(record.tractorId);
        await logAction(currentUser.id, currentUser.fullName, action, { type: record.type, tractorName });

        if ('id' in record) {
            await updateMaintenanceRecord(record as MaintenanceRecord);
        } else {
            await addMaintenanceRecord(record);
        }
        onDataChange();
        setIsFormModalOpen(false);
        setEditingRecord(null);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Tem certeza que deseja excluir este registro de manutenção?')) {
            const recordToDelete = maintenanceHistory.find(r => r.id === id);
            if (recordToDelete) {
                const tractorName = getTractorName(recordToDelete.tractorId);
                await logAction(currentUser.id, currentUser.fullName, 'delete_maintenance', { type: recordToDelete.type, tractorName });
            }
            await deleteMaintenanceRecord(id);
            onDataChange();
        }
    };

    return (
        <div className="space-y-4">
             {permissions.maintenance?.create && (
                <div className="flex justify-end">
                    <Button onClick={() => { setEditingRecord(null); setIsFormModalOpen(true); }} className="w-auto">
                        <PlusIcon className="w-5 h-5"/> Nova Manutenção
                    </Button>
                </div>
            )}
            <Card>
                {maintenanceHistory.length === 0 ? (
                    <p className="text-center text-stone-500 py-8">Nenhum registro de manutenção.</p>
                ) : (
                    <ul className="divide-y divide-stone-200 dark:divide-white/20">
                        {maintenanceHistory.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(r => (
                            <li key={r.id} className="py-4 flex justify-between items-start">
                                <div>
                                    <p className="font-semibold">{r.type}</p>
                                    <p className="text-sm text-stone-600 dark:text-stone-300">{getTractorName(r.tractorId)} - {r.horimeter}h</p>
                                    {r.description && <p className="text-xs text-stone-500 italic mt-1">{r.description}</p>}
                                     {r.cost && r.cost > 0 && <p className="text-sm font-bold text-red-600 mt-1">R$ {r.cost.toFixed(2)}</p>}
                                    <p className="text-xs text-stone-500 mt-1">{new Date(r.date).toLocaleDateString('pt-BR')}</p>
                                </div>
                                {permissions.maintenance?.edit && (
                                    <div className="flex gap-2 shrink-0 ml-4">
                                        <button onClick={() => { setEditingRecord(r); setIsFormModalOpen(true); }} className="text-orange-600 hover:text-orange-800">
                                            <PencilIcon className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:text-red-800">
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
            {isFormModalOpen && (
                <MaintenanceRecordForm
                    record={editingRecord}
                    tractors={tractors}
                    onSave={handleSave}
                    onClose={() => { setIsFormModalOpen(false); setEditingRecord(null); }}
                />
            )}
        </div>
    );
};


const OverviewPanel: React.FC<{
    tractors: Tractor[];
    monthlyData: Record<string, any>;
    maintenanceAlerts: any[];
}> = ({ tractors, monthlyData, maintenanceAlerts }) => {
    return (
        <div className="space-y-4">
            {tractors.length === 0 ? <p className="text-center text-stone-500 py-8">Nenhum trator cadastrado para exibir dados.</p> :
                tractors.map(tractor => {
                    const data = monthlyData[tractor.id] || { totalHours: 0, totalRevenue: 0, totalExpenses: 0, costPerHour: 0, balance: 0 };
                    const alert = maintenanceAlerts.find(a => a.tractorId === tractor.id);
                    const balanceColor = data.balance >= 0 ? 'text-green-600' : 'text-red-600';
                    return (
                        <Card key={tractor.id}>
                            <h3 className="font-bold text-lg mb-3">{tractor.name}</h3>
                            {alert && (
                                <div className={`mb-3 p-2 rounded-md text-sm font-semibold flex items-center gap-2 ${alert.status === 'overdue' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                    <ExclamationTriangleIcon className="w-5 h-5"/>
                                    {alert.status === 'overdue' ? `Revisão Atrasada (${Math.abs(alert.hoursUntilDue).toFixed(1)}h)` : `Revisão Próxima (${alert.hoursUntilDue.toFixed(1)}h)`}
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div>
                                    <p className="text-3xl font-bold text-sky-600">R$ {data.costPerHour.toFixed(2)}</p>
                                    <p className="text-sm text-stone-600">Custo / Hora</p>
                                </div>
                                <div >
                                    <p className={`text-3xl font-bold ${balanceColor}`}>R$ {data.balance.toFixed(2)}</p>
                                    <p className="text-sm text-stone-600">Balanço do Mês</p>
                                </div>
                                <div>
                                    <p className="text-xl font-bold text-green-600">R$ {data.totalRevenue.toFixed(2)}</p>
                                    <p className="text-xs text-stone-500">Receita</p>
                                </div>
                                <div>
                                    <p className="text-xl font-bold text-red-600">R$ {data.totalExpenses.toFixed(2)}</p>
                                    <p className="text-xs text-stone-500">Despesas</p>
                                </div>
                            </div>
                            <div className="text-xs text-stone-500 text-center mt-4">
                                Calculado com base em {data.totalHours.toFixed(1)} horas trabalhadas este mês.
                            </div>
                        </Card>
                    )
                })
            }
        </div>
    );
};

const MaintenanceAndExpensesPage: React.FC<{
    tractors: Tractor[];
    expenses: Expense[];
    fuelings: Fueling[];
    serviceOrders: ServiceOrder[];
    maintenanceHistory: MaintenanceRecord[];
    onDataChange: () => void;
    permissions: GranularPermissions;
    currentUser: User;
}> = ({ tractors, expenses, fuelings, serviceOrders, maintenanceHistory, onDataChange, permissions, currentUser }) => {
    const [view, setView] = useState<'overview' | 'expenses' | 'history'>('overview');

    const monthlyData = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        return tractors.reduce((acc, tractor) => {
            const tractorOrders = serviceOrders.filter(o => o.tractorId === tractor.id && o.status === 'closed' && o.closedAt && new Date(o.closedAt) >= startOfMonth);
            const tractorFuelings = fuelings.filter(f => f.tractorId === tractor.id && new Date(f.date) >= startOfMonth);
            const tractorExpenses = expenses.filter(e => e.tractorId === tractor.id && new Date(e.date) >= startOfMonth);
            const tractorMaintenance = maintenanceHistory.filter(m => m.tractorId === tractor.id && new Date(m.date) >= startOfMonth);

            const totalHours = tractorOrders.reduce((sum, order) => sum + ((order.finalHorimeter || 0) - (order.initialHorimeter || 0)), 0);
            const totalRevenue = tractorOrders.reduce((sum, order) => sum + (order.totalCost || 0), 0);
            
            const totalFuelCost = tractorFuelings.reduce((sum, f) => sum + f.cost, 0);
            const totalOtherExpenses = tractorExpenses.reduce((sum, e) => sum + e.cost, 0);
            const totalMaintenanceCost = tractorMaintenance.reduce((sum, m) => sum + (m.cost || 0), 0);

            const totalExpenses = totalFuelCost + totalOtherExpenses + totalMaintenanceCost;
            
            const costPerHour = totalHours > 0 ? totalExpenses / totalHours : 0;
            const balance = totalRevenue - totalExpenses;

            acc[tractor.id] = { totalHours, totalRevenue, totalExpenses, costPerHour, balance };
            return acc;
        }, {} as Record<string, any>);
    }, [tractors, expenses, fuelings, serviceOrders, maintenanceHistory]);

    const maintenanceAlerts = useMemo(() => {
        const WARNING_HOURS_BEFORE_MAINTENANCE = 30;
        return tractors.flatMap(tractor => {
            if (!tractor.maintenanceIntervalHours) return [];
            
            const tractorFuelings = fuelings.filter(f => f.tractorId === tractor.id);
            if (tractorFuelings.length === 0) return [];

            const currentHorimeter = Math.max(0, ...tractorFuelings.map(f => f.horimeter));
            const lastMaintenance = tractor.lastMaintenanceHorimeter || 0;
            const nextMaintenanceAt = lastMaintenance + tractor.maintenanceIntervalHours;
            const hoursUntilDue = nextMaintenanceAt - currentHorimeter;
            
            if (hoursUntilDue <= WARNING_HOURS_BEFORE_MAINTENANCE) {
                return [{
                    tractorId: tractor.id,
                    tractorName: tractor.name,
                    hoursUntilDue,
                    status: hoursUntilDue <= 0 ? 'overdue' : 'warning',
                }];
            }
            return [];
        });
    }, [tractors, fuelings]);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold dark:text-white">Manutenção e Despesas</h1>
            
            <div className="flex border-b border-stone-200 dark:border-white/30">
                <button onClick={() => setView('overview')} className={`px-4 py-2 font-semibold text-lg transition-colors ${view === 'overview' ? 'border-b-2 border-orange-500 text-orange-600' : 'text-stone-500 hover:text-orange-600 dark:text-stone-300 dark:hover:text-orange-500'}`}>Visão Geral</button>
                <button onClick={() => setView('expenses')} className={`px-4 py-2 font-semibold text-lg transition-colors ${view === 'expenses' ? 'border-b-2 border-orange-500 text-orange-600' : 'text-stone-500 hover:text-orange-600 dark:text-stone-300 dark:hover:text-orange-500'}`}>Despesas</button>
                <button onClick={() => setView('history')} className={`px-4 py-2 font-semibold text-lg transition-colors ${view === 'history' ? 'border-b-2 border-orange-500 text-orange-600' : 'text-stone-500 hover:text-orange-600 dark:text-stone-300 dark:hover:text-orange-500'}`}>Histórico</button>
            </div>

            {view === 'overview' ? (
                <OverviewPanel tractors={tractors} monthlyData={monthlyData} maintenanceAlerts={maintenanceAlerts} />
            ) : view === 'expenses' ? (
                <ExpensesPanel expenses={expenses} tractors={tractors} onDataChange={onDataChange} permissions={permissions} currentUser={currentUser} />
            ) : (
                <MaintenanceHistoryPanel maintenanceHistory={maintenanceHistory} tractors={tractors} onDataChange={onDataChange} permissions={permissions} currentUser={currentUser} />
            )}
        </div>
    );
};

export default MaintenanceAndExpensesPage;