import React, { useState } from "react";
import { AppUser } from "../types";
import { isSupabaseReady, dbFetchUsers, validateUserPassword } from "../supabaseService";

interface LoginProps {
  onLogin: (user: AppUser) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg("O e-mail é obrigatório.");
      return;
    }
    if (!password) {
      setErrorMsg("A senha é obrigatória.");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");

    try {
      // Dynamic loading/validation of database users
      let currentUsersList: any[] = [];
      if (isSupabaseReady()) {
        try {
          const dbUsers = await dbFetchUsers();
          if (dbUsers && dbUsers.length > 0) {
            currentUsersList = dbUsers;
          }
        } catch (dbErr) {
          console.error("Erro ao buscar usuários do banco:", dbErr);
        }
      }

      if (!currentUsersList || currentUsersList.length === 0) {
        setErrorMsg("Não foi possível carregar os usuários do sistema. Verifique a conexão.");
        setIsLoading(false);
        return;
      }

      // Busca por email (case insensitive, sem espaços)
      const matchedUser = currentUsersList.find(
        (u) => u.email.toLowerCase().trim() === email.toLowerCase().trim()
      );

      if (!matchedUser) {
        setErrorMsg("E-mail não encontrado no sistema.");
        setIsLoading(false);
        return;
      }

      // Compara senha usando validador bcrypt (senha_hash)
      const isPasswordCorrect = validateUserPassword(
        password,
        matchedUser.senha_hash
      );

      if (!isPasswordCorrect) {
        setErrorMsg("Senha incorreta.");
        setIsLoading(false);
        return;
      }

      if (matchedUser.status === "SUSPENSO") {
        setErrorMsg("Acesso suspenso. Entre em contato com o auditor Fernando Silva.");
        setIsLoading(false);
        return;
      }

      // Clean up only previous user session data on login, preserving global configurations, cache and reset keys
      try {
        sessionStorage.removeItem("acandido_app_user");
        sessionStorage.clear();
      } catch (errClear) {
        console.error("Failed to clear local/session storage on login:", errClear);
      }

      // Login OK
      const finalUserPayload = {
        name: matchedUser.name,
        role: matchedUser.role,
        email: matchedUser.email,
        ownerName: matchedUser.ownerName || matchedUser.name.split(" ")[0],
        group: matchedUser.group || "A",
        almoxarifados: matchedUser.almoxarifados || []
      };

      onLogin(finalUserPayload);
    } catch (err) {
      console.error("Login verification exception:", err);
      setErrorMsg("Ocorreu um erro ao realizar o login.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1B2A4A] flex flex-col items-center justify-center relative px-4 py-8 select-none">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        ></div>
      </div>

      <header className="w-full max-w-[420px] text-center mb-6 z-10 flex flex-col items-center">
        <div className="flex items-center justify-center select-none mb-1">
          <span className="text-3xl font-black text-white tracking-[0.25em] font-sans">
            A.CÂNDIDO
          </span>
          <span className="w-3.5 h-3.5 bg-[#EF4444] rounded-full self-baseline mb-2 ml-1 animate-pulse"></span>
        </div>
        <p className="text-[10px] font-extrabold text-[#C8A84B] uppercase tracking-[0.2em] opacity-95">
          SISTEMA DE AUDITORIA PREVENTIVA
        </p>
      </header>

      <main className="w-full max-w-[420px] z-10">
        <div className="bg-white rounded-xl p-6 w-full shadow-[0px_4px_24px_rgba(27,42,74,0.4)] border border-slate-100">
          <h2 className="text-xl font-bold text-[#1B2A4A] mb-4 text-center">
            Entrar no Portal
          </h2>

          {errorMsg && (
            <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200 mb-4 animate-shake">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-xs font-semibold text-[#1B2A4A]">
                E-mail Corporativo
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrorMsg("");
                }}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white text-[15px] focus:outline-none focus:border-[#1B2A4A] focus:ring-1 focus:ring-[#1B2A4A] transition-all"
                placeholder="exemplo@acandidotransportes.com.br"
              />
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1">
              <label htmlFor="password" className="text-xs font-semibold text-[#1B2A4A]">
                Senha de Acesso
              </label>
              <div className="relative flex items-center">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMsg("");
                  }}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white text-[15px] focus:outline-none focus:border-[#1B2A4A] focus:ring-1 focus:ring-[#1B2A4A] transition-all pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-400 hover:text-[#1B2A4A] transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {/* Entry button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#1B2A4A] active:bg-[#0E172B] disabled:bg-slate-400 text-white font-semibold py-3 rounded-lg shadow-md hover:opacity-95 active:scale-[0.98] disabled:scale-100 transition-all duration-200 text-sm tracking-wide flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    VERIFICANDO...
                  </>
                ) : (
                  "EFETUAR LOGIN"
                )}
              </button>
            </div>
          </form>
        </div>
      </main>

      <footer className="w-full mt-6 py-2 text-center z-10">
        <p className="text-[10px] text-indigo-200 opacity-60 font-medium">
          © 2026 Grupo A.Cândido • Gestão Estratégica de Almoxarifados • v2.0
        </p>
      </footer>
    </div>
  );
}
