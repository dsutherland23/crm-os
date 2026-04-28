import React, { useEffect, useState, useRef, useId } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScanLine, Keyboard, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (data: string, type: 'barcode' | 'qr') => void;
}

export default function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  const uid = useId().replace(/:/g, '');           // stable, colon-free id
  const scannerDivId = `qr-reader-${uid}`;

  const [mode, setMode] = useState<'scanner' | 'manual'>('scanner');
  const [manualInput, setManualInput] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const mountedRef = useRef(true);

  // ── Stop & clean up scanner ─────────────────────────────────────────────
  const stopScanner = async () => {
    const s = scannerRef.current;
    if (!s) return;
    scannerRef.current = null;
    try {
      if (s.isScanning) {
        await s.stop();
      }
      // Ensure element still exists before clearing
      if (document.getElementById(scannerDivId)) {
        s.clear();
      }
    } catch (_) {
      // Cleanup failures are non-fatal in the unmount cycle
    }
  };

  // ── Start camera scanner ────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    if (!isOpen || mode !== 'scanner') return;

    setIsInitializing(true);
    setCameraError(null);
    setLastScan(null);

    // Wait for Radix portal + dialog animation to settle
    const timer = setTimeout(async () => {
      if (!mountedRef.current) return;

      const el = document.getElementById(scannerDivId);
      if (!el) {
        if (mountedRef.current) {
          setIsInitializing(false);
          setCameraError('Scanner viewport not found. Please retry.');
        }
        return;
      }

      try {
        // Check camera availability
        const devices = await Html5Qrcode.getCameras();
        if (!devices || devices.length === 0) {
          throw new Error('No camera detected on this device.');
        }

        if (!mountedRef.current) return;

        const html5QrCode = new Html5Qrcode(scannerDivId);
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: (w: number, h: number) => {
              const edge = Math.min(w, h);
              const size = Math.max(200, Math.min(Math.floor(edge * 0.75), 350));
              return { width: Math.min(size, w - 16), height: Math.min(size, h - 16) };
            },
            disableFlip: false,
          },
          (decodedText: string, decodedResult: any) => {
            // html5-qrcode v2.3 stores format at result.format.formatName
            let fmt = '';
            try {
              fmt =
                decodedResult?.result?.format?.formatName ||
                decodedResult?.format?.formatName ||
                decodedResult?.decodedText?.format ||
                '';
            } catch (_) {}
            const type = fmt === 'QR_CODE' || fmt === 'qr_code' ? 'qr' : 'barcode';
            playBeep();
            setLastScan(decodedText.trim());
            onScan(decodedText, type);
          },
          (_errorMessage: string) => {
            // Frame decode errors are normal — suppress
          }
        );

        if (mountedRef.current) setIsInitializing(false);
      } catch (err: any) {
        if (!mountedRef.current) return;
        setIsInitializing(false);
        const msg =
          err?.name === 'NotAllowedError' || err?.message?.includes('ermission')
            ? 'Camera permission denied. Open site settings and allow camera access, then retry.'
            : err?.message || 'Could not start camera scanner.';
        setCameraError(msg);
        if (err?.name === 'NotAllowedError') {
          toast.error('Camera permission denied.');
        }
      }
    }, 700);

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode, scannerDivId]);

  // Final unmount cleanup
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Physical USB / Bluetooth scanner listener ──────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    let barcode = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const now = Date.now();
      if (now - lastKeyTime > 60) barcode = '';
      lastKeyTime = now;

      if (e.key === 'Enter') {
        const clean = barcode.trim();
        if (clean.length > 2) {
          playBeep();
          const type = clean.startsWith('{') || clean.startsWith('http') ? 'qr' : 'barcode';
          setLastScan(clean);
          onScan(clean, type);
          barcode = '';
        }
      } else if (e.key.length === 1) {
        barcode += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onScan]);

  // ── Audio beep ─────────────────────────────────────────────────────────
  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
    } catch (_) {}
  };

  // ── Manual submit ──────────────────────────────────────────────────────
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualInput.trim();
    if (!clean) return;
    const type = clean.startsWith('{') || clean.startsWith('http') ? 'qr' : 'barcode';
    setLastScan(clean);
    onScan(clean, type);
    setManualInput('');
  };

  const retryScanner = () => {
    setCameraError(null);
    setLastScan(null);
    setMode('manual');
    setTimeout(() => setMode('scanner'), 80);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-sm sm:max-w-md rounded-3xl border-zinc-100 p-0 overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-zinc-900 text-white">
          <DialogTitle className="font-bold text-lg flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-blue-400" />
            Scan Engine
          </DialogTitle>
          <DialogDescription className="text-zinc-400 text-xs mt-1">
            Point camera at barcode or QR code · USB scanners auto-detected
          </DialogDescription>
        </div>

        <div className="p-5 space-y-4">
          {/* Mode toggle */}
          <div className="flex bg-zinc-100 p-1 rounded-xl gap-1">
            <button
              className={cn('flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all', mode === 'scanner' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700')}
              onClick={() => setMode('scanner')}
            >
              <ScanLine className="w-3.5 h-3.5" />
              Camera
            </button>
            <button
              className={cn('flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all', mode === 'manual' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700')}
              onClick={() => setMode('manual')}
            >
              <Keyboard className="w-3.5 h-3.5" />
              Manual / USB
            </button>
          </div>

          {/* Camera view */}
          {mode === 'scanner' ? (
            <div className="rounded-2xl overflow-hidden border-2 border-zinc-200 bg-zinc-900 relative flex items-center justify-center" style={{ minHeight: 280 }}>
              {/* Initializing overlay */}
              {isInitializing && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-900/90 backdrop-blur-sm">
                  <div className="w-10 h-10 border-4 border-zinc-600 border-t-blue-400 rounded-full animate-spin mb-3" />
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Starting Camera…</p>
                </div>
              )}

              {/* Error overlay */}
              {cameraError && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-900 p-6 text-center">
                  <div className="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-white mb-1">Camera Error</p>
                  <p className="text-xs text-zinc-400 mb-5">{cameraError}</p>
                  <div className="flex flex-col gap-2 w-full">
                    <Button className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold h-10" onClick={retryScanner}>
                      <RefreshCw className="w-4 h-4 mr-2" />Retry Camera
                    </Button>
                    <Button variant="outline" className="rounded-xl border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-10" onClick={() => setMode('manual')}>
                      Use Manual / USB Input
                    </Button>
                  </div>
                </div>
              )}

              {/* Scan target box overlay */}
              {!isInitializing && !cameraError && (
                <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                  <div className="w-52 h-52 relative">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-xl" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-xl" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-xl" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-xl" />
                    {/* Scan line animation */}
                    <div className="absolute inset-x-0 h-0.5 bg-blue-400/70 animate-scan-line" />
                  </div>
                </div>
              )}

              {/* html5-qrcode mount point */}
              <div id={scannerDivId} className="w-full" />
            </div>
          ) : (
            /* Manual / USB mode */
            <div className="space-y-4 py-4">
              <div className="text-center space-y-2 mb-2">
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                  <ScanLine className="w-7 h-7" />
                </div>
                <p className="text-sm font-bold text-zinc-900">USB / Bluetooth Scanner Ready</p>
                <p className="text-xs text-zinc-500">Scan with hardware device or type below</p>
              </div>
              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <Input
                  autoFocus
                  placeholder="Barcode, SKU, or QR data…"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  className="rounded-xl h-11 font-mono text-sm border-zinc-200"
                />
                <Button type="submit" className="h-11 rounded-xl bg-zinc-900 text-white font-bold px-5 shrink-0">
                  Go
                </Button>
              </form>
            </div>
          )}

          {/* Last scan result badge */}
          {lastScan && (
            <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Last Scanned</p>
                <p className="text-sm font-mono font-bold text-zinc-900 truncate">{lastScan}</p>
              </div>
            </div>
          )}

          {/* Close button */}
          <Button
            variant="outline"
            className="w-full rounded-xl border-zinc-200 h-11 font-bold text-zinc-600 hover:bg-zinc-50"
            onClick={onClose}
          >
            Close Scanner
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
