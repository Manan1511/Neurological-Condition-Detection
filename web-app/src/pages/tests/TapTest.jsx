import React, { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../../components/common/Layout';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import useSerialConnection from '../../hooks/useSerialConnection';
import { Activity, Zap, MousePointer, Cpu, Timer } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const TapTest = ({ onComplete, isWizardMode = false }) => {
    // Mode: 'manual' only now
    // const [mode, setMode] = useState('manual');
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

    // Auto-start for wizard mode (Manual defaults for simplicity unless serial connected)
    useEffect(() => {
        if (isWizardMode && !isActive && !showResults) {
            // Wait for user to be ready? Or auto start?
            // Let's not auto-start tap test as it requires interaction.
            // But we can simplify the UI.
        }
    }, [isWizardMode]);

    // --- LOGIC ---

    const hasEndedRef = useRef(false);
    const submittedRef = useRef(false); // Assuming this was meant to be here based on usage

    // Declarative Timer Logic
    useEffect(() => {
        let interval = null;
        if (isActive && timeLeft > 0) {
            console.log("TapTest: Timer active. TimeLeft:", timeLeft);
            interval = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        // We'll handle end in a separate effect or just here
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else if (timeLeft === 0 && isActive) {
            // Time is up
            endTest();
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isActive, timeLeft]);

    const startTest = () => {
        // Reset state
        setTaps([]);
        setTimeLeft(15);
        setFatigue(null);
        setShowResults(false);
        hasEndedRef.current = false;
        submittedRef.current = false;

        // Start
        setIsActive(true);
    };

    const endTest = () => {
        if (hasEndedRef.current) return;
        hasEndedRef.current = true;

        console.log("TapTest: endTest called");
        setIsActive(false);

        try {
            const results = calculateResults();
            setShowResults(true);
        } catch (err) {
            console.error("TapTest: Error calculating results", err);
            setShowResults(true);
        }
    };

    // Trigger completion
    useEffect(() => {
        if (showResults && isWizardMode && onComplete && !submittedRef.current) {
            const timer = setTimeout(() => {
                if (!submittedRef.current) {
                    submittedRef.current = true;
                    console.log("TapTest: Completing step...", taps.length);

                    let safeFatigue = 0;
                    try {
                        const res = calculateResultsLogic(taps);
                        safeFatigue = res.fatigue;
                    } catch (e) {
                        console.warn("Fatigue calculation failed", e);
                    }

                    onComplete({
                        taps: taps.length,
                        fatigue: safeFatigue
                    });
                }
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [showResults, isWizardMode, onComplete, taps]);

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

    // Helper for calculation to avoid state closure issues
    const calculateResultsLogic = (currentTaps) => {
        if (currentTaps.length < 10) return { fatigue: "Insufficient Data" };
        const intervals = [];
        for (let i = 1; i < currentTaps.length; i++) {
            intervals.push(currentTaps[i] - currentTaps[i - 1]);
        }
        const startIntervals = intervals.slice(0, 5);
        const avgStart = startIntervals.reduce((a, b) => a + b, 0) / startIntervals.length;
        const endIntervals = intervals.slice(-5);
        const avgEnd = endIntervals.reduce((a, b) => a + b, 0) / endIntervals.length;
        const speedStart = 1000 / avgStart;
        const speedEnd = 1000 / avgEnd;
        const decay = ((speedStart - speedEnd) / speedStart) * 100;
        return { fatigue: decay };
    }

    const calculateResults = () => {
        const res = calculateResultsLogic(taps);
        setFatigue(res.fatigue);
        return res;
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

    const Content = () => (
        <div className="max-w-4xl mx-auto space-y-8">
            {!isWizardMode && (
                <header className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-park-navy mb-4">Rapid Tap Test</h1>
                    <p className="text-xl text-gray-600">
                        Test for <span className="text-park-sage font-bold">Bradykinesia</span> (slowness) and motor fatigue.
                    </p>
                </header>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Control Panel */}
                <Card title="Configuration" className="h-full">
                    <div className="space-y-6">
                        <div className="p-4 bg-green-50 rounded-xl border-2 border-park-sage flex flex-col items-center text-park-sage">
                            <MousePointer className="mb-2 w-8 h-8" />
                            <span className="font-bold">Manual Mode (Touch/Mouse)</span>
                        </div>

                        <div className="text-center pt-4">
                            {!isActive ? (
                                <Button onClick={startTest} className="w-full text-lg py-4">
                                    Start 15s Test
                                </Button>
                            ) : (
                                <div className="text-6xl font-mono text-park-navy font-bold animate-pulse">
                                    {timeLeft}s
                                </div>
                            )}
                        </div>
                    </div>
                </Card>

                {/* Active Testing Area */}
                <Card title="Test Area" className="h-full flex flex-col items-center justify-center min-h-[300px]">
                    {isActive ? (
                        <button
                            onMouseDown={registerTap}
                            className="w-48 h-48 rounded-full bg-park-sage text-white text-3xl font-bold shadow-2xl active:scale-95 transition-transform ripple-effect border-8 border-green-100"
                        >
                            TAP HERE
                        </button>
                    ) : !showResults ? (
                        <div className="text-center text-gray-400">
                            <MousePointer className="w-16 h-16 mx-auto mb-4 opacity-20" />
                            <p>Press Start to begin...</p>
                        </div>
                    ) : null}

                    {/* Live Counter */}
                    {isActive && (
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

                    {isWizardMode && (
                        <div className="text-center text-park-sage font-bold animate-pulse">
                            Processing Results...
                        </div>
                    )}

                    {!isWizardMode && (
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
                    )}
                </div>
            )}
        </div>
    );

    if (isWizardMode) return <Content />;

    return (
        <Layout>
            <Content />
        </Layout>
    );
};

export default TapTest;
