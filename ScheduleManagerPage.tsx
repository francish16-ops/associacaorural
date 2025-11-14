import React, { useState, useMemo } from 'react';
import Card from './Card';
import Button from './Button';
import Modal from './Modal';
import Input from './Input';
import Select from './Select';
import { PlusIcon, CalendarDaysIcon, TrashIcon, PencilIcon } from './components/icons';
import { supabase, addScheduleEntry, updateScheduleEntry, deleteScheduleEntry, logAction } from './supabaseClient';
import type { ScheduleEntry, Producer, Tractor, Implement, GranularPermissions, User } from './types';

interface ScheduleFormProps {
    schedule?: ScheduleEntry | null;
    producers: Producer[];
    tractors: Tractor[];
    implementOptions: Implement[];
    onSave: (entry: Omit<ScheduleEntry, 'id' | 'created_at'> | ScheduleEntry) => void;
    onClose: () => void;
}

const ScheduleForm: React.FC<ScheduleFormProps> = ({ schedule, producers, tractors, implementOptions, onSave, onClose }) => {
    const [producerId, setProducerId] = useState(schedule?.producer_id || '');
    const [equipmentType, setEquipmentType] = useState(schedule?.equipment_type || '');
    const [equipmentId, setEquipmentId] = useState(schedule?.equipment_id || '');
    const [startTime, setStartTime] = useState(schedule?.start_time ? new Date(schedule.start_time).toISOString().slice(0, 16) : '');
    const [description, setDescription] = useState(schedule?.description || '');
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!producerId || !equipmentType || !equipmentId || !startTime) {
            alert('Por favor, preencha todos os campos obrigatórios.');
            return;
        }

        setIsSaving(true);
        const newEntry = {
            producer_id: producerId,
            equipment_type: equipmentType as 'tractor' | 'implement',
            equipment_id: equipmentId,
            start_time: new Date(startTime).toISOString(),
            description,
        };
        onSave(schedule ? { ...schedule, ...newEntry } : newEntry);
        setIsSaving(false);
    };

    const availableEquipment = useMemo(() => {
        if (equipmentType === 'tractor') {
            return tractors;
        } else if (equipmentType === 'implement') {
            return implementOptions;
        }
        return [];
    }, [equipmentType, tractors, implementOptions]);

    return (
        <Modal title={schedule ? 'Editar Agendamento' : 'Novo Agendamento'} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Select value={producerId} onChange={e => setProducerId(e.target.value)} required>
                    <option value="">Selecione um Produtor</option>
                    {producers.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                </Select>
                <Select value={equipmentType} onChange={e => { setEquipmentType(e.target.value); setEquipmentId(''); }} required>
                    <option value="">Selecione o Tipo de Equipamento</option>
                    <option value="tractor">Trator</option>
                    <option value="implement">Implemento</option>
                </Select>
                {equipmentType && (
                    <Select value={equipmentId} onChange={e => setEquipmentId(e.target.value)} required>
                        <option value="">Selecione o Equipamento</option>
                        {availableEquipment.map(eq => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
                    </Select>
                )}
                <Input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} placeholder="Data e Hora de Início" required />
                <Input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição (opcional)" />
                <Button type="submit" disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar Agendamento'}</Button>
            </form>
        </Modal>
    );
};

interface ScheduleManagerPageProps {
    schedules: ScheduleEntry[];
    producers: Producer[];
    tractors: Tractor[];
    implementOptions: Implement[];
    onSchedulesChange: () => void;
    permissions: GranularPermissions;
    currentUser: User;
}

const ScheduleManagerPage: React.FC<ScheduleManagerPageProps> = ({ schedules, producers, tractors, implementOptions, onSchedulesChange, permissions, currentUser }) => {
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<ScheduleEntry | null>(null);

    const getProducerName = (id: string) => producers.find(p => p.id === id)?.fullName || 'Desconhecido';
    const getEquipmentName = (type: 'tractor' | 'implement', id: string) => {
        if (type === 'tractor') return tractors.find(t => t.id === id)?.name || 'Trator Desconhecido';
        if (type === 'implement') return implementOptions.find(i => i.id === id)?.name || 'Implemento Desconhecido';
        return 'Equipamento Desconhecido';
    };

    const handleSave = async (entry: Omit<ScheduleEntry, 'id' | 'created_at'> | ScheduleEntry) => {
        const action = 'id' in entry ? 'update_schedule' : 'create_schedule';
        const producerName = getProducerName(entry.producer_id);
        const equipmentName = getEquipmentName(entry.equipment_type, entry.equipment_id);
        await logAction(currentUser.id, currentUser.fullName, action, { producerName, equipmentName, date: new Date(entry.start_time).toLocaleDateString('pt-BR') });

        if ('id' in entry) {
            await updateScheduleEntry(entry as ScheduleEntry);
        } else {
            await addScheduleEntry(entry);
        }
        onSchedulesChange();
        setIsFormModalOpen(false);
        setEditingSchedule(null);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Tem certeza que deseja excluir este agendamento?')) {
            const scheduleToDelete = schedules.find(s => s.id === id);
            if (scheduleToDelete) {
                const producerName = getProducerName(scheduleToDelete.producer_id);
                const equipmentName = getEquipmentName(scheduleToDelete.equipment_type, scheduleToDelete.equipment_id);
                await logAction(currentUser.id, currentUser.fullName, 'delete_schedule', { producerName, equipmentName });
            }
            await deleteScheduleEntry(id);
            onSchedulesChange();
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center">
                <h1 className="text-2xl font-bold dark:text-white">Agendamentos</h1>
                {permissions.schedules?.create && (
                    <Button onClick={() => { setEditingSchedule(null); setIsFormModalOpen(true); }} className="w-auto bg-orange-500 text-white px-4 py-2 rounded-lg font-semibold shadow-md flex items-center gap-2">
                        <PlusIcon className="w-5 h-5"/> Novo Agendamento
                    </Button>
                )}
            </header>

            <Card>
                {schedules.length === 0 ? (
                    <p className="text-center text-stone-500 py-8">Nenhum agendamento encontrado.</p>
                ) : (
                    <ul className="divide-y divide-stone-200 dark:divide-white/20">
                        {schedules.sort((a,b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()).map(s => (
                            <li key={s.id} className="py-4 flex justify-between items-start">
                                <div>
                                    <p className="font-semibold">{getProducerName(s.producer_id)}</p>
                                    <p className="text-sm text-stone-600 dark:text-stone-300">{getEquipmentName(s.equipment_type, s.equipment_id)}</p>
                                    <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                                        {new Date(s.start_time).toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'})}
                                    </p>
                                    {s.description && <p className="text-xs text-stone-500 italic mt-1">{s.description}</p>}
                                </div>
                                {permissions.schedules?.edit && (
                                    <div className="flex gap-2">
                                        <button onClick={() => { setEditingSchedule(s); setIsFormModalOpen(true); }} className="text-orange-600 hover:text-orange-800 text-sm">
                                            <PencilIcon className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => handleDelete(s.id)} className="text-red-600 hover:text-red-800 text-sm">
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
                <ScheduleForm
                    schedule={editingSchedule}
                    producers={producers}
                    tractors={tractors}
                    implementOptions={implementOptions}
                    onSave={handleSave}
                    onClose={() => { setIsFormModalOpen(false); setEditingSchedule(null); }}
                />
            )}
        </div>
    );
};

export default ScheduleManagerPage;