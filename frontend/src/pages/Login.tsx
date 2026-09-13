import React, { useState } from "react";
import { Lock, Mail, User as UserIcon, ArrowRight, ShieldCheck } from "lucide-react";
import { api, User } from "../services/api.js";

interface LoginModalProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        const res = await api.register(name, email, password);
        if (!res.success || !res.token || !res.user) {
          setError(res.message || "Erro ao criar conta.");
          return;
        }
        localStorage.setItem("@finapp:token", res.token);
        onLoginSuccess(res.user);
      } else {
        const res = await api.login(email, password);
        if (!res.success || !res.token || !res.user) {
          setError(res.message || "E-mail ou senha incorretos.");
          return;
        }
        localStorage.setItem("@finapp:token", res.token);
        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      setError("Falha na conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-7 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-500/20 text-white">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">
            {isRegister ? "Criar Conta" : "FinApp Login"}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isRegister ? "Cadastro de usuário seguro (máx: 3)" : "Acesse seu controle financeiro"}
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs p-3 rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {isRegister && (
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Nome</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">E-mail</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="email"
                required
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Senha</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold rounded-xl shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 text-sm transition mt-2 disabled:opacity-50"
          >
            {loading ? "Processando..." : isRegister ? "Finalizar Cadastro" : "Entrar no FinApp"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center mt-5 pt-4 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
            className="text-xs text-blue-400 hover:underline font-medium"
          >
            {isRegister ? "Já possui uma conta? Faça login" : "Não tem conta ainda? Cadastre-se"}
          </button>
        </div>
      </div>
    </div>
  );
};
