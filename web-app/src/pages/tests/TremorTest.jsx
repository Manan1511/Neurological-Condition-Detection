import React, { useState, useEffect, useRef } from 'react';
import Layout from '../../components/common/Layout';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { useSerialContext } from '../../context/SerialContext';
import { Activity, Zap, Play, Square, AlertTriangle } from 'lucide-react';

const TremorTest = () => {
    // Global Serial Context
    const { connect, disconnect, isConnected, error: serialError, setDataHandler } = useSerialContext();

    // Local State
    const [status, setStatus] = useState('idle'); // idle, testing
    const [prediction, setPrediction] = useState(null); // { label: 'Rest', class: 0, freq: 0.0 }
    const [bufferCount, setBufferCount] = useState(0);

    // Data Buffer (Ref to avoid re-renders)
    const dataBufferRef = useRef([]);
    const lastApiCallRef = useRef(0);
    const WINDOW_SIZE = 100; // 2 seconds at 50Hz

    // --- DATA HANDLING ---
    useEffect(() => {
        // Register handler when component mounts/updates
        setDataHandler((data) => {
            if (status !== 'testing') return;

            // Add to buffer (Format matches server expectation)
            dataBufferRef.current.push({
                AccelX: data.accel.x,
                AccelY: data.accel.y,
                AccelZ: data.accel.z,
                FSR: data.fsr
            });

            // Maintain window size
            if (dataBufferRef.current.length > WINDOW_SIZE) {
                dataBufferRef.current.shift();
            }

            setBufferCount(dataBufferRef.current.length);

            // Throttle API to every 500ms
            const now = Date.now();
            if (now - lastApiCallRef.current > 500 && dataBufferRef.current.length === WINDOW_SIZE) {
                sendToBackend();
                lastApiCallRef.current = now;
            }
        });

        // Cleanup handler on unmount
        return () => setDataHandler(null);
    }, [status, setDataHandler]); // Re-bind if status changes (though Ref is stable)

    const sendToBackend = async () => {
        try {
            // Send copy of buffer
            const payload = [...dataBufferRef.current];
            const res = await fetch('http://127.0.0.1:5000/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const result = await res.json();
                // Result: { class: 0/1/2, label: "Rest", features: { dom_freq: ... } }
                setPrediction(result);
            }
        } catch (e) {
            console.error("API Error", e);
        }
    };

    const toggleTest = () => {
        if (status === 'idle') {
            setStatus('testing');
            dataBufferRef.current = []; // Clear buffer
        } else {
            setStatus('idle');
            setPrediction(null);
        }
    };

    // --- UI HELPERS ---
    const getStatusParams = (label) => {
        switch (label) {
            case 'Tremor': return { color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200', text: 'Tremor Detected' };
            case 'Voluntary': return { color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'Voluntary Movement' };
            case 'Rest': return { color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', text: 'Rest / Static' };
            default: return { color: 'text-gray-400', bg: 'bg-gray-50', border: 'border-gray-200', text: 'Analyzing...' };
        }
    };

    return (
        <Layout>
            <div className="max-w-4xl mx-auto space-y-8">
                <header className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-park-navy mb-4">Resting Tremor Analysis</h1>
                    <p className="text-xl text-gray-600">
                        Real-time detection using the <span className="font-mono text-park-sage">live_detector.py</span> logic.
                    </p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Control Panel */}
                    <Card title="Controls" className="h-full">
                        <div className="space-y-6">
                            <div className="p-4 bg-gray-50 rounded-lg">
                                {!isConnected ? (
                                    <Button onClick={connect} variant="outline" className="w-full text-base py-2">
                                        <Zap className="w-4 h-4 mr-2" /> Connect Sensor
                                    </Button>
                                ) : (
                                    <div className="text-green-600 font-bold flex items-center justify-center">
                                        <Activity className="w-5 h-5 mr-2" /> Sensor Ready
                                    </div>
                                )}
                                {serialError && <p className="text-red-500 text-sm mt-2">{serialError}</p>}
                            </div>

                            <Button
                                onClick={toggleTest}
                                disabled={!isConnected}
                                variant={status === 'testing' ? 'secondary' : 'primary'}
                                className="w-full text-lg py-4"
                            >
                                {status === 'idle' ? (
                                    <> <Play className="mr-2" /> Start Analysis </>
                                ) : (
                                    <> <Square className="mr-2" /> Stop Analysis </>
                                )}
                            </Button>

                            {status === 'testing' && (
                                <div className="text-center text-sm text-gray-400">
                                    Buffer: {bufferCount} / {WINDOW_SIZE} samples
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Results Area */}
                    <Card title="Live Results" className="h-full flex flex-col items-center justify-center min-h-[300px]">
                        {status === 'idle' ? (
                            <div className="text-center text-gray-400">
                                <Activity className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                <p>Press Start to begin streaming...</p>
                            </div>
                        ) : bufferCount < WINDOW_SIZE ? (
                            <div className="text-center animate-pulse">
                                <p className="text-park-sage font-bold text-lg">Calibrating...</p>
                                <p className="text-xs text-gray-400 mt-2">Filling Buffer ({Math.round(bufferCount / WINDOW_SIZE * 100)}%)</p>
                            </div>
                        ) : prediction ? (
                            <div className={`text-center w-full p-6 rounded-xl border-4 ${getStatusParams(prediction.label).border} ${getStatusParams(prediction.label).bg}`}>
                                <h2 className={`text-3xl font-bold mb-2 ${getStatusParams(prediction.label).color}`}>
                                    {getStatusParams(prediction.label).text}
                                </h2>

                                <div className="mt-6 grid grid-cols-2 gap-4 text-left">
                                    <div>
                                        <p className="text-xs uppercase text-gray-500 font-bold">Frequency</p>
                                        <p className="text-2xl font-mono text-park-navy">
                                            {prediction.features.dom_freq.toFixed(1)} <span className="text-sm">Hz</span>
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase text-gray-500 font-bold">Tremor Energy</p>
                                        <p className="text-2xl font-mono text-park-navy">
                                            {prediction.features.tremor_energy.toFixed(1)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center animate-pulse">
                                <p className="text-gray-500">Analyzing...</p>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </Layout>
    );
};

export default TremorTest;
