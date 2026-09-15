import React, { useEffect, useRef, useState } from "react";
import { X, Camera, AlertTriangle, Loader, Link } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (url: string) => void;
  isLoading: boolean;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  isLoading
}) => {
  if (!isOpen) return null;

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);

  useEffect(() => {
    const readerElId = "nfce-qr-reader";
    setCameraError(null);

    let started = false;
    const scanner = new Html5Qrcode(readerElId);
    html5QrCodeRef.current = scanner;

    // Inicia a câmera traseira (environment)
    scanner.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      },
      (decodedText) => {
        if (started && decodedText) {
          scanner.stop().then(() => {
            scanner.clear();
            onScanSuccess(decodedText);
          }).catch(() => {
            onScanSuccess(decodedText);
          });
        }
      },
      () => {
        // Ignora erros de frame enquanto escaneia
      }
    ).then(() => {
      started = true;
    }).catch(err => {
      console.warn("Câmera não pôde ser iniciada:", err);
      setCameraError("Não foi possível acessar a câmera. Verifique as permissões do navegador ou cole a URL abaixo.");
      setShowManualInput(true);
    });

    return () => {
      if (scanner.isScanning) {
        scanner.stop().then(() => scanner.clear()).catch(console.error);
      } else {
        scanner.clear();
      }
    };
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUrl.trim()) return;

    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      html5QrCodeRef.current.stop().then(() => {
        html5QrCodeRef.current?.clear();
        onScanSuccess(manualUrl.trim());
      }).catch(() => {
        onScanSuccess(manualUrl.trim());
      });
    } else {
      onScanSuccess(manualUrl.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-5 shadow-2xl relative">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Escanear QR Code da Nota</h3>
              <p className="text-[10px] text-slate-400">Aponte a câmera para o QR Code da NFC-e</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewfinder da Câmera */}
        <div className="relative w-full h-72 bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center">
          <div id="nfce-qr-reader" className="w-full h-full" />

          {isLoading && (
            <div className="w-full h-full absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-3 z-10">
              <Loader className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-xs font-bold text-slate-200">Consultando SEFAZ e extraindo itens...</p>
            </div>
          )}

          {cameraError && !isLoading && (
            <div className="p-4 text-center space-y-2 z-10">
              <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
              <p className="text-xs text-slate-300">{cameraError}</p>
            </div>
          )}
        </div>

        {/* Botão para Entrada Manual */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowManualInput(!showManualInput)}
            className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-white flex items-center justify-center gap-1.5 transition"
          >
            <Link className="w-3.5 h-3.5 text-blue-400" />
            {showManualInput ? "Ocultar entrada manual" : "Colar URL ou Chave da Nota manualmente"}
          </button>

          {showManualInput && (
            <form onSubmit={handleManualSubmit} className="mt-2 space-y-2">
              <input
                type="text"
                required
                placeholder="Cole a URL ou a chave de 44 dígitos da nota..."
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={isLoading || !manualUrl.trim()}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow transition flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                    <span>Processando Nota...</span>
                  </>
                ) : (
                  <span>Consultar Nota Fiscal</span>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};