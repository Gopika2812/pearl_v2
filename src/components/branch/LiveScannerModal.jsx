import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { FaTimes, FaCamera, FaSync } from 'react-icons/fa';

const LiveScannerModal = ({ show, onClose, onScanSuccess }) => {
    const [scanner, setScanner] = useState(null);

    useEffect(() => {
        if (show) {
            const newScanner = new Html5QrcodeScanner(
                "reader", 
                { 
                    fps: 10, 
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0
                }, 
                /* verbose= */ false
            );

            newScanner.render((decodedText) => {
                onScanSuccess(decodedText);
                newScanner.clear().then(() => {
                    onClose();
                }).catch(error => {
                    console.error("Failed to clear scanner", error);
                    onClose();
                });
            }, (error) => {
                // Ignore errors
            });

            setScanner(newScanner);
        }

        return () => {
            if (scanner) {
                scanner.clear().catch(error => console.error("Cleanup failed", error));
            }
        };
    }, [show]);

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100000] flex items-center justify-center p-4">
            <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="bg-slate-900 p-6 flex items-center justify-between text-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <FaCamera className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black uppercase tracking-tight">Live Scanner</h2>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Point at Invoice QR Code</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => {
                            if (scanner) {
                                scanner.clear().then(onClose).catch(onClose);
                            } else {
                                onClose();
                            }
                        }} 
                        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition border-0 bg-transparent text-white cursor-pointer"
                    >
                        <FaTimes />
                    </button>
                </div>

                <div className="p-8">
                    <div id="reader" className="w-full rounded-3xl overflow-hidden border-4 border-slate-50 bg-slate-50 shadow-inner"></div>
                    
                    <div className="mt-8 flex flex-col items-center text-center">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Searching for QR...</span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium max-w-[250px]">
                            Ensure the QR code is within the frame and well-lit.
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full mt-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition"
                    >
                        Cancel Scanning
                    </button>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                #reader__scan_region {
                    background: #f8fafc !important;
                }
                #reader__dashboard_section_csr button {
                    background: #6366f1 !important;
                    color: white !important;
                    border: none !important;
                    padding: 8px 16px !important;
                    border-radius: 12px !important;
                    font-size: 10px !important;
                    font-weight: 900 !important;
                    text-transform: uppercase !important;
                    letter-spacing: 1px !important;
                    cursor: pointer !important;
                    margin: 10px !important;
                }
                #reader__dashboard_section_csr select {
                    padding: 8px !important;
                    border-radius: 12px !important;
                    border: 1px solid #e2e8f0 !important;
                    font-size: 12px !important;
                    outline: none !important;
                }
                #reader img {
                    display: none !important;
                }
            `}} />
        </div>
    );
};

export default LiveScannerModal;
