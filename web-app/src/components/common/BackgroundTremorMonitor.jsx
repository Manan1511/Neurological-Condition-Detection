import React, { useEffect, useState, useRef } from 'react';
import { useSerialContext } from '../../context/SerialContext';
import { Activity, AlertTriangle, CheckCircle } from 'lucide-react';

const BackgroundTremorMonitor = () => {
    const { isConnected, setDataHandler } = useSerialContext();
    const [prediction, setPrediction] = useState(null);
    const bufferRef = useRef([]);

    useEffect(() => {
        if (!isConnected) return;

        setDataHandler((data) => {
            // Buffer data
            bufferRef.current.push({
                AccelX: data.accel.x,
                AccelY: data.accel.y,
                AccelZ: data.accel.z,
                FSR: data.fsr
            });

            if (bufferRef.current.length > 50) { // 1 sec window for quick check
                bufferRef.current.shift();
            }

            // Only predict every 1s
            if (bufferRef.current.length === 50 && Math.random() > 0.95) {
                // Mocking a local check since we can't easily spam the API in background without lag
                // Only send if we want real results.
                // For now, let's just show "Monitoring..." or send casually.
                // Actually the user WANTS the model running.

                // Let's send to backend if we have a full buffer (100 samples ideally)
            }
        });

        // Setup an interval to actually poll the backend properly without spamming
        const interval = setInterval(async () => {
            if (bufferRef.current.length < 50) return;

            try {
                const res = await fetch('http://127.0.0.1:5000/predict', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bufferRef.current)
                });
                if (res.ok) {
                    const result = await res.json();
                    setPrediction(result);
                }
            } catch (e) {
                console.error("BG Tremor Check Error", e);
            }
        }, 2000); // Check every 2 seconds

        return () => {
            setDataHandler(null);
            clearInterval(interval);
        }
    }, [isConnected, setDataHandler]);

    if (!isConnected) return null;

    return (
        <div className="fixed bottom-4 right-4 bg-white p-3 rounded-xl shadow-2xl border border-gray-100 flex items-center space-x-3 z-50 animate-in slide-in-from-bottom">
            <div className="relative">
                <Activity className="w-6 h-6 text-park-sage animate-pulse" />
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
            </div>
            <div>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Background Monitor</p>
                {prediction ? (
                    <p className={`text-sm font-bold ${prediction.label === 'Tremor' ? 'text-red-500' : 'text-park-navy'}`}>
                        {prediction.label} ({prediction.features?.dom_freq?.toFixed(1) || 0} Hz)
                    </p>
                ) : (
                    <p className="text-sm text-gray-500">Scanning...</p>
                )}
            </div>
        </div>
    );
};

export default BackgroundTremorMonitor;
