import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import Card from './Card';
import Button from './Button';
import Input from './Input';
import { UserPlusIcon, UserCircleIcon, EnvelopeIcon, KeyIcon, ShieldCheckIcon } from './components/icons';

const RegisterPage: React.FC<{
    onSwitchToLogin: () => void;
}> = ({ onSwitchToLogin }) => {
    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }
        setLoading(true);
        setError('');
        setSuccess('');

        const { error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName, // Supabase espera snake_case aqui
                    username: username,
                }
            }
        });

        if (authError) {
            if (authError.message.includes('unique constraint') || authError.message.includes('already registered')) {
                 setError('Email ou nome de usuário já cadastrado.');
            } else {
                 setError('Erro ao cadastrar. Tente novamente.');
            }
            setLoading(false);
            return;
        }

        setSuccess('Cadastro realizado! Por favor, verifique seu e-mail para confirmar a conta. Após a confirmação, um admin precisará aprovar seu acesso.');
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-stone-100 flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <UserPlusIcon className="w-16 h-16 mx-auto text-orange-500"/>
                    <h1 className="text-4xl font-bold text-stone-800 mt-2">Criar Conta</h1>
                    <p className="text-stone-600">Preencha seus dados para se registrar</p>
                </div>
                <Card className="shadow-2xl">
                    {!success ? (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <UserCircleIcon className="w-5 h-5 text-stone-400" />
                                </div>
                                <Input type="text" placeholder="Nome Completo" value={fullName} onChange={e => setFullName(e.target.value)} required className="pl-10"/>
                            </div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <UserCircleIcon className="w-5 h-5 text-stone-400" />
                                </div>
                                <Input type="text" placeholder="Nome de Usuário" value={username} onChange={e => setUsername(e.target.value)} required className="pl-10"/>
                            </div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <EnvelopeIcon className="w-5 h-5 text-stone-400" />
                                </div>
                                <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className="pl-10"/>
                            </div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <KeyIcon className="w-5 h-5 text-stone-400" />
                                </div>
                                <Input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} required className="pl-10"/>
                            </div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <KeyIcon className="w-5 h-5 text-stone-400" />
                                </div>
                                <Input type="password" placeholder="Confirmar Senha" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="pl-10"/>
                            </div>

                            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                            <Button type="submit" disabled={loading}><UserPlusIcon className="w-5 h-5"/> {loading ? 'Cadastrando...' : 'Cadastrar'}</Button>
                        </form>
                    ) : (
                        <div className="text-center p-4">
                            <ShieldCheckIcon className="w-16 h-16 mx-auto text-green-500"/>
                            <p className="mt-4 text-green-700 font-semibold">{success}</p>
                        </div>
                    )}
                </Card>
                 <div className="text-center mt-6">
                    <button onClick={onSwitchToLogin} className="text-orange-600 font-semibold hover:underline">
                        Já tem uma conta? Faça o login
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;