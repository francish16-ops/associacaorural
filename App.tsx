import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured, uploadFile, getUserProfile, getRoles, addMaintenanceRecord, logAction } from './supabaseClient';
import type { Producer, Tractor, Implement, ServiceOrder, Fueling, Settings, Page, User, Role, GranularPermissions, ScheduleEntry, Expense, MaintenanceRecord, LogEntry } from './types';
import { 
    TractorIcon, DocumentTextIcon, CogIcon, PlusIcon, CameraIcon, ShareIcon, DocumentDownloadIcon, LeafIcon, 
    BellIcon, UserCircleIcon, UploadIcon, FuelPumpIcon, CurrencyDollarIcon, ExclamationTriangleIcon, ArchiveBoxIcon, 
    ArrowLeftOnRectangleIcon, ShieldCheckIcon, ServerStackIcon, XCircleIcon, PencilIcon, TrashIcon, CalendarDaysIcon, WrenchScrewdriverIcon 
} from './components/icons';
import { CameraModal } from './components/CameraModal';
import { Session } from '@supabase/supabase-js';
import ScheduleManagerPage from './ScheduleManagerPage';
import MaintenanceAndExpensesPage from './MaintenanceAndExpensesPage';
import Card from './Card';
import Button from './Button';
import Select from './Select';
import Input from './Input';
import Modal from './Modal';
import FullscreenLoader from './FullscreenLoader';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';
import SettingsPage from './SettingsPage';
import InstallPWAButton from './components/InstallPWAButton';
import IOSInstallPrompt from './components/IOSInstallPrompt';


declare var html2canvas: any;

const App: React.FC = () => {
    useEffect(() => {
        const isProduction = !['localhost', '127.0.0.1', ''].includes(window.location.hostname);
        // Desativado temporariamente para evitar erro 404.
        // Para reativar, crie a pasta 'public' na raiz do projeto e coloque o arquivo 'service-worker.js' dentro dela.
        // if ('serviceWorker' in navigator && isProduction) {
        //     navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
        //         .then(registration => console.log('Service worker registered.', registration))
        //         .catch(error => console.log('Service worker registration failed:', error));
        // }
    }, []);

    const [session, setSession] = useState<Session | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [roles, setRoles] = useState<Role[]>([]);
    const [authView, setAuthView] = useState<'login' | 'register'>('login');
    const [loading, setLoading] = useState(true);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
    const [loadedData, setLoadedData] = useState(new Set<string>());


    // App data state
    const [producers, setProducers] = useState<Producer[]>([]);
    const [tractors, setTractors] = useState<Tractor[]>([]);
    const [equipmentImplements, setEquipmentImplements] = useState<Implement[]>([]);
    const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
    const [fuelings, setFuelings] = useState<Fueling[]>([]);
    const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [maintenanceHistory, setMaintenanceHistory] = useState<MaintenanceRecord[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [settings, setSettings] = useState<Settings | undefined>();
    const [users, setUsers] = useState<User[]>([]);

    const [page, setPage] = useState<Page>('dashboard');
    const [currentView, setCurrentView] = useState<{ type: string; id?: string }>({ type: 'list' });
    
    const [reviewModalState, setReviewModalState] = useState<{
        isOpen: boolean;
        tractorId: string | null;
        tractorName: string | null;
        suggestedHorimeter: number | null;
    }>({ isOpen: false, tractorId: null, tractorName: null, suggestedHorimeter: null });

     useEffect(() => {
        if (settings?.appBackground) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        return () => {
            document.documentElement.classList.remove('dark');
        };
    }, [settings?.appBackground]);

     useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            console.log('Evento beforeinstallprompt disparado!');
            e.preventDefault();
            setInstallPromptEvent(e);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = () => {
        if (!installPromptEvent) {
            return;
        }
        installPromptEvent.prompt();
        installPromptEvent.userChoice.then((choiceResult: { outcome: string }) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the A2HS prompt');
            } else {
                console.log('User dismissed the A2HS prompt');
            }
            setInstallPromptEvent(null);
        });
    };

    const userPermissions: GranularPermissions = useMemo(() => {
        if (currentUser?.role === 'admin') {
            const allPermissions: GranularPermissions = {};
            const allPages: Page[] = ['dashboard', 'services', 'billing', 'fueling', 'registries', 'schedules', 'settings', 'maintenance'];
            allPages.forEach(p => {
                allPermissions[p] = { view: true, create: true, edit: true };
            });
            return allPermissions;
        }
        const userRole = roles.find(r => r.id === currentUser?.roleId);
        if (userRole?.name.toLowerCase() === 'admin') {
            const allPermissions: GranularPermissions = {};
            const allPages: Page[] = ['dashboard', 'services', 'billing', 'fueling', 'registries', 'schedules', 'settings', 'maintenance'];
            allPages.forEach(p => {
                allPermissions[p] = { view: true, create: true, edit: true };
            });
            return allPermissions;
        }
        return userRole?.permissions || {};
    }, [currentUser, roles]);

    const maintenanceAlerts = useMemo(() => {
        const WARNING_HOURS_BEFORE_MAINTENANCE = 30;
        return tractors.flatMap(tractor => {
            if (!tractor.maintenanceIntervalHours) return [];
            const tractorFuelings = fuelings.filter(f => f.tractorId === tractor.id);
            if (tractorFuelings.length === 0 && !tractor.lastMaintenanceHorimeter) return [];
            const currentHorimeter = Math.max(0, ...tractorFuelings.map(f => f.horimeter));
            const lastMaintenance = tractor.lastMaintenanceHorimeter || 0;
            const nextMaintenanceAt = lastMaintenance + tractor.maintenanceIntervalHours;
            const hoursUntilDue = nextMaintenanceAt - currentHorimeter;
            if (currentHorimeter > 0 && hoursUntilDue <= WARNING_HOURS_BEFORE_MAINTENANCE) {
                return [{
                    tractorId: tractor.id,
                    tractorName: tractor.name,
                    currentHorimeter: currentHorimeter,
                    nextMaintenanceAt: nextMaintenanceAt,
                    hoursUntilDue: hoursUntilDue,
                    status: hoursUntilDue <= 0 ? 'overdue' : 'warning',
                }];
            }
            return [];
        });
    }, [tractors, fuelings]);
    
    const SupabaseConfigError = () => (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg text-center">
                <ServerStackIcon className="w-20 h-20 mx-auto text-red-400" />
                <h1 className="text-3xl font-bold text-red-800 mt-4">Configuração Necessária</h1>
                <p className="text-red-700 mt-2">
                    As credenciais do Supabase não foram encontradas.
                </p>
                <div className="mt-6 text-left bg-red-100 p-4 rounded-lg border border-red-200">
                    <p className="font-semibold text-stone-800">Por favor, siga estes passos:</p>
                    <ol className="list-decimal list-inside mt-2 text-sm text-stone-700">
                        <li>Abra o arquivo <code className="font-mono bg-red-200 px-1 rounded">'supabaseClient.ts'</code> no seu editor.</li>
                        <li>Substitua os valores de <code className="font-mono bg-red-200 px-1 rounded">'SUA_URL_SUPABASE_AQUI'</code> e <code className="font-mono bg-red-200 px-1 rounded">'SUA_CHAVE_ANON_SUPABASE_AQUI'</code> com as suas credenciais reais do projeto Supabase.</li>
                        <li>Salve o arquivo e recarregue a página.</li>
                    </ol>
                </div>
            </div>
        </div>
    );

    if (!isSupabaseConfigured) {
        return <SupabaseConfigError />;
    }

    const clearUserData = () => {
        setCurrentUser(null);
        setRoles([]);
        setProducers([]);
        setTractors([]);
        setEquipmentImplements([]);
        setServiceOrders([]);
        setFuelings([]);
        setSchedules([]);
        setUsers([]);
        setExpenses([]);
        setMaintenanceHistory([]);
        setLogs([]);
        setLoadedData(new Set());
    };
    
    const dataSetFetchers = {
        producers: () => supabase.from('producers').select('*'),
        implements: () => supabase.from('implements').select('*'),
        users: () => supabase.from('users').select('*'),
        expenses: () => supabase.from('expenses').select('*'),
        maintenanceHistory: () => supabase.from('maintenance_records').select('*'),
        serviceOrders: () => supabase.from('service_orders').select('*'),
        fuelings: () => supabase.from('fuelings').select('*'),
        schedules: () => supabase.from('schedules').select('*'),
        tractors: () => supabase.from('tractors').select('*'),
        logs: () => supabase.from('logs').select('*').order('created_at', { ascending: false }),
        roles: () => supabase.from('roles').select('*'),
    };

    const dataSetSetters: { [key: string]: (data: any) => void } = {
        producers: setProducers,
        implements: setEquipmentImplements,
        users: setUsers,
        expenses: setExpenses,
        maintenanceHistory: setMaintenanceHistory,
        serviceOrders: setServiceOrders,
        fuelings: setFuelings,
        schedules: setSchedules,
        tractors: setTractors,
        logs: setLogs,
        roles: setRoles,
    };

    const refreshData = useCallback(async (keysToRefresh: (keyof typeof dataSetFetchers)[]) => {
        if (!session?.user) return;
        setLoading(true);
        try {
            const promises = keysToRefresh.map(key => dataSetFetchers[key]());
            const results = await Promise.all(promises);
            results.forEach((result, index) => {
                const key = keysToRefresh[index];
                if (!result.error) {
                    const setter = dataSetSetters[key];
                    if (setter) {
                        setter(result.data || []);
                    }
                } else {
                    console.error(`Error refreshing ${key}:`, result.error);
                }
            });
        } catch (error) {
            console.error("Error during data refresh:", error);
        } finally {
            setLoading(false);
        }
    }, [session?.user, dataSetFetchers, dataSetSetters]);
    
    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            const { data: { session: initialSession } } = await supabase.auth.getSession();
            setSession(initialSession);

            // Fetch settings regardless of login state
            const { data: settingsData } = await supabase.from('settings').select('*').single();
            setSettings(settingsData || { associationName: 'Momento Agro', pixKey: '', logo: '', loginBackground: '', appBackground: '' });

            if (initialSession?.user) {
                // Fetch essential data for logged-in user
                const [profile, rolesData] = await Promise.all([
                    getUserProfile(initialSession.user.id),
                    getRoles(),
                ]);
                setCurrentUser(profile);
                setRoles(rolesData);
                setLoadedData(prev => new Set(prev).add('essentials'));

                if (profile?.status === 'approved') {
                    // Fetch data for the dashboard
                    const [tractorsData, fuelingsData, ordersData, schedulesData] = await Promise.all([
                        supabase.from('tractors').select('*'),
                        supabase.from('fuelings').select('*'),
                        supabase.from('service_orders').select('*'),
                        supabase.from('schedules').select('*'),
                    ]);
                    setTractors(tractorsData.data || []);
                    setFuelings(fuelingsData.data || []);
                    setServiceOrders(ordersData.data || []);
                    setSchedules(schedulesData.data || []);
                    setLoadedData(prev => new Set(prev).add('dashboard'));
                }
            }
            setLoading(false);
        };
        loadInitialData();
        
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
            const oldUserId = session?.user?.id;
            setSession(newSession);
            if (newSession?.user?.id !== oldUserId) {
                clearUserData(); // Clear all data for user switch
                loadInitialData(); // Reload initial data for the new user
            }
        });

        return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const loadPageData = async () => {
            if (!session?.user || !loadedData.has('dashboard')) return;
            
            const requiredData: (keyof typeof dataSetFetchers)[] = [];
            switch (page) {
                case 'services':
                case 'billing':
                case 'registries':
                case 'schedules':
                    if (!loadedData.has('producers')) requiredData.push('producers');
                    break;
            }
            switch (page) {
                case 'services':
                case 'registries':
                case 'schedules':
                    if (!loadedData.has('implements')) requiredData.push('implements');
                    break;
            }
            switch (page) {
                case 'maintenance':
                    if (!loadedData.has('expenses')) requiredData.push('expenses');
                    if (!loadedData.has('maintenanceHistory')) requiredData.push('maintenanceHistory');
                    break;
            }
            switch (page) {
                case 'settings':
                    if (!loadedData.has('users')) requiredData.push('users');
                    if (!loadedData.has('logs')) requiredData.push('logs');
                    break;
            }

            if (requiredData.length > 0) {
                setLoading(true);
                await refreshData(requiredData);
                setLoadedData(prev => {
                    const next = new Set(prev);
                    requiredData.forEach(key => next.add(key));
                    return next;
                });
                setLoading(false);
            }
        };

        loadPageData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, session, loadedData]);


    const handleSaveServiceOrder = async (orderData: Partial<ServiceOrder>, usedScheduleId: string | null) => {
        if (!currentUser) return;

        const { data: allOrders, error: numError } = await supabase
            .from('service_orders')
            .select('orderNumber');

        if (numError) { 
            console.error("Error fetching order numbers:", numError);
            alert(`Erro ao determinar o número da O.S.: ${numError.message}`);
            return;
        }
        
        const maxOrderNumber = allOrders && allOrders.length > 0
            ? Math.max(...allOrders.map(o => Number(o.orderNumber || 0)))
            : 0;

        const newOrderNumber = maxOrderNumber + 1;
        const finalOrderData = { ...orderData, orderNumber: newOrderNumber };

        const { error } = await supabase.from('service_orders').insert(finalOrderData).select().single();
        if(error) {
            console.error("Supabase error creating service order:", JSON.stringify(error, null, 2));
            alert(`Erro ao salvar o serviço: ${error.message}`);
            return;
        }

        if (usedScheduleId) {
            const { error: deleteError } = await supabase.from('schedules').delete().eq('id', usedScheduleId);
            if (deleteError) {
                console.error("Error deleting schedule entry:", deleteError);
                alert("O.S. criada, mas houve um erro ao remover o agendamento da fila.");
            }
        }

        const producerName = producers.find(p => p.id === orderData.producerId)?.fullName || 'N/A';
        await logAction(currentUser.id, currentUser.fullName, 'create_service_order', { orderNumber: newOrderNumber, producerName });

        await refreshData(['serviceOrders', 'schedules']);
        setCurrentView({ type: 'list' });
        setPage('services');
    };

    const handleCloseServiceOrder = async (order: ServiceOrder) => {
        if (!currentUser) return;
        const { error } = await supabase.from('service_orders').update(order).eq('id', order.id);
        if(error) {
            alert("Erro ao fechar serviço.");
            return;
        }

        const producerName = producers.find(p => p.id === order.producerId)?.fullName || 'N/A';
        await logAction(currentUser.id, currentUser.fullName, 'close_service_order', { orderNumber: order.orderNumber, producerName, totalCost: order.totalCost });

        await refreshData(['serviceOrders']);
        setCurrentView({ type: 'view_service', id: order.id });
    }
    
    const handlePromptForReview = (tractorId: string) => {
        const tractor = tractors.find(t => t.id === tractorId);
        if (!tractor) return;
        const latestHorimeter = Math.max(0, ...fuelings.filter(f => f.tractorId === tractorId).map(f => f.horimeter));
        setReviewModalState({
            isOpen: true,
            tractorId,
            tractorName: tractor.name,
            suggestedHorimeter: latestHorimeter
        });
    };

    const handleConfirmReview = async (tractorId: string, horimeter: number) => {
        if (!currentUser) return;
        if (horimeter <= 0) {
            alert("O horímetro deve ser um valor positivo.");
            return;
        }
        const newRecord: Omit<MaintenanceRecord, 'id' | 'created_at'> = {
            tractorId,
            type: 'Revisão Preventiva',
            description: 'Revisão periódica registrada a partir de alerta do sistema.',
            horimeter: horimeter,
            date: new Date().toISOString(),
            cost: 0,
        };
        const addedRecord = await addMaintenanceRecord(newRecord);
        if (!addedRecord) {
            alert("Erro ao criar o registro no histórico de manutenções.");
            return;
        }
        const { error: updateError } = await supabase.from('tractors').update({ lastMaintenanceHorimeter: horimeter }).eq('id', tractorId);
        if (updateError) {
            alert("Erro ao atualizar o horímetro do trator. O histórico foi salvo, mas o alerta pode continuar aparecendo.");
            return;
        }

        const tractorName = tractors.find(t => t.id === tractorId)?.name || 'N/A';
        await logAction(currentUser.id, currentUser.fullName, 'confirm_maintenance_review', { tractorName, horimeter });

        await refreshData(['tractors', 'maintenanceHistory']);
        alert("Revisão registrada com sucesso!");
        setReviewModalState({ isOpen: false, tractorId: null, tractorName: null, suggestedHorimeter: null });
    };

    const NotificationsModal: React.FC<{
        alerts: any[];
        onClose: () => void;
        onMarkAsReviewed: (tractorId: string) => void;
    }> = ({ alerts, onClose, onMarkAsReviewed }) => {
        return (
            <Modal title="Notificações" onClose={onClose}>
                {alerts.length === 0 ? (
                    <div className="text-center p-4">
                        <BellIcon className="w-12 h-12 mx-auto text-stone-400" />
                        <p className="mt-2 text-stone-600 font-semibold">Nenhuma notificação no momento.</p>
                    </div>
                ) : (
                    <ul className="space-y-4">
                        {alerts.map(alert => (
                            <li key={alert.tractorId} className={`p-4 rounded-lg shadow-sm ${alert.status === 'overdue' ? 'bg-red-50 border-l-4 border-red-500' : 'bg-yellow-50 border-l-4 border-yellow-500'}`}>
                                <div className="flex items-start gap-3">
                                    <div className={`mt-1 ${alert.status === 'overdue' ? 'text-red-500' : 'text-yellow-500'}`}>
                                        <ExclamationTriangleIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-stone-800">{alert.tractorName}</p>
                                        {alert.status === 'overdue' ? (
                                            <p className="text-sm font-semibold text-red-800">Revisão Atrasada em {Math.abs(alert.hoursUntilDue).toFixed(1)}h</p>
                                        ) : (
                                            <p className="text-sm font-semibold text-yellow-800">Revisão Próxima: Faltam {alert.hoursUntilDue.toFixed(1)}h</p>
                                        )}
                                        <p className="text-xs text-stone-500 mt-1">
                                            Horímetro Atual: {alert.currentHorimeter.toFixed(1)}h / Próxima em: {alert.nextMaintenanceAt.toFixed(1)}h
                                        </p>
                                        <button 
                                            onClick={() => { onMarkAsReviewed(alert.tractorId); onClose(); }} 
                                            className="text-sm bg-yellow-500 text-white font-semibold px-3 py-1 rounded-md shadow-sm hover:bg-yellow-600 mt-3"
                                        >
                                            Marcar como revisado
                                        </button>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Modal>
        );
    };
    
    const ReviewConfirmationModal: React.FC<{
        isOpen: boolean;
        onClose: () => void;
        onConfirm: (horimeter: number) => void;
        tractorName: string | null;
        suggestedHorimeter: number | null;
    }> = ({ isOpen, onClose, onConfirm, tractorName, suggestedHorimeter }) => {
        const [horimeterValue, setHorimeterValue] = useState<number | ''>('');

        useEffect(() => {
            if (isOpen && suggestedHorimeter !== null) {
                setHorimeterValue(suggestedHorimeter);
            }
        }, [isOpen, suggestedHorimeter]);

        if (!isOpen) return null;

        const handleConfirmClick = () => {
            if (horimeterValue !== '') {
                onConfirm(Number(horimeterValue));
            } else {
                alert("Por favor, insira um valor para o horímetro.");
            }
        };

        return (
            <Modal title={`Confirmar Revisão`} onClose={onClose}>
                <div className="space-y-4">
                    <p>Confirme ou ajuste o horímetro para a revisão do trator <strong>{tractorName}</strong>.</p>
                    <div>
                        <label className="block font-semibold mb-1 text-stone-700 dark:text-stone-200">Horímetro da Revisão</label>
                        <Input 
                            type="number"
                            value={horimeterValue}
                            onChange={e => setHorimeterValue(e.target.value === '' ? '' : Number(e.target.value))}
                            step="0.1"
                            required
                        />
                         <p className="text-xs text-stone-500 mt-1">
                            Sugestão baseada no último abastecimento.
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <Button onClick={onClose} variant="secondary">Cancelar</Button>
                        <Button onClick={handleConfirmClick}>Confirmar</Button>
                    </div>
                </div>
            </Modal>
        );
    };

    const Dashboard: React.FC<{ 
        serviceOrders: ServiceOrder[], 
        schedules: ScheduleEntry[],
        onNavigate: (page: Page) => void,
        onNewService: () => void,
        settings: Settings,
        maintenanceAlerts: any[],
        onMarkAsReviewed: (tractorId: string) => void;
        currentUser: User;
    }> = ({ serviceOrders, schedules, onNavigate, onNewService, settings, maintenanceAlerts, onMarkAsReviewed, currentUser }) => {
        const openServices = serviceOrders.filter(s => s.status === 'open').length;

        const DashboardAction: React.FC<{icon: React.ReactNode, label: string, onClick: () => void, color: string, permission: boolean | undefined}> = ({icon, label, onClick, color, permission}) => {
            if (!permission) return null;
            return (
                <div className="flex flex-col items-center gap-2">
                    <button onClick={onClick} className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-transform hover:scale-110 ${color}`}>
                        {icon}
                    </button>
                    <p className="text-sm font-medium text-center">{label}</p>
                </div>
            );
        }
        
        return (
            <div className="space-y-6">
                <div className="text-center pt-8 pb-2">
                     {settings.logo ? (
                        <img src={settings.logo} alt="Logo" className="w-64 h-64 mx-auto rounded-full object-cover border-4 border-white shadow-lg mb-4"/>
                    ) : (
                        <div className="w-64 h-64 mx-auto rounded-full bg-stone-200 flex items-center justify-center border-4 border-white shadow-lg mb-4">
                            <LeafIcon className="w-48 h-48 text-stone-400"/>
                        </div>
                    )}
                    <p className="text-lg text-stone-800 dark:text-stone-300">Bem-vindo(a), {currentUser.fullName.split(' ')[0]}</p>
                    <h1 className="text-3xl font-bold">{settings.associationName || "Gestor Rural"}</h1>
                </div>

                {maintenanceAlerts.some(a => a.status === 'overdue') && (
                    <Card className="border-l-4 border-red-500">
                        <div className="flex items-center gap-3 mb-3">
                            <ExclamationTriangleIcon className="w-6 h-6 text-red-600"/>
                            <h2 className="text-lg font-bold text-red-800">Revisões Atrasadas</h2>
                        </div>
                        <ul className="space-y-3">
                            {maintenanceAlerts.filter(a => a.status === 'overdue').map(alert => (
                                <li key={alert.tractorId} className="p-3 bg-red-50 dark:bg-red-900/30 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-2">
                                    <div>
                                        <p className="font-semibold">A revisão de {alert.tractorName} está atrasada!</p>
                                        <p className="text-sm">Atrasada em {Math.abs(alert.hoursUntilDue).toFixed(1)}h</p>
                                    </div>
                                    <button onClick={() => onMarkAsReviewed(alert.tractorId)} className="text-sm bg-red-500 text-white font-semibold px-3 py-1 rounded-md shadow-sm hover:bg-red-600 w-full sm:w-auto">
                                        Marcar como revisado
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </Card>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <Card className="bg-green-600 text-white text-center shadow-xl">
                        <h2 className="text-lg font-semibold">Serviços em Aberto</h2>
                        <p className="text-5xl font-bold tracking-tight">{openServices}</p>
                    </Card>
                    <Card className="bg-indigo-500 text-white text-center shadow-xl">
                        <h2 className="text-lg font-semibold">Agendamentos</h2>
                        <p className="text-5xl font-bold tracking-tight">{schedules.length}</p>
                    </Card>
                </div>
                
                <Card>
                    <h2 className="text-base font-semibold mb-4 text-center">Ações Rápidas</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <DashboardAction icon={<PlusIcon className="w-8 h-8 text-white"/>} label="Nova O.S." onClick={onNewService} color="bg-green-500" permission={userPermissions.services?.create} />
                        <DashboardAction icon={<DocumentTextIcon className="w-8 h-8 text-white"/>} label="Serviços" onClick={() => onNavigate('services')} color="bg-sky-500" permission={userPermissions.services?.view} />
                        <DashboardAction icon={<CalendarDaysIcon className="w-8 h-8 text-white"/>} label="Agendar" onClick={() => onNavigate('schedules')} color="bg-indigo-500" permission={userPermissions.schedules?.view} />
                        <DashboardAction icon={<ArchiveBoxIcon className="w-8 h-8 text-white"/>} label="Cadastros" onClick={() => onNavigate('registries')} color="bg-amber-500" permission={userPermissions.registries?.view} />
                        <DashboardAction icon={<WrenchScrewdriverIcon className="w-8 h-8 text-white"/>} label="Manutenção" onClick={() => onNavigate('maintenance')} color="bg-slate-500" permission={userPermissions.maintenance?.view} />
                    </div>
                </Card>
            </div>
        );
    };
    
    const ServiceManager: React.FC<{
        serviceOrders: ServiceOrder[];
        producers: Producer[];
        tractors: Tractor[];
        equipmentImplements: Implement[];
        onNewService: () => void;
        setView: (view: any) => void;
        permissions: GranularPermissions;
    }> = ({ serviceOrders, producers, tractors, equipmentImplements, onNewService, setView, permissions }) => {
        const openServices = serviceOrders.filter(s => s.status === 'open');
        const closedServices = serviceOrders.filter(s => s.status === 'closed').sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const getProducerName = (id: string) => producers.find(p => p.id === id)?.fullName || 'Desconhecido';
        const getTractorName = (id?: string) => id ? tractors.find(t => t.id === id)?.name : 'N/A';
        const getImplementName = (id?: string) => id ? equipmentImplements.find(i => i.id === id)?.name : 'N/A';

        return (
            <div className="space-y-6">
                <header className="flex justify-between items-center">
                     <h1 className="text-2xl font-bold dark:text-white">Ordens de Serviço</h1>
                     {permissions.services?.create && (
                        <button onClick={onNewService} className="bg-orange-500 text-white px-4 py-2 rounded-lg font-semibold shadow-md flex items-center gap-2">
                            <PlusIcon className="w-5 h-5"/> Nova O.S.
                        </button>
                     )}
                </header>
                
                <Card>
                    <h2 className="text-xl font-semibold mb-3 text-emerald-700">Em Aberto ({openServices.length})</h2>
                    {openServices.length > 0 ? (
                        <ul className="divide-y divide-stone-200 dark:divide-white/20">
                            {openServices.map(s => (
                                <li key={s.id} className="py-4 cursor-pointer hover:bg-stone-50 dark:hover:bg-white/10 rounded-md -mx-4 px-4" onClick={() => permissions.services?.edit && setView({ type: 'close_service', id: s.id })}>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold">O.S. #{s.orderNumber} - {getProducerName(s.producerId)}</p>
                                            <p className="text-sm text-stone-600 dark:text-stone-300">Trator: {getTractorName(s.tractorId)} / Implemento: {getImplementName(s.implementId)}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs text-stone-500 dark:text-stone-400">Criado em: {s.createdAt ? new Date(s.createdAt).toLocaleDateString('pt-BR') : 'N/A'}</span>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-center text-stone-500 py-8">Nenhum serviço em aberto.</p>}
                </Card>

                <Card>
                    <h2 className="text-xl font-semibold mb-3">Histórico ({closedServices.length})</h2>
                    {closedServices.length > 0 ? (
                        <ul className="divide-y divide-stone-200 dark:divide-white/20">
                            {closedServices.map(s => (
                                <li key={s.id} className="py-4 cursor-pointer hover:bg-stone-50 dark:hover:bg-white/10 rounded-md -mx-4 px-4" onClick={() => setView({ type: 'view_service', id: s.id })}>
                                   <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold">O.S. #{s.orderNumber} - {getProducerName(s.producerId)}</p>
                                            <p className="font-bold text-green-700">R$ {s.totalCost?.toFixed(2) || '0.00'}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-medium">Fechado em: {s.closedAt ? new Date(s.closedAt).toLocaleDateString('pt-BR') : 'N/A'}</span>
                                            <p className="text-xs text-stone-500 dark:text-stone-400">Criado em: {s.createdAt ? new Date(s.createdAt).toLocaleDateString('pt-BR') : 'N/A'}</p>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-center text-stone-500 py-8">Nenhum serviço fechado.</p>}
                </Card>
            </div>
        );
    };

    const ServiceOrderForm: React.FC<{
        producers: Producer[];
        tractors: Tractor[];
        equipmentImplements: Implement[];
        serviceOrders: ServiceOrder[];
        schedules: ScheduleEntry[];
        onSave: (order: Partial<ServiceOrder>, usedScheduleId: string | null) => void;
        onClose: () => void;
    }> = ({ producers, tractors, equipmentImplements, serviceOrders, schedules, onSave, onClose }) => {
        const [producerId, setProducerId] = useState('');
        const [tractorId, setTractorId] = useState('');
        const [implementId, setImplementId] = useState('');
        const [initialHorimeter, setInitialHorimeter] = useState<number | ''>('');
        const [initialPhoto, setInitialPhoto] = useState<string | undefined>();
        const [showCamera, setShowCamera] = useState(false);
        const [search, setSearch] = useState('');
        const [isSaving, setIsSaving] = useState(false);
        const [formError, setFormError] = useState<string>('');
        const [lastHorimeter, setLastHorimeter] = useState<number | null>(null);
        const [usedScheduleId, setUsedScheduleId] = useState<string | null>(null);

        const nextSchedule = useMemo(() => {
            const now = new Date();
            // Sort schedules that are not in the past
            return schedules
                .filter(s => new Date(s.start_time).getTime() > now.getTime())
                .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];
        }, [schedules]);

        const getProducerName = (id: string) => producers.find(p => p.id === id)?.fullName || 'Desconhecido';
        const getEquipmentName = (type: 'tractor' | 'implement', id: string) => {
            const source = type === 'tractor' ? tractors : equipmentImplements;
            return source.find(e => e.id === id)?.name || 'Desconhecido';
        };

        const handleUseSchedule = () => {
            if (nextSchedule) {
                setProducerId(nextSchedule.producer_id);
                if (nextSchedule.equipment_type === 'tractor') {
                    setTractorId(nextSchedule.equipment_id);
                    setImplementId('');
                } else {
                    setImplementId(nextSchedule.equipment_id);
                    setTractorId('');
                }
                setUsedScheduleId(nextSchedule.id);
                setSearch(''); // Limpa a busca
            }
        };

        const filteredProducers = useMemo(() => 
            producers.filter(p => p.fullName.toLowerCase().includes(search.toLowerCase())),
        [producers, search]);

        useEffect(() => {
            setFormError(''); 
            if (tractorId) {
                const openService = serviceOrders.find(o => o.tractorId === tractorId && o.status === 'open');
                if (openService) {
                    const tractorName = tractors.find(t => t.id === tractorId)?.name;
                    setFormError(`O trator "${tractorName}" já possui uma O.S. aberta. Feche a O.S. existente antes de abrir uma nova.`);
                    return;
                }
            }
            if (implementId) {
                const openService = serviceOrders.find(o => o.implementId === implementId && o.status === 'open');
                if (openService) {
                    const implementName = equipmentImplements.find(i => i.id === implementId)?.name;
                    setFormError(`O implemento "${implementName}" já possui uma O.S. aberta. Feche a O.S. existente antes de abrir uma nova.`);
                    return;
                }
            }
        }, [tractorId, implementId, serviceOrders, tractors, equipmentImplements]);

        useEffect(() => {
            if (tractorId) {
                const lastHorimeterValue = Math.max(0, ...serviceOrders
                    .filter(o => o.tractorId === tractorId && o.status === 'closed' && typeof o.finalHorimeter === 'number')
                    .map(o => o.finalHorimeter!)
                );
                setLastHorimeter(lastHorimeterValue);
                setInitialHorimeter(lastHorimeterValue > 0 ? lastHorimeterValue : '');
            } else {
                setLastHorimeter(null);
                setInitialHorimeter('');
            }
        }, [tractorId, serviceOrders]);
        
        const handleSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
             if (formError) {
                alert(formError);
                return;
            }
            if (!producerId || (!tractorId && !implementId)) {
                alert("Selecione um produtor e ao menos um equipamento.");
                return;
            }
            if (tractorId && initialHorimeter === '') {
                alert("Preencha o horímetro inicial do trator.");
                return;
            }
            if (tractorId && lastHorimeter !== null && Number(initialHorimeter) < lastHorimeter) {
                alert(`O horímetro inicial não pode ser menor que o último horímetro final registrado (${lastHorimeter}h).`);
                return;
            }

            setIsSaving(true);
            onSave({
                producerId,
                tractorId: tractorId || null,
                implementId: implementId || null,
                initialHorimeter: tractorId ? Number(initialHorimeter) : null,
                initialPhoto,
                status: 'open',
                createdAt: new Date().toISOString()
            }, usedScheduleId);
            setIsSaving(false);
        };
        
        return (
            <Modal title="Abrir Ordem de Serviço" onClose={onClose}>
                {nextSchedule && !usedScheduleId && (
                    <Card className="mb-4 bg-indigo-50 border border-indigo-200 dark:bg-indigo-500/20 dark:border-indigo-400">
                        <h3 className="font-bold text-lg text-indigo-800 dark:text-indigo-200">Próximo da Fila</h3>
                        <p className="mt-1">
                            <strong>Produtor:</strong> {getProducerName(nextSchedule.producer_id)}<br />
                            <strong>Equipamento:</strong> {getEquipmentName(nextSchedule.equipment_type, nextSchedule.equipment_id)}<br/>
                            <strong>Data:</strong> {new Date(nextSchedule.start_time).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                        </p>
                        <Button onClick={handleUseSchedule} className="mt-3 w-full" variant="secondary">Usar Agendamento</Button>
                    </Card>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block font-semibold mb-1">Produtor</label>
                        <Input type="text" placeholder="Buscar produtor..." value={search} onChange={e => setSearch(e.target.value)} />
                        <Select value={producerId} onChange={e => setProducerId(e.target.value)} required>
                            <option value="">Selecione um produtor</option>
                            {filteredProducers.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                        </Select>
                    </div>
                    <div>
                        <label className="block font-semibold mb-1">Trator</label>
                        <Select value={tractorId} onChange={e => setTractorId(e.target.value)}>
                            <option value="">Nenhum trator</option>
                            {tractors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </Select>
                    </div>
                    <div>
                        <label className="block font-semibold mb-1">Implemento</label>
                        <Select value={implementId} onChange={e => setImplementId(e.target.value)}>
                            <option value="">Nenhum implemento</option>
                            {equipmentImplements.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </Select>
                    </div>
                    
                    {formError && (
                        <div className="text-red-700 dark:text-red-300 font-semibold p-3 bg-red-100 dark:bg-red-900/30 rounded-lg text-center my-2">
                            {formError}
                        </div>
                    )}

                    {tractorId && (
                        <div className="space-y-2">
                            <label className="block font-semibold mb-1">Horímetro Inicial</label>
                            <Input 
                                type="number" 
                                value={initialHorimeter} 
                                onChange={e => setInitialHorimeter(e.target.value === '' ? '' : Number(e.target.value))} 
                                required 
                                step="0.1" 
                                min={lastHorimeter ?? 0}
                            />
                            {lastHorimeter !== null && lastHorimeter > 0 && <p className="text-xs text-stone-500 mt-1">Último horímetro final registrado: {lastHorimeter}h.</p>}
                            <button type="button" onClick={() => setShowCamera(true)} className="w-full text-sm text-center py-2 bg-stone-200 rounded-lg flex items-center justify-center gap-2"><CameraIcon className="w-5 h-5"/> Tirar Foto</button>
                            {initialPhoto && <img src={initialPhoto} alt="Horímetro Inicial" className="mt-2 rounded-lg w-32 h-auto" />}
                        </div>
                    )}
                    <Button type="submit" disabled={isSaving || !!formError}>{isSaving ? 'Salvando...' : 'Abrir O.S.'}</Button>
                </form>
                {showCamera && <CameraModal onCapture={setInitialPhoto} onClose={() => setShowCamera(false)} />}
            </Modal>
        );
    };

    const CloseServiceOrder: React.FC<{
        order: ServiceOrder;
        producers: Producer[];
        tractors: Tractor[];
        equipmentImplements: Implement[];
        onSave: (order: ServiceOrder) => void;
        onClose: () => void;
    }> = ({ order, producers, tractors, equipmentImplements, onSave, onClose }) => {
        const [finalHorimeter, setFinalHorimeter] = useState<number | ''>(order.initialHorimeter || '');
        const [finalPhoto, setFinalPhoto] = useState<string | undefined>();
        const [rentalDays, setRentalDays] = useState<number | ''>(1);
        const [showCamera, setShowCamera] = useState(false);
        const [isSaving, setIsSaving] = useState(false);

        const producer = producers.find(p => p.id === order.producerId);
        const tractor = tractors.find(t => t.id === order.tractorId);
        const implement = equipmentImplements.find(i => i.id === order.implementId);

        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            setIsSaving(true);
            
            let totalCost = 0;
            if (tractor && typeof finalHorimeter === 'number' && typeof order.initialHorimeter === 'number') {
                if (finalHorimeter <= order.initialHorimeter) {
                    alert("Horímetro final deve ser maior que o inicial.");
                    setIsSaving(false);
                    return;
                }
                const hours = finalHorimeter - order.initialHorimeter;
                totalCost = hours * tractor.hourlyRate;
            } else if (implement && typeof rentalDays === 'number') {
                totalCost = rentalDays * implement.dailyRate;
            }

            onSave({
                ...order,
                finalHorimeter: typeof finalHorimeter === 'number' ? finalHorimeter : undefined,
                finalPhoto,
                rentalDays: typeof rentalDays === 'number' ? rentalDays : undefined,
                status: 'closed',
                closedAt: new Date().toISOString(),
                totalCost,
            });
            setIsSaving(false);
        };

        return (
            <Modal title={`Fechar O.S. #${order.orderNumber}`} onClose={onClose}>
                <Card className="mb-4 bg-stone-100 dark:bg-black/20">
                    <p><strong>Produtor:</strong> {producer?.fullName}</p>
                    <p><strong>Propriedade:</strong> {producer?.propertyName}</p>
                    <p><strong>Trator:</strong> {tractor?.name || 'N/A'}</p>
                    <p><strong>Implemento:</strong> {implement?.name || 'N/A'}</p>
                </Card>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {tractor && (
                        <div className="space-y-2">
                            <label className="block font-semibold">Horímetro Inicial: {order.initialHorimeter?.toFixed(1)}</label>
                            {order.initialPhoto && <img src={order.initialPhoto} alt="Horímetro Inicial" className="rounded-lg w-32 h-auto" />}
                            <label className="block font-semibold mb-1">Horímetro Final</label>
                            <Input type="number" value={finalHorimeter} onChange={e => setFinalHorimeter(e.target.value === '' ? '' : Number(e.target.value))} required step="0.1" />
                            <button type="button" onClick={() => setShowCamera(true)} className="w-full text-sm text-center py-2 bg-stone-200 rounded-lg flex items-center justify-center gap-2"><CameraIcon className="w-5 h-5"/> Tirar Foto</button>
                            {finalPhoto && <img src={finalPhoto} alt="Horímetro Final" className="mt-2 rounded-lg w-32 h-auto" />}
                        </div>
                    )}
                    {!tractor && implement && (
                         <div className="space-y-2">
                             <label className="block font-semibold mb-1">Dias de Aluguel</label>
                             <Input type="number" value={rentalDays} onChange={e => setRentalDays(e.target.value === '' ? '' : Number(e.target.value))} required min="1" />
                         </div>
                    )}
                    <Button type="submit" variant='primary' className="bg-red-600 hover:bg-red-700" disabled={isSaving}>{isSaving ? 'Fechando...' : 'Fechar e Calcular'}</Button>
                </form>
                {showCamera && <CameraModal onCapture={setFinalPhoto} onClose={() => setShowCamera(false)} />}
            </Modal>
        );
    };

    const ServiceOrderSummary: React.FC<{
        order: ServiceOrder;
        producers: Producer[];
        tractors: Tractor[];
        equipmentImplements: Implement[];
        settings: Settings;
        onClose: () => void;
    }> = ({ order, producers, tractors, equipmentImplements, settings, onClose }) => {
        const producer = producers.find(p => p.id === order.producerId);
        const tractor = tractors.find(t => t.id === order.tractorId);
        const implement = equipmentImplements.find(i => i.id === order.implementId);
        
        const generatePdfFile = async (): Promise<File | null> => {
            if (!(window as any).jspdf || !html2canvas) {
                alert("Erro ao carregar bibliotecas para gerar PDF. Tente novamente.");
                return null;
            }
            const { jsPDF } = (window as any).jspdf;
            const summaryElement = document.getElementById('service-summary-content');

            if (!summaryElement) {
                console.error("Elemento do resumo não encontrado para gerar PDF.");
                return null;
            }

            try {
                const canvas = await html2canvas(summaryElement, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                const margin = 10;
                
                const imgWidth = canvas.width;
                const imgHeight = canvas.height;
                const ratio = imgWidth / imgHeight;

                let pdfImgWidth = pageWidth - margin * 2;
                let pdfImgHeight = pdfImgWidth / ratio;
                
                if (pdfImgHeight > pageHeight - margin * 2) {
                    pdfImgHeight = pageHeight - margin * 2;
                    pdfImgWidth = pdfImgHeight * ratio;
                }

                const x = (pageWidth - pdfImgWidth) / 2;
                const y = margin;

                pdf.addImage(imgData, 'PNG', x, y, pdfImgWidth, pdfImgHeight);
                
                const pdfBlob = pdf.output('blob');
                const fileName = `resumo-servico-os-${order.orderNumber}.pdf`;
                return new File([pdfBlob], fileName, { type: 'application/pdf' });
            } catch (error) {
                console.error("Erro ao gerar o arquivo PDF:", error);
                alert("Ocorreu um erro ao gerar o arquivo PDF.");
                return null;
            }
        };

        const handleShare = async () => {
            const pdfFile = await generatePdfFile();
            if (!pdfFile) return;

            if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
                try {
                    await navigator.share({
                        title: `Resumo do Serviço O.S. #${order.orderNumber}`,
                        text: `Segue o resumo do serviço O.S. #${order.orderNumber} para ${producer?.fullName}.`,
                        files: [pdfFile],
                    });
                } catch (error) {
                    console.error('Erro ao compartilhar o arquivo', error);
                    alert('Não foi possível compartilhar o arquivo.');
                }
            } else {
                alert('Seu navegador não suporta o compartilhamento de arquivos. Tente baixar o PDF e compartilhá-lo manualmente.');
            }
        };
        
        const handleGeneratePdf = async () => {
            const pdfFile = await generatePdfFile();
            if (!pdfFile) return;
            
            try {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(pdfFile);
                link.download = pdfFile.name;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
            } catch (error) {
                 console.error("Erro ao tentar baixar o PDF:", error);
                 alert("Ocorreu um erro ao baixar o PDF.");
            }
        };

        const hoursWorked = ((order.finalHorimeter || 0) - (order.initialHorimeter || 0)).toFixed(1);

        return (
            <Modal title={`Resumo da O.S. #${order.orderNumber}`} onClose={onClose}>
                <div className="space-y-4">
                    <div id="service-summary-content" className="p-4 bg-white rounded-lg text-stone-800">
                        <header className="text-center mb-4">
                            {settings.logo && <img src={settings.logo} alt="Logo" className="w-20 h-20 mx-auto rounded-full object-cover mb-2" />}
                            <h2 className="text-xl font-bold text-stone-800">{settings.associationName || 'Associação Rural'}</h2>
                            <p className="text-sm text-stone-500">Comprovante de Serviço - O.S. #{order.orderNumber}</p>
                        </header>
                        
                        <div className="border-t border-b py-2 my-4">
                            <p><strong>Produtor:</strong> {producer?.fullName}</p>
                            <p><strong>Propriedade:</strong> {producer?.propertyName}</p>
                            <p><strong>Data Abertura:</strong> {order.createdAt ? new Date(order.createdAt).toLocaleString('pt-BR') : 'N/A'}</p>
                            <p><strong>Data Fechamento:</strong> {order.closedAt ? new Date(order.closedAt).toLocaleString('pt-BR') : 'N/A'}</p>
                        </div>

                        <h3 className="font-bold mb-2 text-stone-700">Detalhes do Serviço:</h3>
                        
                        {tractor && (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <p><strong>Trator:</strong></p> <p>{tractor.name}</p>
                                <p><strong>Horímetro Inicial:</strong></p> <p>{order.initialHorimeter?.toFixed(1)}</p>
                                <p><strong>Horímetro Final:</strong></p> <p>{order.finalHorimeter?.toFixed(1)}</p>
                                <p><strong>Total de Horas:</strong></p> <p>{hoursWorked} h</p>
                                <p><strong>Valor por Hora:</strong></p> <p>R$ {tractor.hourlyRate.toFixed(2)}</p>
                            </div>
                        )}
                        {implement && !tractor && (
                             <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <p><strong>Implemento:</strong></p> <p>{implement.name}</p>
                                <p><strong>Dias de Aluguel:</strong></p> <p>{order.rentalDays}</p>
                                <p><strong>Valor por Dia:</strong></p> <p>R$ {implement.dailyRate.toFixed(2)}</p>
                            </div>
                        )}
                        
                        <div className="mt-4 pt-4 border-t text-right">
                            <p className="text-md font-semibold text-stone-800">Valor Total</p>
                            <p className="text-3xl font-bold text-emerald-700">R$ {order.totalCost?.toFixed(2)}</p>
                        </div>

                        {settings.pixKey && (
                            <div className="mt-4 pt-4 border-t text-center">
                                <p className="font-semibold text-stone-700">Pagamento via PIX</p>
                                <p className="text-lg break-words font-mono bg-stone-100 p-2 rounded">{settings.pixKey}</p>
                            </div>
                        )}

                        {(order.initialPhoto || order.finalPhoto) && (
                            <div className="mt-4 pt-4 border-t">
                                 <h3 className="font-bold mb-2 text-center text-stone-700">Fotos do Horímetro</h3>
                                 <div className="flex justify-around items-center gap-2">
                                    {order.initialPhoto && (
                                        <div className="text-center">
                                            <img src={order.initialPhoto} alt="Inicial" className="w-full max-w-[150px] rounded-lg mx-auto" />
                                            <p className="text-sm font-semibold mt-1 text-stone-600">Inicial</p>
                                        </div>
                                    )}
                                    {order.finalPhoto && (
                                        <div className="text-center">
                                            <img src={order.finalPhoto} alt="Final" className="w-full max-w-[150px] rounded-lg mx-auto" />
                                            <p className="text-sm font-semibold mt-1 text-stone-600">Final</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                        <Button onClick={handleShare} className="bg-blue-500 hover:bg-blue-600 text-white"><ShareIcon className="h-5 w-5"/> Compartilhar</Button>
                         <Button onClick={handleGeneratePdf} className="bg-red-600 hover:bg-red-700 text-white">
                            <DocumentDownloadIcon className="h-5 w-5" />
                            Gerar PDF
                        </Button>
                    </div>
                </div>
            </Modal>
        );
    };

    const BillingPage: React.FC<{ closedOrders: ServiceOrder[], producers: Producer[] }> = ({ closedOrders, producers }) => {
        const [period, setPeriod] = useState('this_month');

        const filteredOrders = useMemo(() => {
            const now = new Date();
            const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
            const startOfThisYear = new Date(now.getFullYear(), 0, 1);

            return closedOrders.filter(order => {
                if (!order.closedAt) return false;
                const closedDate = new Date(order.closedAt);
                switch (period) {
                    case 'this_month':
                        return closedDate >= startOfThisMonth;
                    case 'last_month':
                        return closedDate >= startOfLastMonth && closedDate <= endOfLastMonth;
                    case 'this_year':
                        return closedDate >= startOfThisYear;
                    default:
                        return true;
                }
            });
        }, [closedOrders, period]);
        
        const totalRevenue = filteredOrders.reduce((sum, order) => sum + (order.totalCost || 0), 0);
        const getProducerName = (id: string) => producers.find(p => p.id === id)?.fullName || 'Desconhecido';

        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold dark:text-white">Faturamento</h1>
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold">Resumo</h2>
                        <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="max-w-xs">
                            <option value="this_month">Este Mês</option>
                            <option value="last_month">Mês Passado</option>
                            <option value="this_year">Este Ano</option>
                            <option value="all">Todo o Período</option>
                        </Select>
                    </div>
                    <div className="bg-green-100 dark:bg-green-500/20 p-6 rounded-lg text-center">
                        <p className="text-lg font-semibold text-green-700">Total Faturado no Período</p>
                        <p className="text-5xl font-bold text-green-700">R$ {totalRevenue.toFixed(2)}</p>
                    </div>
                </Card>

                <Card>
                    <h2 className="text-lg font-semibold mb-3">Serviços do Período ({filteredOrders.length})</h2>
                     {filteredOrders.length > 0 ? (
                        <ul className="divide-y divide-stone-200 dark:divide-white/20">
                            {filteredOrders.map(order => (
                                 <li key={order.id} className="py-3">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold">{getProducerName(order.producerId)}</p>
                                            <p className="text-sm text-stone-500 dark:text-stone-300">{order.closedAt ? new Date(order.closedAt).toLocaleDateString('pt-BR') : 'N/A'}</p>
                                        </div>
                                        <p className="font-bold text-lg text-emerald-700">R$ {order.totalCost?.toFixed(2)}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                     ) : <p className="text-center text-stone-500 py-8">Nenhum serviço faturado no período.</p>}
                </Card>
            </div>
        );
    };

    const FuelingManager: React.FC<{
        fuelings: Fueling[];
        tractors: Tractor[];
        onFuelingsChange: () => void;
        permissions: GranularPermissions;
        currentUser: User;
    }> = ({ fuelings, tractors, onFuelingsChange, permissions, currentUser }) => {
        const [view, setView] = useState<'list' | 'autonomy'>('list');
        const [isModalOpen, setIsModalOpen] = useState(false);

        const handleSave = async (fuelingData: Omit<Fueling, 'id'>) => {
            const tractorName = tractors.find(t => t.id === fuelingData.tractorId)?.name || 'N/A';
            await logAction(currentUser.id, currentUser.fullName, 'create_fueling', { tractorName, liters: fuelingData.liters, cost: fuelingData.cost });
            await supabase.from('fuelings').insert(fuelingData);
            onFuelingsChange();
            setIsModalOpen(false);
        };

        const handleDelete = async (id: string) => {
            if(window.confirm("Tem certeza que deseja excluir este registro?")) {
                const fuelingToDelete = fuelings.find(f => f.id === id);
                if (fuelingToDelete) {
                    const tractorName = tractors.find(t => t.id === fuelingToDelete.tractorId)?.name || 'N/A';
                    await logAction(currentUser.id, currentUser.fullName, 'delete_fueling', { tractorName, liters: fuelingToDelete.liters });
                }
                await supabase.from('fuelings').delete().eq('id', id);
                onFuelingsChange();
            }
        };
        
        return (
            <div className="space-y-4">
                <h1 className="text-2xl font-bold dark:text-white">Controle de Combustível</h1>
                <div className="flex border-b border-stone-200 dark:border-white/30">
                    <button onClick={() => setView('list')} className={`px-4 py-2 font-semibold text-lg transition-colors ${view === 'list' ? 'border-b-2 border-orange-500 text-orange-600' : 'text-stone-500 hover:text-orange-600 dark:text-stone-300 dark:hover:text-orange-500'}`}>Registros</button>
                    <button onClick={() => setView('autonomy')} className={`px-4 py-2 font-semibold text-lg transition-colors ${view === 'autonomy' ? 'border-b-2 border-orange-500 text-orange-600' : 'text-stone-500 hover:text-orange-600 dark:text-stone-300 dark:hover:text-orange-500'}`}>Autonomia</button>
                </div>
                
                {view === 'list' ? (
                     <div>
                        {permissions.fueling?.create && (
                            <div className="flex justify-end mb-4">
                                <button onClick={() => setIsModalOpen(true)} className="bg-orange-500 text-white px-4 py-2 rounded-lg font-semibold shadow-md flex items-center gap-2">
                                    <PlusIcon className="w-5 h-5"/> Novo Registro
                                </button>
                            </div>
                        )}
                        <Card>
                            {fuelings.length === 0 ? <p className="text-center text-stone-500 py-8">Nenhum registro de abastecimento.</p> : (
                                <ul className="divide-y divide-stone-200 dark:divide-white/20">
                                    {fuelings.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(f => (
                                        <li key={f.id} className="py-3 flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold">{tractors.find(t => t.id === f.tractorId)?.name}</p>
                                                <p className="text-sm text-stone-600 dark:text-stone-300">{f.liters}L - R${f.cost.toFixed(2)} - {f.horimeter}h</p>
                                                <p className="text-xs text-stone-500 dark:text-stone-400">{new Date(f.date).toLocaleDateString()}</p>
                                            </div>
                                            {permissions.fueling?.edit && (
                                                <button onClick={() => handleDelete(f.id)} className="font-semibold text-red-600 hover:text-red-800 text-sm mt-1">Excluir</button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Card>
                    </div>
                ) : <AutonomyView fuelings={fuelings} tractors={tractors} />}

                {isModalOpen && <FuelingForm tractors={tractors} onSave={handleSave} onClose={() => setIsModalOpen(false)} />}
            </div>
        );
    };

    const FuelingForm: React.FC<{
        tractors: Tractor[];
        onSave: (fueling: Omit<Fueling, 'id'>) => void;
        onClose: () => void;
    }> = ({ tractors, onSave, onClose }) => {
        const [tractorId, setTractorId] = useState('');
        const [horimeter, setHorimeter] = useState<number | ''>('');
        const [liters, setLiters] = useState<number | ''>('');
        const [cost, setCost] = useState<number | ''>('');

        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            if (!tractorId || horimeter === '' || liters === '' || cost === '') {
                alert("Preencha todos os campos.");
                return;
            }
            onSave({
                tractorId,
                horimeter: Number(horimeter),
                liters: Number(liters),
                cost: Number(cost),
                date: new Date().toISOString(),
            });
        };
        
        return (
            <Modal title="Registrar Abastecimento" onClose={onClose}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Select value={tractorId} onChange={e => setTractorId(e.target.value)} required>
                        <option value="">Selecione um Trator</option>
                        {tractors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </Select>
                    <Input type="number" step="0.1" value={horimeter} onChange={e => setHorimeter(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Horímetro no momento" required />
                    <Input type="number" step="0.01" value={liters} onChange={e => setLiters(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Litros Abastecidos" required />
                    <Input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Custo Total (R$)" required />
                    <Button type="submit">Salvar Registro</Button>
                </form>
            </Modal>
        );
    };

    const AutonomyView: React.FC<{ fuelings: Fueling[], tractors: Tractor[] }> = ({ fuelings, tractors }) => {
        const autonomyData = useMemo(() => {
            return tractors.map(tractor => {
                const tractorFuelings = fuelings
                    .filter(f => f.tractorId === tractor.id)
                    .sort((a, b) => a.horimeter - b.horimeter);

                if (tractorFuelings.length < 2) {
                    return null;
                }

                const firstFueling = tractorFuelings[0];
                const lastFueling = tractorFuelings[tractorFuelings.length - 1];
                const totalHours = lastFueling.horimeter - firstFueling.horimeter;
                const totalLiters = tractorFuelings.slice(0, -1).reduce((sum, f) => sum + f.liters, 0);
                const totalCost = tractorFuelings.slice(0, -1).reduce((sum, f) => sum + f.cost, 0);
                const avgConsumption = totalLiters > 0 ? totalHours / totalLiters : 0; // hours per liter
                const avgCostPerHour = totalHours > 0 ? totalCost / totalHours : 0;

                return { tractorName: tractor.name, avgConsumption, totalHours, totalLiters, avgCostPerHour };
            }).filter(Boolean);
        }, [fuelings, tractors]);

        return (
            <div className="space-y-4">
                {autonomyData.length === 0 ? <p className="text-center text-stone-500 py-8">Dados insuficientes para calcular a autonomia. É necessário ter pelo menos 2 registros de abastecimento por trator.</p> :
                    autonomyData.map((data, index) => (
                        <Card key={index}>
                            <h3 className="font-bold text-lg mb-3">{data!.tractorName}</h3>
                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div>
                                    <p className="text-2xl font-bold text-emerald-600">{data!.avgConsumption.toFixed(2)}</p>
                                    <p className="text-sm text-stone-600 dark:text-stone-300">Horas / Litro</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-sky-600">R$ {data!.avgCostPerHour.toFixed(2)}</p>
                                    <p className="text-sm text-stone-600 dark:text-stone-300">Custo / Hora</p>
                                </div>
                            </div>
                            <div className="text-xs text-stone-500 dark:text-stone-400 text-center mt-4">
                                Calculado com base em {data!.totalHours.toFixed(1)} horas e {data!.totalLiters.toFixed(1)} litros.
                            </div>
                        </Card>
                    ))
                }
            </div>
        );
    };

    const RegistryManager: React.FC<{
        producers: Producer[];
        tractors: Tractor[];
        equipmentImplements: Implement[];
        onRegistriesChange: () => void;
        permissions: GranularPermissions;
        currentUser: User;
    }> = ({ producers, tractors, equipmentImplements, onRegistriesChange, permissions, currentUser }) => {
        const [view, setView] = useState<'producers' | 'equipment'>('producers');

        return (
            <div className="space-y-4">
                <h1 className="text-2xl font-bold dark:text-white">Cadastros</h1>
                <div className="flex border-b border-stone-200 dark:border-white/30">
                    <button onClick={() => setView('producers')} className={`px-4 py-2 font-semibold text-lg transition-colors ${view === 'producers' ? 'border-b-2 border-orange-500 text-orange-600' : 'text-stone-500 hover:text-orange-600 dark:text-stone-300 dark:hover:text-orange-500'}`}>Produtores</button>
                    <button onClick={() => setView('equipment')} className={`px-4 py-2 font-semibold text-lg transition-colors ${view === 'equipment' ? 'border-b-2 border-orange-500 text-orange-600' : 'text-stone-500 hover:text-orange-600 dark:text-stone-300 dark:hover:text-orange-500'}`}>Equipamentos</button>
                </div>
                {view === 'producers' ? 
                    <ProducerManager producers={producers} onProducersChange={onRegistriesChange} permissions={permissions} currentUser={currentUser} /> : 
                    <EquipmentManager tractors={tractors} equipmentImplements={equipmentImplements} onEquipmentsChange={onRegistriesChange} permissions={permissions} currentUser={currentUser} />}
            </div>
        );
    };

    const ProducerManager: React.FC<{
        producers: Producer[];
        onProducersChange: () => void;
        permissions: GranularPermissions;
        currentUser: User;
    }> = ({ producers, onProducersChange, permissions, currentUser }) => {
        const [isModalOpen, setIsModalOpen] = useState(false);
        const [editingProducer, setEditingProducer] = useState<Producer | null>(null);

        const openModal = (producer: Producer | null = null) => {
            setEditingProducer(producer);
            setIsModalOpen(true);
        };

        const closeModal = () => {
            setEditingProducer(null);
            setIsModalOpen(false);
        };

        const handleSave = async (producerData: Omit<Producer, 'id'>) => {
            const action = editingProducer ? 'update_producer' : 'create_producer';
            await logAction(currentUser.id, currentUser.fullName, action, { producerName: producerData.fullName });
            if (editingProducer) {
                 const { error } = await supabase.from('producers').update(producerData).eq('id', editingProducer.id);
                 if (error) alert("Erro ao atualizar produtor.");
            } else {
                const { error } = await supabase.from('producers').insert(producerData);
                if (error) alert("Erro ao criar produtor.");
            }
            onProducersChange();
            closeModal();
        };
        
        const handleDelete = async (id: string) => {
            if(window.confirm("Tem certeza que deseja excluir este produtor?")) {
                const producerToDelete = producers.find(p => p.id === id);
                if (producerToDelete) {
                    await logAction(currentUser.id, currentUser.fullName, 'delete_producer', { producerName: producerToDelete.fullName });
                }
                await supabase.from('producers').delete().eq('id', id);
                onProducersChange();
            }
        };

        return (
            <div className="space-y-6">
                <header className="flex justify-between items-center">
                     <h2 className="text-2xl font-bold dark:text-white">Produtores</h2>
                     {permissions.registries?.create && (
                        <button onClick={() => openModal()} className="bg-orange-500 text-white px-4 py-2 rounded-lg font-semibold shadow-md flex items-center gap-2">
                            <PlusIcon className="w-5 h-5"/> Novo
                        </button>
                     )}
                </header>
                <Card>
                    {producers.length === 0 ? (
                        <p className="text-center text-stone-500 py-8">Nenhum produtor cadastrado.</p>
                    ) : (
                        <ul className="divide-y divide-stone-200 dark:divide-white/20">
                            {producers.map(p => (
                                <li key={p.id} className="py-4 flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-lg">{p.fullName}</p>
                                        <p className="text-sm text-stone-600 dark:text-stone-300">{p.propertyName}</p>
                                    </div>
                                    {permissions.registries?.edit && (
                                        <div className="flex gap-2">
                                            <button onClick={() => openModal(p)} className="font-semibold text-orange-600 hover:text-orange-800 text-sm">Editar</button>
                                            <button onClick={() => handleDelete(p.id)} className="font-semibold text-red-600 hover:text-red-800 text-sm">Excluir</button>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
                {isModalOpen && (
                    <ProducerForm
                        producer={editingProducer}
                        onSave={handleSave}
                        onClose={closeModal}
                    />
                )}
            </div>
        );
    };

    const ProducerForm: React.FC<{
        producer: Producer | null;
        onSave: (producer: Omit<Producer, 'id'>) => void;
        onClose: () => void;
    }> = ({ producer, onSave, onClose }) => {
        const [formData, setFormData] = useState({
            fullName: producer?.fullName || '',
            cpf: producer?.cpf || '',
            address: producer?.address || '',
            propertyName: producer?.propertyName || '',
            propertyLocation: producer?.propertyLocation || '',
            addressIsProperty: producer?.addressIsProperty || false,
        });

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const { name, value, type, checked } = e.target;
            setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        };

        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            onSave(formData);
        };
        
        React.useEffect(() => {
            if (formData.addressIsProperty) {
                setFormData(prev => ({...prev, propertyLocation: prev.address}));
            }
        }, [formData.addressIsProperty, formData.address]);

        return (
            <Modal title={producer ? "Editar Produtor" : "Novo Produtor"} onClose={onClose}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input name="fullName" value={formData.fullName} onChange={handleChange} placeholder="Nome Completo" required />
                    <Input name="cpf" value={formData.cpf} onChange={handleChange} placeholder="CPF" />
                    <Input name="address" value={formData.address} onChange={handleChange} placeholder="Endereço" required />
                    <Input name="propertyName" value={formData.propertyName} onChange={handleChange} placeholder="Nome da Propriedade" required />
                    <div>
                        <label className="flex items-center gap-2 p-2 rounded-md hover:bg-stone-200 dark:hover:bg-white/10 cursor-pointer">
                            <input type="checkbox" name="addressIsProperty" checked={formData.addressIsProperty} onChange={handleChange} className="h-5 w-5 rounded border-stone-300 text-orange-600 focus:ring-orange-500" />
                            <span>Endereço da propriedade é o mesmo</span>
                        </label>
                    </div>
                    <Input name="propertyLocation" value={formData.propertyLocation} onChange={handleChange} placeholder="Local da Propriedade" required disabled={formData.addressIsProperty} className="disabled:bg-stone-200 dark:disabled:bg-white/10"/>
                    <Button type="submit">Salvar Produtor</Button>
                </form>
            </Modal>
        );
    };

    const EquipmentManager: React.FC<{
        tractors: Tractor[];
        equipmentImplements: Implement[];
        onEquipmentsChange: () => void;
        permissions: GranularPermissions;
        currentUser: User;
    }> = ({ tractors, equipmentImplements, onEquipmentsChange, permissions, currentUser }) => {
        const [view, setView] = useState<'tractors' | 'implements'>('tractors');
        
        return (
            <div className="space-y-4">
                 <h2 className="text-2xl font-bold dark:text-white">Equipamentos</h2>
                <div className="flex border-b border-stone-200 dark:border-white/30">
                    <button onClick={() => setView('tractors')} className={`px-4 py-2 font-semibold text-lg transition-colors ${view === 'tractors' ? 'border-b-2 border-orange-500 text-orange-600' : 'text-stone-500 hover:text-orange-600 dark:text-stone-300 dark:hover:text-orange-500'}`}>Tratores</button>
                    <button onClick={() => setView('implements')} className={`px-4 py-2 font-semibold text-lg transition-colors ${view === 'implements' ? 'border-b-2 border-orange-500 text-orange-600' : 'text-stone-500 hover:text-orange-600 dark:text-stone-300 dark:hover:text-orange-500'}`}>Implementos</button>
                </div>
                {view === 'tractors' ? <TractorSection tractors={tractors} onEquipmentsChange={onEquipmentsChange} permissions={permissions} currentUser={currentUser} /> : <ImplementSection equipmentImplements={equipmentImplements} onEquipmentsChange={onEquipmentsChange} permissions={permissions} currentUser={currentUser} />}
            </div>
        );
    };

    const TractorSection: React.FC<{tractors: Tractor[], onEquipmentsChange: () => void, permissions: GranularPermissions, currentUser: User}> = ({tractors, onEquipmentsChange, permissions, currentUser}) => {
        const [isModalOpen, setIsModalOpen] = useState(false);
        const [editingTractor, setEditingTractor] = useState<Tractor | null>(null);

        const openModal = (tractor: Tractor | null = null) => {
            setEditingTractor(tractor);
            setIsModalOpen(true);
        };

        const handleSave = async (tractorData: Omit<Tractor, 'id'>) => {
            const action = editingTractor ? 'update_tractor' : 'create_tractor';
            await logAction(currentUser.id, currentUser.fullName, action, { tractorName: tractorData.name });
            if (editingTractor) {
                await supabase.from('tractors').update(tractorData).eq('id', editingTractor.id);
            } else {
                await supabase.from('tractors').insert(tractorData);
            }
            onEquipmentsChange();
            setIsModalOpen(false);
            setEditingTractor(null);
        };
        
        const handleDelete = async (id: string) => {
            if(window.confirm("Tem certeza?")) {
                const tractorToDelete = tractors.find(t => t.id === id);
                if (tractorToDelete) {
                    await logAction(currentUser.id, currentUser.fullName, 'delete_tractor', { tractorName: tractorToDelete.name });
                }
                await supabase.from('tractors').delete().eq('id', id);
                onEquipmentsChange();
            }
        };
        
        return (
            <div>
                {permissions.registries?.create && (
                    <div className="flex justify-end mb-4">
                        <button onClick={() => openModal()} className="bg-orange-500 text-white px-4 py-2 rounded-lg font-semibold shadow-md flex items-center gap-2"><PlusIcon className="w-5 h-5"/> Novo Trator</button>
                    </div>
                )}
                <Card>
                    {tractors.length === 0 ? <p className="text-center text-stone-500 py-8">Nenhum trator cadastrado.</p> : (
                        <ul className="divide-y divide-stone-200 dark:divide-white/20">
                            {tractors.map(t => (
                                <li key={t.id} className="py-3 flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold">{t.name}</p>
                                        <p className="text-sm text-stone-600 dark:text-stone-300">R$ {t.hourlyRate.toFixed(2)} / hora</p>
                                    </div>
                                    {permissions.registries?.edit && (
                                        <div className="flex gap-2">
                                            <button onClick={() => openModal(t)} className="font-semibold text-orange-600 hover:text-orange-800 text-sm">Editar</button>
                                            <button onClick={() => handleDelete(t.id)} className="font-semibold text-red-600 hover:text-red-800 text-sm">Excluir</button>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
                {isModalOpen && (
                    <TractorForm
                        item={editingTractor}
                        onSave={handleSave}
                        onClose={() => setIsModalOpen(false)}
                    />
                )}
            </div>
        );
    };

    const TractorForm: React.FC<{ item: Tractor | null, onSave: (data: any) => void, onClose: () => void }> = ({ item, onSave, onClose }) => {
        const [formData, setFormData] = useState({
            name: item?.name || '',
            hourlyRate: item?.hourlyRate || '',
            maintenanceIntervalHours: item?.maintenanceIntervalHours || '',
            lastMaintenanceHorimeter: item?.lastMaintenanceHorimeter || ''
        });

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const { name, value } = e.target;
            setFormData(prev => ({ ...prev, [name]: value }));
        };

        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            onSave({
                name: formData.name,
                hourlyRate: parseFloat(String(formData.hourlyRate)),
                maintenanceIntervalHours: formData.maintenanceIntervalHours ? parseInt(String(formData.maintenanceIntervalHours), 10) : undefined,
                lastMaintenanceHorimeter: formData.lastMaintenanceHorimeter ? parseFloat(String(formData.lastMaintenanceHorimeter)) : undefined,
            });
        };

        return (
            <Modal title={item ? 'Editar Trator' : 'Novo Trator'} onClose={onClose}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input name="name" value={formData.name} onChange={handleChange} placeholder="Nome do Trator" required />
                    <Input type="number" name="hourlyRate" value={formData.hourlyRate} onChange={handleChange} placeholder="Valor por Hora" required step="0.01" />
                    <h3 className="text-lg font-semibold pt-2 border-t mt-4 dark:border-white/20">Controle de Revisão (Opcional)</h3>
                    <Input type="number" name="maintenanceIntervalHours" value={formData.maintenanceIntervalHours} onChange={handleChange} placeholder="Intervalo de revisão (em horas)" />
                    <Input type="number" name="lastMaintenanceHorimeter" value={formData.lastMaintenanceHorimeter} onChange={handleChange} placeholder="Horímetro da última revisão" step="0.1" />
                    <Button type="submit">Salvar</Button>
                </form>
            </Modal>
        );
    };

    const ImplementSection: React.FC<{equipmentImplements: Implement[], onEquipmentsChange: () => void, permissions: GranularPermissions, currentUser: User}> = ({equipmentImplements, onEquipmentsChange, permissions, currentUser}) => {
        const [isModalOpen, setIsModalOpen] = useState(false);
        const [editingImplement, setEditingImplement] = useState<Implement | null>(null);

        const openModal = (item: Implement | null = null) => {
            setEditingImplement(item);
            setIsModalOpen(true);
        };
        
        const handleSave = async (itemData: any) => {
            const action = editingImplement ? 'update_implement' : 'create_implement';
            await logAction(currentUser.id, currentUser.fullName, action, { implementName: itemData.name });
            if (editingImplement) {
                await supabase.from('implements').update({ name: itemData.name, dailyRate: itemData.dailyRate }).eq('id', editingImplement.id);
            } else {
                await supabase.from('implements').insert({ name: itemData.name, dailyRate: itemData.dailyRate });
            }
            onEquipmentsChange();
            setIsModalOpen(false);
            setEditingImplement(null);
        };
        
        const handleDelete = async (id: string) => {
            if(window.confirm("Tem certeza?")) {
                const implementToDelete = equipmentImplements.find(i => i.id === id);
                if (implementToDelete) {
                    await logAction(currentUser.id, currentUser.fullName, 'delete_implement', { implementName: implementToDelete.name });
                }
                await supabase.from('implements').delete().eq('id', id);
                onEquipmentsChange();
            }
        };
        
        return (
            <div>
                {permissions.registries?.create && (
                    <div className="flex justify-end mb-4">
                        <button onClick={() => openModal()} className="bg-orange-500 text-white px-4 py-2 rounded-lg font-semibold shadow-md flex items-center gap-2"><PlusIcon className="w-5 h-5"/> Novo Implemento</button>
                    </div>
                )}
                <Card>
                    {equipmentImplements.length === 0 ? <p className="text-center text-stone-500 py-8">Nenhum implemento cadastrado.</p> : (
                        <ul className="divide-y divide-stone-200 dark:divide-white/20">
                            {equipmentImplements.map(i => (
                                <li key={i.id} className="py-3 flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold">{i.name}</p>
                                        <p className="text-sm text-stone-600 dark:text-stone-300">R$ {i.dailyRate.toFixed(2)} / dia</p>
                                    </div>
                                    {permissions.registries?.edit && (
                                        <div className="flex gap-2">
                                            <button onClick={() => openModal(i)} className="font-semibold text-orange-600 hover:text-orange-800 text-sm">Editar</button>
                                            <button onClick={() => handleDelete(i.id)} className="font-semibold text-red-600 hover:text-red-800 text-sm">Excluir</button>
                                        </div>
                                     )}
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
                {isModalOpen && (
                    <Modal title={editingImplement ? 'Editar Implemento' : 'Novo Implemento'} onClose={() => setIsModalOpen(false)}>
                        <TractorImplementForm<Implement>
                            item={editingImplement}
                            onSave={handleSave}
                            rateLabel="Valor por Dia"
                            rateKey="dailyRate"
                        />
                    </Modal>
                )}
            </div>
        );
    };

    const TractorImplementForm = <T extends { name: string; hourlyRate?: number; dailyRate?: number; },>({ item, onSave, rateLabel, rateKey }: { item: T | null; onSave: (data: any) => void; rateLabel: string; rateKey: keyof T & ('hourlyRate' | 'dailyRate') }) => {
        const [name, setName] = useState(item?.name || '');
        const [rate, setRate] = useState(item ? (item[rateKey] as number) : 0);

        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            const data = {
                name,
                [rateKey]: rate,
            };
            onSave(data);
        };

        return (
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" required />
                <Input type="number" value={rate} onChange={(e) => setRate(parseFloat(e.target.value))} placeholder={rateLabel} required step="0.01" min="0"/>
                <Button type="submit">Salvar</Button>
            </form>
        );
    };

    if (loading && !settings) return <FullscreenLoader />;
    
    const renderPage = () => {
        if (currentView.type === 'new_service') {
            return <ServiceOrderForm producers={producers} tractors={tractors} equipmentImplements={equipmentImplements} serviceOrders={serviceOrders} schedules={schedules} onSave={handleSaveServiceOrder} onClose={() => {setCurrentView({ type: 'list' }); setPage('services');}} />;
        }
        if (currentView.type === 'close_service' && currentView.id) {
            const order = serviceOrders.find(s => s.id === currentView.id);
            if (order) return <CloseServiceOrder order={order} producers={producers} tractors={tractors} equipmentImplements={equipmentImplements} onSave={handleCloseServiceOrder} onClose={() => {setCurrentView({ type: 'list' }); setPage('services');}} />;
        }
        if (currentView.type === 'view_service' && currentView.id) {
            const order = serviceOrders.find(s => s.id === currentView.id);
            if (order) return <ServiceOrderSummary order={order} producers={producers} tractors={tractors} equipmentImplements={equipmentImplements} settings={settings!} onClose={() => {setCurrentView({ type: 'list' }); setPage('services');}} />;
        }
        
        switch (page) {
            case 'dashboard':
                return <Dashboard currentUser={currentUser} serviceOrders={serviceOrders} schedules={schedules} onNavigate={setPage} onNewService={() => setCurrentView({ type: 'new_service' })} settings={settings!} maintenanceAlerts={maintenanceAlerts} onMarkAsReviewed={handlePromptForReview} />;
            case 'services':
                return <ServiceManager serviceOrders={serviceOrders} producers={producers} tractors={tractors} equipmentImplements={equipmentImplements} onNewService={() => setCurrentView({ type: 'new_service' })} setView={setCurrentView} permissions={userPermissions}/>;
            case 'billing':
                return <BillingPage closedOrders={serviceOrders.filter(o => o.status === 'closed')} producers={producers} />;
            case 'fueling':
                return <FuelingManager fuelings={fuelings} tractors={tractors} onFuelingsChange={() => refreshData(['fuelings'])} permissions={userPermissions} currentUser={currentUser} />;
            case 'registries':
                return <RegistryManager producers={producers} tractors={tractors} equipmentImplements={equipmentImplements} onRegistriesChange={() => refreshData(['producers', 'tractors', 'implements'])} permissions={userPermissions} currentUser={currentUser} />;
            case 'schedules':
                return <ScheduleManagerPage schedules={schedules} producers={producers} tractors={tractors} implementOptions={equipmentImplements} onSchedulesChange={() => refreshData(['schedules'])} permissions={userPermissions} currentUser={currentUser} />;
            case 'settings':
                return <SettingsPage settings={settings!} currentUser={currentUser} users={users} roles={roles} logs={logs} onDataChange={() => refreshData(['users', 'producers', 'roles', 'logs'])} />;
            case 'maintenance':
                return <MaintenanceAndExpensesPage 
                            tractors={tractors} 
                            expenses={expenses} 
                            fuelings={fuelings} 
                            serviceOrders={serviceOrders} 
                            maintenanceHistory={maintenanceHistory}
                            onDataChange={() => refreshData(['expenses', 'maintenanceHistory'])} 
                            permissions={userPermissions}
                            currentUser={currentUser}
                        />;
            default:
                return <div>Página não encontrada</div>;
        }
    };
    
    const BottomNav: React.FC<{ activePage: Page; onNavigate: (page: Page) => void; permissions: GranularPermissions }> = ({ activePage, onNavigate, permissions }) => {
        const quickActionPages: Page[] = ['services', 'schedules', 'registries', 'maintenance'];

        const navItems = [
            { id: 'dashboard', label: 'Início', icon: <TractorIcon /> },
            { id: 'services', label: 'Serviços', icon: <DocumentTextIcon /> },
            { id: 'billing', label: 'Faturam.', icon: <CurrencyDollarIcon/> },
            { id: 'registries', label: 'Cadastros', icon: <ArchiveBoxIcon /> },
            { id: 'fueling', label: 'Abastec.', icon: <FuelPumpIcon /> },
            { id: 'schedules', label: 'Agenda', icon: <CalendarDaysIcon /> },
            { id: 'maintenance', label: 'Manuten.', icon: <WrenchScrewdriverIcon /> },
        ].filter(item => {
            if (item.id === 'dashboard') return true;
            if (quickActionPages.includes(item.id as Page)) return false;
            return permissions[item.id as Page]?.view;
        }) as {id: Page, label: string, icon: React.ReactElement}[];

        return (
            <nav className="fixed bottom-0 left-0 right-0 shadow-[0_-2px_10px_rgba(0,0,0,0.1)] flex justify-around rounded-t-2xl bg-white border-t border-stone-200 dark:bg-black/30 dark:backdrop-blur-lg dark:border-white/20">
                {navItems.map(item => (
                    <button key={item.id} onClick={() => onNavigate(item.id)} className={`flex flex-col items-center justify-center p-2 w-full transition-colors group ${activePage === item.id ? 'text-orange-600' : 'text-stone-500 hover:text-orange-500 dark:text-stone-300 dark:hover:text-orange-500'}`}>
                        <div className={`relative transition-all ${activePage === item.id ? '-translate-y-4' : 'group-hover:-translate-y-1'}`}>
                            <span className={`absolute -inset-2 bg-orange-500 rounded-full transition-opacity opacity-0 ${activePage === item.id ? 'opacity-10' : ''}`}></span>
                             {React.cloneElement(item.icon as React.ReactElement<{ className?: string }>, { className: 'w-7 h-7 mb-1' })}
                        </div>
                        <span className={`text-xs font-semibold transition-opacity ${activePage === item.id ? 'opacity-100' : 'opacity-0'}`}>{item.label}</span>
                    </button>
                ))}
            </nav>
        );
    };
    
    if (loading && !settings) return <FullscreenLoader />;

    return (
        <>
            {(!session || !currentUser) ? (
                authView === 'login' 
                    ? <LoginPage settings={settings} onSwitchToRegister={() => setAuthView('register')} />
                    : <RegisterPage onSwitchToLogin={() => setAuthView('login')} />
            ) : currentUser.status !== 'approved' ? (
                <div className="text-center py-20 p-4">
                    <ShieldCheckIcon className="w-24 h-24 mx-auto text-yellow-400" />
                    <h1 className="text-3xl font-bold text-stone-800 mt-4">Acesso Pendente</h1>
                    <p className="text-stone-600 mt-2">Sua conta está aguardando aprovação de um administrador.</p>
                    <button onClick={() => supabase.auth.signOut()} className="mt-6 bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold shadow-md">
                        Sair
                    </button>
                </div>
            ) : (
                <>
                    {settings?.appBackground && (
                        <>
                            <div 
                                className="fixed inset-0 -z-20 bg-cover bg-center" 
                                style={{ backgroundImage: `url(${settings.appBackground})` }} 
                            />
                            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm -z-10" />
                        </>
                    )}
                    <div className={`min-h-screen ${settings?.appBackground ? 'text-white' : 'text-stone-900'}`}>
                        {loading && <FullscreenLoader text="Sincronizando dados..."/>}

                        <header className={`fixed top-0 left-0 right-0 z-30 p-4 max-w-4xl mx-auto flex justify-between items-center ${settings?.appBackground ? 'bg-black/30 backdrop-blur-lg border-b border-white/20' : 'bg-stone-100 border-b border-stone-200'}`}>
                            <button
                                onClick={() => supabase.auth.signOut()}
                                className="text-stone-500 hover:text-orange-600 dark:text-stone-300 dark:hover:text-orange-500 transition-colors"
                                aria-label="Sair da conta"
                            >
                                <ArrowLeftOnRectangleIcon className="w-7 h-7" />
                            </button>
                            <div className="flex items-center gap-4">
                                <button onClick={() => setIsNotificationsOpen(true)} className="text-stone-500 dark:text-stone-300 relative">
                                    <BellIcon className="w-7 h-7"/>
                                    {maintenanceAlerts.length > 0 && <span className={`absolute top-0 right-0 block h-3 w-3 rounded-full bg-red-500 border-2 ${settings?.appBackground ? 'border-transparent' : 'border-stone-100'}`} />}
                                </button>
                                {userPermissions.settings?.view && (
                                    <button
                                        onClick={() => { setPage('settings'); setCurrentView({ type: 'list' }); }}
                                        className="text-stone-500 hover:text-orange-600 dark:text-stone-300 dark:hover:text-orange-500 transition-colors"
                                        aria-label="Ajustes"
                                    >
                                        <CogIcon className="w-7 h-7" />
                                    </button>
                                )}
                            </div>
                        </header>

                        <main className="px-4 pt-20 pb-28 max-w-4xl mx-auto">
                            {renderPage()}
                        </main>

                        {isNotificationsOpen && (
                            <NotificationsModal
                                alerts={maintenanceAlerts}
                                onClose={() => setIsNotificationsOpen(false)}
                                onMarkAsReviewed={handlePromptForReview}
                            />
                        )}
                        
                        <ReviewConfirmationModal
                            isOpen={reviewModalState.isOpen}
                            onClose={() => setReviewModalState({ isOpen: false, tractorId: null, tractorName: null, suggestedHorimeter: null })}
                            onConfirm={(horimeter) => {
                                if (reviewModalState.tractorId) {
                                    handleConfirmReview(reviewModalState.tractorId, horimeter);
                                }
                            }}
                            tractorName={reviewModalState.tractorName}
                            suggestedHorimeter={reviewModalState.suggestedHorimeter}
                        />

                        <BottomNav activePage={page} onNavigate={(p: Page) => { setPage(p); setCurrentView({ type: 'list' }); }} permissions={userPermissions} />
                    </div>
                </>
            )}
            
            {installPromptEvent && <InstallPWAButton onInstall={handleInstallClick} />}
            <IOSInstallPrompt />
        </>
    );
};
export default App;