import React, { useState, useEffect } from 'react';
import { supabase, getEmailByUsername, getUserProfile, logAction } from './supabaseClient';
import type { Settings } from './types';
import Card from './Card';
import Button from './Button';
import Input from './Input';
import { LeafIcon, ArrowRightOnRectangleIcon, KeyIcon, UserCircleIcon } from './components/icons';

const LoginPage: React.FC<{
    settings?: Settings;
    onSwitchToRegister: () => void;
}> = ({ settings, onSwitchToRegister }) => {
    const initialRememberMe = localStorage.getItem('rememberMe') === 'true';

    const [username, setUsername] = useState(() => initialRememberMe ? (localStorage.getItem('rememberedUsername') || '') : '');
    const [password, setPassword] = useState(() => initialRememberMe ? (localStorage.getItem('rememberedPassword') || '') : '');
    const [rememberMe, setRememberMe] = useState(initialRememberMe);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    const backgroundStyle = settings?.loginBackground ? { backgroundImage: `url(${settings.loginBackground})` } : {};
    const hasBackground = !!settings?.loginBackground;

    useEffect(() => {
        if (hasBackground) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        return () => { // Cleanup when component unmounts
            document.documentElement.classList.remove('dark');
        };
    }, [hasBackground]);


    useEffect(() => {
        if (rememberMe) {
            localStorage.setItem('rememberMe', 'true');
            localStorage.setItem('rememberedUsername', username);
            localStorage.setItem('rememberedPassword', password);
        } else {
            localStorage.removeItem('rememberMe');
            localStorage.removeItem('rememberedUsername');
            localStorage.removeItem('rememberedPassword');
        }
    }, [rememberMe, username, password]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const userEmail = await getEmailByUsername(username.trim());
        if (!userEmail) {
            setError('Nome de usuário não encontrado.');
            setLoading(false);
            return;
        }

        const { data: { session }, error: signInError } = await supabase.auth.signInWithPassword({
            email: userEmail,
            password: password,
        });

        if (signInError) {
            if (signInError.message.includes("Invalid login credentials")) {
                setError('Nome de usuário ou senha inválidos.');
            } else if (signInError.message.includes("Email not confirmed")) {
                 setError('Por favor, confirme seu email antes de fazer login.');
            } else {
                setError('Ocorreu um erro. Tente novamente.');
            }
            setPassword(''); // Limpa a senha em caso de erro
        } else if (session?.user) {
            const profile = await getUserProfile(session.user.id);
            if (profile) {
                await logAction(profile.id, profile.fullName, 'user_login');
            }
        }
        
        setLoading(false);
    };

    return (
         <div
            className="min-h-screen bg-stone-100 flex flex-col justify-end items-center p-4 bg-cover bg-center"
            style={backgroundStyle}
        >
            {hasBackground && <div className="absolute inset-0 bg-black/50"></div>}
            
            <div className="w-full max-w-md relative pb-8">
                <div className="text-center mb-8">
                    {settings?.logo ? (
                        <img src={settings.logo} alt="Logo da Associação" className="w-64 h-64 mx-auto rounded-full object-cover border-4 border-white shadow-lg mb-4"/>
                    ) : (
                        <LeafIcon className={`w-48 h-48 mx-auto ${hasBackground ? 'text-white' : 'text-orange-500'}`}/>
                    )}
                    <h1 className={`text-4xl font-bold mt-2 ${hasBackground ? 'text-white' : 'text-stone-800'}`}>{settings?.associationName || "Gestor Rural"}</h1>
                    <p className={`${hasBackground ? 'text-stone-200' : 'text-stone-600'}`}>Acesse sua conta</p>
                </div>
                <Card className="shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <UserCircleIcon className="w-5 h-5 text-stone-400 dark:text-stone-300" />
                            </div>
                            <Input type="text" placeholder="Nome de Usuário" value={username} onChange={e => setUsername(e.target.value)} required 
                                className="pl-10"/>
                        </div>
                        <div className="relative">
                             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <KeyIcon className="w-5 h-5 text-stone-400 dark:text-stone-300" />
                            </div>
                            <Input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} required 
                                className="pl-10"/>
                        </div>

                        <div className="flex items-center">
                            <input
                                id="remember-me"
                                name="remember-me"
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-stone-300 rounded"
                            />
                            <label htmlFor="remember-me" className="ml-2 block text-sm text-stone-900 dark:text-stone-200">
                                Lembrar-me
                            </label>
                        </div>
                        {error && <p className="text-red-500 text-sm text-center font-semibold">{error}</p>}
                        <Button type="submit" disabled={loading}><ArrowRightOnRectangleIcon className="w-5 h-5"/> {loading ? 'Entrando...' : 'Entrar'}</Button>
                    </form>
                </Card>
                <div className="text-center mt-6">
                    <button onClick={onSwitchToRegister} className="font-semibold text-orange-600 hover:underline dark:text-white">
                        Não tem uma conta? Cadastre-se
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;