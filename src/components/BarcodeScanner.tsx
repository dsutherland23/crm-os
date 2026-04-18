import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScanLine, Keyboard, Scan, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (data: string, type: 'barcode' | 'qr') => void;
}

export default function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  const [mode, setMode] = useState<'scanner' | 'manual'>('scanner');
  const [manualInput, setManualInput] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerDivId = "reader";

  useEffect(() => {
    let timer: NodeJS.Timeout;
    let isComponentMounted = true;

    if (isOpen && mode === 'scanner') {
      setIsInitializing(true);
      setCameraError(null);

      // Delay initialization to ensure Dialog DOM is ready (Radix UI portal animation)
      timer = setTimeout(async () => {
        const element = document.getElementById(scannerDivId);
        if (!element) {
          console.error("Scanner div not found");
          if (isComponentMounted) {
            setIsInitializing(false);
            setCameraError("Scanner container not found.");
          }
          return;
        }

        // Explicitly check for camera permissions first
        try {
          await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (err: any) {
          console.error("Camera permission error:", err);
          if (isComponentMounted) {
            setIsInitializing(false);
            const msg = err.name === 'NotAllowedError' || err.name === 'NotFoundError' 
              ? "Camera access denied. Please allow camera permissions."
              : "Could not access camera.";
            setCameraError(msg);
            toast.error(msg);
          }
          return;
        }

        if (!isComponentMounted) return;

        try {
          const html5QrCode = new Html5Qrcode(scannerDivId);
          scannerRef.current = html5QrCode;

          const cameraConfig = { facingMode: "environment" };

          await html5QrCode.start(
            cameraConfig,
            {
              fps: 10,
              qrbox: (viewfinderWidth, viewfinderHeight) => {
                const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
                const qrboxSize = Math.min(Math.floor(minEdgeSize * 0.7), 250);
                return { width: qrboxSize, height: qrboxSize };
              },
              disableFlip: false,
            },
            (decodedText, decodedResult) => {
              const format = decodedResult?.result?.format?.formatName;
              const type = format === 'QR_CODE' ? 'qr' : 'barcode';
              playBeep();
              onScan(decodedText, type);
            },
            (errorMessage) => {
              // Ignore parse errors
            }
          );
          
          if (isComponentMounted) {
            setIsInitializing(false);
          }
        } catch (err) {
          console.error("Scanner init error:", err);
          if (isComponentMounted) {
            setIsInitializing(false);
            setCameraError("Failed to start scanner engine.");
          }
        }
      }, 500); // Increased delay for stability
    }

    return () => {
      isComponentMounted = false;
      if (timer) clearTimeout(timer);
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().then(() => {
            try {
              scannerRef.current?.clear();
            } catch (e) {
              console.warn("Error clearing scanner:", e);
            }
            scannerRef.current = null;
          }).catch(err => {
            console.error("Error stopping scanner:", err);
            scannerRef.current = null;
          });
        } else {
          try {
            scannerRef.current.clear();
          } catch (e) {}
          scannerRef.current = null;
        }
      }
    };
  }, [isOpen, mode, onScan]);

  // Global keyboard listener for physical scanners
  useEffect(() => {
    if (!isOpen) return;

    let barcode = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 50) {
        barcode = ''; 
      }
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (barcode.length > 3) {
          playBeep();
          const type = (barcode.startsWith('{') || barcode.startsWith('http')) ? 'qr' : 'barcode';
          onScan(barcode, type);
          barcode = '';
        }
      } else if (e.key.length === 1) {
        barcode += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onScan]);

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
      
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.1);
      
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
      console.error("Audio context not supported", e);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      const type = (manualInput.startsWith('{') || manualInput.startsWith('http')) ? 'qr' : 'barcode';
      onScan(manualInput.trim(), type);
      setManualInput('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl border-zinc-100 p-0 overflow-hidden">
        <div className="p-6 bg-zinc-900 text-white flex items-center justify-between">
          <div>
            <DialogTitle className="font-bold text-xl flex items-center gap-2">
              <ScanLine className="w-5 h-5 text-blue-400" />
              Scan Engine
            </DialogTitle>
            <DialogDescription className="text-zinc-400 mt-1">
              Scan barcode or QR code to proceed.
            </DialogDescription>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex bg-zinc-100 p-1 rounded-xl">
            <button
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'scanner' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}`}
              onClick={() => setMode('scanner')}
            >
              <ScanLine className="w-4 h-4" />
              Device Scanner
            </button>
            <button
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'manual' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}`}
              onClick={() => setMode('manual')}
            >
              <Keyboard className="w-4 h-4" />
              Manual Input
            </button>
          </div>

          {mode === 'scanner' ? (
            <div className="rounded-2xl overflow-hidden border-2 border-zinc-200 bg-zinc-50 relative flex items-center justify-center min-h-[300px]">
              {isInitializing && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-50/90 backdrop-blur-sm">
                  <div className="w-10 h-10 border-4 border-zinc-200 border-t-blue-600 rounded-full animate-spin mb-4" />
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Initializing Camera...</p>
                </div>
              )}
              {cameraError && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-50 p-6 text-center">
                  <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-zinc-900 mb-2">{cameraError}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-xl"
                    onClick={() => {
                      setCameraError(null);
                      setMode('manual');
                    }}
                  >
                    Use Manual Input
                  </Button>
                </div>
              )}
              <div id={scannerDivId} className="w-full" />
            </div>
          ) : (
            <div className="space-y-4 py-8">
              <div className="text-center space-y-2 mb-8">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ScanLine className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-zinc-900">Ready to Scan</h3>
                <p className="text-sm text-zinc-500">Use your USB/Bluetooth scanner or type manually.</p>
              </div>
              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <Input
                  autoFocus
                  placeholder="Enter barcode or SKU..."
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  className="rounded-xl h-12 font-mono"
                />
                <Button type="submit" className="h-12 rounded-xl bg-zinc-900 text-white font-bold px-6">
                  Enter
                </Button>
              </form>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
