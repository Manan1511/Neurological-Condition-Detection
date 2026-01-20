import React, { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../../components/common/Layout';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import useSerialConnection from '../../hooks/useSerialConnection';
import { Activity, Zap, MousePointer, Cpu, Timer } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const TapTest = () => {
    // Mode: 'manual' or 'serial'
    const [mode, setMode] = useState('manual');
    const [isActive, setIsActive] = useState(false);
    const [timeLeft, setTimeLeft] = useState(15);
    const [taps, setTaps] = useState([]); // Array of timestamps
    const [fatigue, setFatigue] = useState(null);
    const [showResults, setShowResults] = useState(false);

    // Serial
    const { connect, disconnect, isConnected, error: serialError } = useSerialConnection();
    const lastFsrRef = useRef(0);
    const FSR_THRESHOLD = 200; // Trigger threshold

    // Timer Ref
    const timerRef = useRef(null);

    // --- LOGIC ---

    const startTest = () => {
        setIsActive(true);
        setTaps([]);
        setTimeLeft(15);
        setFatigue(null);
        setShowResults(false);

        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    endTest();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const endTest = () => {
        clearInterval(timerRef.current);
        setIsActive(false);
        calculateResults();
        setShowResults(true);
    };

    const registerTap = useCallback(() => {
        if (!isActive) return;
        setTaps((prev) => [...prev, Date.now()]);
    }, [isActive]);

    // Serial Data Buffer for ML
    const mlBufferRef = useRef([]);

    // Handle Serial Data
    const handleSerialData = useCallback((data) => {
        // 1. Detect Tap
        if (data.fsr > FSR_THRESHOLD && lastFsrRef.current <= FSR_THRESHOLD) {
            registerTap();
        }
        lastFsrRef.current = data.fsr;

        // 2. Buffer for ML (Accel + FSR)
        // Ensure data keys match server expectation: AccelX, etc.
        mlBufferRef.current.push({
            AccelX: data.accel.x,
            AccelY: data.accel.y,
            AccelZ: data.accel.z,
            FSR: data.fsr
        });

        // Send to API every 100 samples (~2 seconds at 50Hz)
        if (mlBufferRef.current.length >= 100) {
            const chunk = mlBufferRef.current.slice(0, 100);
            mlBufferRef.current = []; // Clear buffer

            fetch('http://localhost:5000/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chunk)
            })
                .then(res => res.json())
                .then(res => {
                    if (res.label) {
                        console.log("ML Prediction:", res.label);
                        // You could update state here to show it
                        // setMlResult(res.label); 
                    }
                })
                .catch(err => console.error("ML Error:", err));
        }

    }, [registerTap]);

    // Cleanup
    useEffect(() => {
        return () => clearInterval(timerRef.current);
    }, []);

    // Serial Listener
    // Note: useSerialConnection's `connect` takes a callback. 
    // We only call connect once usually, but here we want to attach the callback dynamically strictly speaking,
    // but the hook structure passes `onData` to `connect`. 
    // Ideally we connect once and state changes handled inside. 
    // For this prototype, user clicks "Connect Arduino" which passes the handler.

    const calculateResults = () => {
        // Fatigue Calculation
        // Metric: Speed of first 5 taps vs last 5 taps
        // Or: Inter-tap interval evolution

        if (taps.length < 10) {
            setFatigue("Insufficient Data");
            return;
        }

        const intervals = [];
        for (let i = 1; i < taps.length; i++) {
            intervals.push(taps[i] - taps[i - 1]);
        }

        // Avg interval of first 5
        const startIntervals = intervals.slice(0, 5);
        const avgStart = startIntervals.reduce((a, b) => a + b, 0) / startIntervals.length;

        // Avg interval of last 5
        const endIntervals = intervals.slice(-5);
        const avgEnd = endIntervals.reduce((a, b) => a + b, 0) / endIntervals.length;

        // Fatigue Decay Formula (User requested): (Avg_Start - Avg_End) / Avg_Start
        // WAIT: User said "(Avg_Start - Avg_End) / Avg_Start".
        // If speed drops, Avg Interval INCREASES. 
        // So Avg_End > Avg_Start. Result would be negative?

        // Let's interpret "Avg" as "Speed (Taps/Sec)".
        // Speed = 1000 / Interval (ms)
        const speedStart = 1000 / avgStart;
        const speedEnd = 1000 / avgEnd;

        // Decay = (Start - End) / Start
        const decay = ((speedStart - speedEnd) / speedStart) * 100;

        setFatigue(decay);
    };

    // Chart Data Preparation
    const chartData = taps.map((t, i) => {
        if (i === 0) return null;
        const interval = t - taps[i - 1];
        const speed = 1000 / interval; // Taps per second instananeous
        return {
            tap: i,
            speed: speed > 10 ? 10 : speed // Cap at 10 for visualization noise
        };
    }).filter(d => d);

    return (
        <Layout>
            <div className="max-w-4xl mx-auto space-y-8">
                <header className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-park-navy mb-4">Rapid Tap Test</h1>
                    <p className="text-xl text-gray-600">
                        Test for <span className="text-park-sage font-bold">Bradykinesia</span> (slowness) and motor fatigue.
                    </p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Control Panel */}
                    <Card title="Configuration" className="h-full">
                        <div className="space-y-6">
                            <div className="flex space-x-4">
                                <button
                                    onClick={() => setMode('manual')}
                                    className={`flex-1 p-4 rounded-xl border-2 flex flex-col items-center ${mode === 'manual' ? 'border-park-sage bg-green-50 text-park-sage' : 'border-gray-200 text-gray-400'}`}
                                >
                                    <MousePointer className="mb-2" />
                                    Manual (Mouse)
                                </button>
                                <button
                                    onClick={() => setMode('serial')}
                                    className={`flex-1 p-4 rounded-xl border-2 flex flex-col items-center ${mode === 'serial' ? 'border-park-sage bg-green-50 text-park-sage' : 'border-gray-200 text-gray-400'}`}
                                >
                                    <Cpu className="mb-2" />
                                    Arduino Sensor
                                </button>
                            </div>

                            {mode === 'serial' && (
                                <div className="p-4 bg-gray-50 rounded-lg">
                                    {!isConnected ? (
                                        <Button onClick={() => connect(handleSerialData)} variant="outline" className="w-full text-base py-2">
                                            <Zap className="w-4 h-4 mr-2" /> Connect Arduino
                                        </Button>
                                    ) : (
                                        <div className="text-green-600 font-bold flex items-center justify-center">
                                            <Activity className="w-5 h-5 mr-2" /> Sensor Connected
                                        </div>
                                    )}
                                    {serialError && <p className="text-red-500 text-sm mt-2">{serialError}</p>}
                                </div>
                            )}

                            <div className="text-center pt-4">
                                {!isActive ? (
                                    <Button onClick={startTest} disabled={mode === 'serial' && !isConnected} className="w-full">
                                        Start 15s Test
                                    </Button>
                                ) : (
                                    <div className="text-6xl font-mono text-park-navy font-bold">
                                        {timeLeft}s
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* Active Testing Area */}
                    <Card title="Test Area" className="h-full flex flex-col items-center justify-center min-h-[300px]">
                        {isActive && mode === 'manual' && (
                            <button
                                onMouseDown={registerTap}
                                className="w-48 h-48 rounded-full bg-park-sage text-white text-2xl font-bold shadow-lg active:scale-95 transition-transform ripple-effect"
                            >
                                TAP HERE
                            </button>
                        )}

                        {isActive && mode === 'serial' && (
                            <div className="text-center">
                                <Activity className="w-24 h-24 text-park-sage animate-pulse mx-auto mb-4" />
                                <p className="text-xl text-gray-500">Tap the physical sensor...</p>
                                <p className="text-4xl font-bold text-park-navy mt-4">{taps.length} Taps</p>
                            </div>
                        )}

                        {!isActive && !showResults && (
                            <p className="text-gray-400">Press Start to begin...</p>
                        )}

                        {/* Live Counter (Manual) */}
                        {isActive && mode === 'manual' && (
                            <p className="mt-8 text-3xl font-bold text-gray-400">{taps.length} Taps</p>
                        )}
                    </Card>
                </div>

                {/* Results Section */}
                {showResults && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Card className="text-center border-t-4 border-blue-500">
                                <h3 className="text-gray-500 uppercase tracking-wide text-sm font-semibold">Total Taps</h3>
                                <p className="text-5xl font-bold text-park-navy mt-2">{taps.length}</p>
                                <p className="text-sm text-gray-400 mt-1">Target: {'>'} 60 (4Hz)</p>
                            </Card>
                            <Card className="text-center border-t-4 border-purple-500">
                                <h3 className="text-gray-500 uppercase tracking-wide text-sm font-semibold">Average Speed</h3>
                                <p className="text-5xl font-bold text-park-navy mt-2">{(taps.length / 15).toFixed(1)} <span className="text-xl">Hz</span></p>
                            </Card>
                            <Card className="text-center border-t-4 border-orange-500">
                                <h3 className="text-gray-500 uppercase tracking-wide text-sm font-semibold">Fatigue Decay</h3>
                                <p className={`text-5xl font-bold mt-2 ${fatigue > 30 ? 'text-red-500' : 'text-green-600'}`}>
                                    {typeof fatigue === 'number' ? `${fatigue.toFixed(1)}%` : '--'}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">Risk if {'>'} 30%</p>
                            </Card>
                        </div>

                        <Card title="Speed Analysis">
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="tap" label={{ value: 'Tap Number', position: 'insideBottom', offset: -5 }} />
                                        <YAxis label={{ value: 'Speed (Hz)', angle: -90, position: 'insideLeft' }} />
                                        <Tooltip />
                                        <Line type="monotone" dataKey="speed" stroke="#4A7C59" strokeWidth={3} dot={{ r: 4 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default TapTest;
