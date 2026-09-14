import React, { useState } from "react";
import { 
  X, 
  UploadCloud, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownRight, 
  Loader2,
  Check,
  Filter
} from "lucide-react";
import { Account, Category, StatementItem, StatementParseResult, api } from "../services/api.js";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
  onImportSuccess: () => void;
}

interface SelectableItem extends StatementItem {
  selected: boolean;
  selectedCategoryId: number | null;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  accounts,
  categories,
  onImportSuccess
}) => {
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [selectedAccountId, setSelectedAccountId] = useState<number>(accounts[0]?.id || 0);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileContent, setFileContent] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [parseResult, setParseResult] = useState<StatementParseResult | null>(null);
  const [items, setItems] = useState<SelectableItem[]>([]);
  const [filterType, setFilterType] = useState<"all" | "new" | "duplicate">("all");

  // Garante que o ID da conta seja sempre sincronizado quando as contas carregarem ou o modal abrir
  React.useEffect(() => {
    if (accounts.length > 0 && (!selectedAccountId || !accounts.some(a => a.id === selectedAccountId))) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setFileName(selectedFile.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFileContent(content || "");
    };
    reader.readAsText(selectedFile);
  };

  const handleProcessFile = async () => {
    if (!fileContent) {
      alert("Por favor selecione um arquivo de extrato válido.");
      return;
    }
    const targetAccountId = selectedAccountId || accounts[0]?.id;
    if (!targetAccountId) {
      alert("Por favor selecione a conta de destino.");
      return;
    }

    try {
      setLoading(true);
      const res = await api.parseStatement(targetAccountId, fileContent, fileName);
      if (!res.success || !res.data) {
        alert(res.message || "Erro ao processar arquivo de extrato.");
        return;
      }

      setParseResult(res.data);
      // Por padrão: transações novas vêm marcadas para importar, duplicadas vêm desmarcadas
      const selectable = res.data.items.map(it => ({
        ...it,
        selected: !it.isDuplicate,
        selectedCategoryId: it.suggestedCategoryId || null
      }));
      setItems(selectable);
      setStep("preview");
    } catch (err: any) {
      alert("Erro ao analisar extrato: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const toggleItemSelection = (index: number) => {
    setItems(prev => prev.map((it, i) => i === index ? { ...it, selected: !it.selected } : it));
  };

  const handleCategoryChange = (index: number, categoryId: number | null) => {
    setItems(prev => prev.map((it, i) => i === index ? { ...it, selectedCategoryId: categoryId } : it));
  };

  const selectAll = (select: boolean) => {
    setItems(prev => prev.map(it => ({ ...it, selected: select })));
  };

  const handleConfirmImport = async () => {
    const toImport = items.filter(it => it.selected);
    if (toImport.length === 0) {
      alert("Nenhum lançamento foi selecionado para importação.");
      return;
    }

    try {
      setLoading(true);
      const payload = toImport.map(it => ({
        date: it.date,
        description: it.description,
        amount: it.amount,
        typeId: it.typeId,
        categoryId: it.selectedCategoryId,
        externalId: it.externalId
      }));

      const targetAccountId = selectedAccountId || accounts[0]?.id;
      const res = await api.confirmImportStatement(targetAccountId, payload);
      if (res.success) {
        alert(res.message || "Importação concluída com sucesso!");
        onImportSuccess();
        onClose();
        // Reset state
        setStep("upload");
        setFile(null);
        setFileContent("");
      } else {
        alert(res.message || "Erro ao salvar transações importadas.");
      }
    } catch (err: any) {
      alert("Erro ao confirmar importação: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(it => {
    if (filterType === "new") return !it.isDuplicate;
    if (filterType === "duplicate") return it.isDuplicate;
    return true;
  });

  const selectedCount = items.filter(it => it.selected).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Cabeçalho */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/80">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-emerald-400" />
              Importador de Extrato Bancário
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {step === "upload" 
                ? "Envie seu arquivo .CSV ou .OFX para lançamento automático"
                : `Revise os lançamentos encontrados (${selectedCount} selecionados)`
              }
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === "upload" ? (
            <div className="space-y-5">
              {/* Seleção de Conta */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Conta de Destino
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 transition"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (R$ {parseFloat(acc.balance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
                    </option>
                  ))}
                </select>
              </div>

              {/* Área de Upload / Dropzone */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Arquivo do Extrato (.CSV ou .OFX)
                </label>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-2xl p-8 cursor-pointer bg-slate-800/40 hover:bg-slate-800/80 transition group">
                  <input 
                    type="file" 
                    accept=".csv,.ofx,.txt" 
                    onChange={handleFileChange}
                    className="hidden" 
                  />
                  <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-2xl group-hover:scale-110 transition mb-3">
                    <FileText className="w-8 h-8" />
                  </div>
                  {fileName ? (
                    <div className="text-center">
                      <p className="text-sm font-semibold text-emerald-400">{fileName}</p>
                      <p className="text-xs text-slate-400 mt-1">Toque para escolher outro arquivo</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-200">Clique para selecionar o extrato</p>
                      <p className="text-xs text-slate-400 mt-1">Suporta arquivos CSV do Nubank, Inter, Itaú e OFX padrão</p>
                    </div>
                  )}
                </label>
              </div>

              {/* Destaques de Recursos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 bg-slate-800/50 border border-slate-700/60 rounded-2xl text-xs text-slate-300 space-y-1">
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-400" />
                    Anti-Duplicidade
                  </p>
                  <p className="text-slate-400">Compara identificadores e valores para não repetir compras já lançadas.</p>
                </div>
                <div className="p-3.5 bg-slate-800/50 border border-slate-700/60 rounded-2xl text-xs text-slate-300 space-y-1">
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-400" />
                    Auto-Categorização
                  </p>
                  <p className="text-slate-400">Identifica Uber, mercados, farmácias e sugere as categorias certas.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Barra de Status e Filtros */}
              <div className="flex flex-wrap gap-2 items-center justify-between bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFilterType("all")}
                    className={`text-xs px-3 py-1.5 rounded-xl font-medium transition ${
                      filterType === "all" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Todos ({items.length})
                  </button>
                  <button
                    onClick={() => setFilterType("new")}
                    className={`text-xs px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1 ${
                      filterType === "new" ? "bg-emerald-500/20 text-emerald-300 font-semibold" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Novos ({parseResult?.newItemsCount || 0})
                  </button>
                  {Boolean(parseResult?.duplicatesCount) && (
                    <button
                      onClick={() => setFilterType("duplicate")}
                      className={`text-xs px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1 ${
                        filterType === "duplicate" ? "bg-amber-500/20 text-amber-300 font-semibold" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Duplicados ({parseResult?.duplicatesCount})
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <button 
                    onClick={() => selectAll(true)}
                    className="text-emerald-400 hover:underline font-medium"
                  >
                    Marcar Todos
                  </button>
                  <span className="text-slate-600">•</span>
                  <button 
                    onClick={() => selectAll(false)}
                    className="text-slate-400 hover:underline font-medium"
                  >
                    Desmarcar Todos
                  </button>
                </div>
              </div>

              {/* Lista de Itens do Extrato */}
              <div className="space-y-2 max-h-[48vh] overflow-y-auto pr-1">
                {filteredItems.map((it, idx) => (
                  <div 
                    key={idx}
                    className={`p-3.5 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      it.selected 
                        ? "bg-slate-800/80 border-slate-700" 
                        : "bg-slate-900/50 border-slate-800/80 opacity-60"
                    }`}
                  >
                    {/* Checkbox e Detalhes */}
                    <div className="flex items-start gap-3">
                      <input 
                        type="checkbox"
                        checked={it.selected}
                        onChange={() => toggleItemSelection(idx)}
                        className="mt-1 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-700 border-slate-600 cursor-pointer"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`p-1 rounded-lg ${
                            it.typeId === 1 ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                          }`}>
                            {it.typeId === 1 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          </span>
                          <h4 className="text-sm font-semibold text-slate-100">{it.description}</h4>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
                          <span>{new Date(it.date + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                          {it.isDuplicate && (
                            <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                              <AlertTriangle className="w-3 h-3" />
                              {it.duplicateReason || "Provável duplicata"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Valor e Categoria */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pl-7 sm:pl-0">
                      {/* Seletor de Categoria */}
                      <select
                        value={it.selectedCategoryId || ""}
                        onChange={(e) => handleCategoryChange(idx, e.target.value ? Number(e.target.value) : null)}
                        className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">Sem Categoria</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>

                      <span className={`text-sm font-bold min-w-[90px] text-right ${
                        it.typeId === 1 ? "text-emerald-400" : "text-slate-100"
                      }`}>
                        {it.typeId === 1 ? "+" : "-"} R$ {parseFloat(it.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé / Ações */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          {step === "preview" ? (
            <>
              <button
                onClick={() => setStep("upload")}
                disabled={loading}
                className="px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition"
              >
                Voltar
              </button>

              <button
                onClick={handleConfirmImport}
                disabled={loading || selectedCount === 0}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmar Importação ({selectedCount})
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
              >
                Cancelar
              </button>

              <button
                onClick={handleProcessFile}
                disabled={loading || !fileContent}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    Avançar para Revisão
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
