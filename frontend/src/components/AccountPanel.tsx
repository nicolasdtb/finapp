import React, { useEffect, useState } from "react";
import { Copy, RefreshCw, Ticket, Trash2, KeyRound } from "lucide-react";
import { api } from "../services/api.js";
import { useToast, useConfirm } from "./Feedback.js";

interface Invite {
  id: number;
  code: string;
  expiresAt: string;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export const AccountPanel: React.FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
  const toast = useToast();
  const confirm = useConfirm();
  const [webhookToken, setWebhookToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busy, setBusy] = useState(false);

  const loadInvites = async () => {
    if (!isAdmin) return;
    const list = await api.getInvites();
    if (Array.isArray(list)) setInvites(list);
  };

  useEffect(() => {
    api.getWebhookToken().then((r) => setWebhookToken(r.token || "")).catch(() => {});
    loadInvites().catch(() => {});
  }, [isAdmin]);

  const copy = async (text: string, label: string) => {
    const ok = await copyText(text);
    if (ok) toast.success(`${label} copiado.`);
    else toast.error("Não foi possível copiar. Selecione e copie manualmente.");
  };

  const handleCreateInvite = async () => {
    setBusy(true);
    try {
      const r = await api.createInvite();
      if (!r.success || !r.code) {
        toast.error(r.message || "Não foi possível gerar o convite.");
        return;
      }
      await copyText(r.code);
      toast.success(`Convite ${r.code} gerado e copiado. Vale por 48 horas.`);
      await loadInvites();
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteInvite = async (id: number) => {
    await api.deleteInvite(id);
    await loadInvites();
  };

  const handleRegenerate = async () => {
    const ok = await confirm({
      title: "Gerar novo token?",
      message: "O token atual deixa de funcionar. Você precisará colar o novo no app do celular.",
      confirmLabel: "Gerar novo",
      danger: true,
    });
    if (!ok) return;
    const r = await api.regenerateWebhookToken();
    if (r.token) {
      setWebhookToken(r.token);
      setShowToken(true);
      toast.success("Novo token gerado.");
    }
  };

  const fmtExpiry = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <KeyRound className="w-4 h-4" /> Token do webhook (celular)
        </h3>
        <p className="text-xs text-slate-400">
          Cole este token no app listener para que as notificações do banco cheguem na sua conta.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 truncate bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300">
            {showToken ? webhookToken : "•".repeat(24)}
          </code>
          <button onClick={() => setShowToken(!showToken)} className="px-3 py-2.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl">
            {showToken ? "Ocultar" : "Mostrar"}
          </button>
          <button onClick={() => copy(webhookToken, "Token")} disabled={!webhookToken} className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl disabled:opacity-50" aria-label="Copiar token">
            <Copy className="w-4 h-4" />
          </button>
        </div>
        <button onClick={handleRegenerate} className="text-xs text-rose-400 hover:underline flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Gerar novo token
        </button>
      </div>

      {isAdmin && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Ticket className="w-4 h-4" /> Convites de cadastro
          </h3>
          <p className="text-xs text-slate-400">
            Cada convite vale para um cadastro e expira em 48 horas. Envie o código para a pessoa.
          </p>
          <button onClick={handleCreateInvite} disabled={busy} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl disabled:opacity-50">
            {busy ? "Gerando..." : "Gerar convite"}
          </button>
          {invites.length > 0 && (
            <ul className="space-y-2">
              {invites.map((inv) => (
                <li key={inv.id} className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-mono tracking-widest text-white">{inv.code}</div>
                    <div className="text-[11px] text-slate-500">expira em {fmtExpiry(inv.expiresAt)}</div>
                  </div>
                  <button onClick={() => copy(inv.code, "Código")} className="p-2 text-slate-300 hover:text-white" aria-label="Copiar código">
                    <Copy className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteInvite(inv.id)} className="p-2 text-rose-400 hover:text-rose-300" aria-label="Cancelar convite">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
