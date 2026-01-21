import React, { useState, useEffect, useRef } from 'react';
import Layout from '../../components/common/Layout';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import useSerialConnection from '../../hooks/useSerialConnection';
import { Timer, Brain, Zap, CheckCircle, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, YAxis, Tooltip } from 'recharts';

const DualTask = () => {
    // Phases: 'intro' -> 'baseline' (10s) -> 'break' -> 'dual' (10s) -> 'results'
    const [phase, setPhase] = useState('intro');
    const [timeLeft, setTimeLeft] = useState(0);
    const [isConnected, setIsConnected] = useState(false); // Manually tracking for UI flow, though logic handles it

    // Data Storage
    const [baselineData, setBaselineData] = useState([]);
    const [dualData, setDualData] = useState([]);
    const [interference, setInterference] = useState(0);

    // Math Questions for Dual Task
    const [mathQuestion, setMathQuestion] = useState("100 - 7 = ?");

    // Serial
    const { connect, disconnect, isConnected: serialConnected } = useSerialConnection();
    const dataBufferRef = useRef([]);

    // Refs for callback access
    const phaseRef = useRef(phase);

    // Keep phaseRef sync'd
    useEffect(() => {
        phaseRef.current = phase;
    }, [phase]);

    // --- EFFECT ---
    useEffect(() => {
        let interval;
        if (timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (timeLeft === 0 && (phase === 'baseline' || phase === 'dual')) {
            completePhase();
        }
        return () => clearInterval(interval);
    }, [timeLeft, phase]);

    useEffect(() => {
        // Flash new math questions during dual phase
        // Slower interval (5s) for better user experience
        if (phase === 'dual') {
            const mathInterval = setInterval(() => {
                const nums = [100, 93, 86, 79, 72, 65, 58, 51, 44, 37];
                const rand = nums[Math.floor(Math.random() * nums.length)];
                setMathQuestion(`${rand} - 7 = ?`);
            }, 5000);
            return () => clearInterval(mathInterval);
        }
    }, [phase]);

    // --- LOGIC ---

    // 1. Handle Sensor Data
    const handleDataStream = (data) => {
        // We only care about Gyro magnitude or Accel Magnitude to detect stability
        // Tremor = Accel variance
        const mag = Math.sqrt(data.accel.x ** 2 + data.accel.y ** 2 + data.accel.z ** 2);

        if (phaseRef.current === 'baseline' || phaseRef.current === 'dual') {
            dataBufferRef.current.push(mag);
        }
    };

    // 2. Start Baseline
    const startBaseline = () => {
        dataBufferRef.current = []; // Clear buffer
        setPhase('baseline');
        setTimeLeft(10);
    };

    // 3. Start Dual Task
    const startDual = () => {
        dataBufferRef.current = []; // Clear buffer
        setPhase('dual');
        setTimeLeft(10);
    };

    // 4. Complete Phase Logic
    const completePhase = () => {
        const capturedData = [...dataBufferRef.current];

        if (phase === 'baseline') {
            setBaselineData(capturedData);
            setPhase('break');
        } else if (phase === 'dual') {
            setDualData(capturedData);
            setPhase('results');
            calculateResults(capturedData);
        }
    };

    // 5. Calculate Results (Cost Formula)
    const calculateResults = (dualPhaseData) => {
        // Variance = sum((x - mean)^2) / N
        const calcVariance = (arr) => {
            if (arr.length === 0) return 0;
            const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
            return arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
        };

        const varBase = calcVariance(baselineData);
        const varDual = calcVariance(dualPhaseData);

        // Interference Cost % = ((VarDual - VarBase) / VarBase) * 100
        // Prevent division by zero
        if (varBase === 0) {
            setInterference(0); // If perfect stillness in baseline (unlikely), assume 0 interference or handle edge case
            return;
        }

        const cost = ((varDual - varBase) / varBase) * 100;
        setInterference(cost);
    };

    // ML Buffer
    const mlBufferRef = useRef([]);

    // 6. Connect Helper (Updated with ML)
    const handleConnect = async () => {
        await connect((data) => {
            // 1. Existing Logic for Variance
            const mag = Math.sqrt(data.accel.x ** 2 + data.accel.y ** 2 + data.accel.z ** 2);

            // Use REF to access current phase inside closure
            if (phaseRef.current === 'baseline' || phaseRef.current === 'dual') {
                dataBufferRef.current.push(mag);
            }

            // 2. ML Logic
            if (phaseRef.current === 'baseline' || phaseRef.current === 'dual') {
                mlBufferRef.current.push({
                    AccelX: data.accel.x,
                    AccelY: data.accel.y,
                    AccelZ: data.accel.z,
                    FSR: data.fsr
                });

                if (mlBufferRef.current.length >= 100) {
                    const chunk = mlBufferRef.current.slice(0, 100);
                    mlBufferRef.current = [];

                    fetch('http://localhost:5000/predict', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(chunk)
                    })
                        .then(res => res.json())
                        .then(res => {
                            if (res.label === 'Tremor') {
                                console.log("Tremor Detected during", phaseRef.current);
                            }
                        })
                        .catch(e => console.error(e));
                }
            }
        });
    };

    // CHART DATA
    const formatChartData = (raw) => raw.map((val, i) => ({ i, val: val.toFixed(2) }));

    return (
        <Layout>
            <div className="max-w-4xl mx-auto space-y-8">
                <header className="text-center">
                    <h1 className="text-4xl font-bold text-park-navy mb-4">Dual-Task Stress Test</h1>
                    <p className="text-xl text-gray-600">
                        Measures <span className="font-bold text-park-sage">Cognitive-Motor Interference</span>.
                        Requires holding the sensor steady while answering math questions.
                    </p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* INSTRUCTIONS CARD */}
                    <Card title="Instructions">
                        <div className="space-y-4 text-lg text-gray-700">
                            <div className={`p-4 rounded-lg flex items-center ${phase === 'baseline' ? 'bg-park-sage text-white' : 'bg-gray-50'}`}>
                                <div className="font-bold text-xl mr-4">1</div>
                                <div>
                                    <h4 className="font-bold">Baseline Phase</h4>
                                    <p className="text-sm opacity-80">Hold sensor steady for 10s.</p>
                                </div>
                            </div>
                            <div className={`p-4 rounded-lg flex items-center ${phase === 'dual' ? 'bg-park-sage text-white' : 'bg-gray-50'}`}>
                                <div className="font-bold text-xl mr-4">2</div>
                                <div>
                                    <h4 className="font-bold">Dual Task Phase</h4>
                                    <p className="text-sm opacity-80">Hold steady + Count backward from 100 by 7.</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8">
                            {!serialConnected ? (
                                <Button onClick={handleConnect} variant="outline" className="w-full">
                                    <Zap className="mr-2" /> Connect Sensor
                                </Button>
                            ) : (
                                <div className="flex items-center justify-center text-green-600 font-bold p-4 bg-green-50 rounded-lg">
                                    <CheckCircle className="mr-2" /> Sensor Ready
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* ACTION AREA */}
                    <Card className="flex flex-col items-center justify-center min-h-[350px] bg-gray-50 text-center">

                        {phase === 'intro' && (
                            <>
                                <Brain className="w-16 h-16 text-gray-400 mb-4" />
                                <p className="mb-6">Connect sensor to begin.</p>
                                <Button onClick={startBaseline} disabled={!serialConnected}>Start Phase 1</Button>
                            </>
                        )}

                        {phase === 'baseline' && (
                            <div className="animate-pulse">
                                <h3 className="text-2xl font-bold text-park-navy mb-4">Keep Hand Steady</h3>
                                <div className="text-6xl font-mono text-park-sage mb-2">{timeLeft}s</div>
                                <p className="text-sm text-gray-500">Recording Movement...</p>
                            </div>
                        )}

                        {phase === 'break' && (
                            <>
                                <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                                <h3 className="text-xl font-bold mb-6">Phase 1 Complete.</h3>
                                <p className="mb-6 text-sm max-w-xs mx-auto">
                                    Next: Do the math problem on screen <b>OUT LOUD</b> while keeping your hand steady.
                                </p>
                                <Button onClick={startDual}>Start Phase 2</Button>
                            </>
                        )}

                        {phase === 'dual' && (
                            <div className="text-center w-full">
                                <h3 className="text-gray-500 font-bold uppercase tracking-wider mb-8">Solve Out Loud</h3>
                                <div className="text-5xl font-bold text-park-navy mb-10 py-8 bg-white shadow-lg rounded-xl border border-gray-200">
                                    {mathQuestion}
                                </div>
                                <div className="text-4xl font-mono text-park-sage">{timeLeft}s</div>
                            </div>
                        )}

                        {phase === 'results' && (
                            <div className="text-center">
                                <h3 className="text-lg font-bold text-gray-500 uppercase mb-2">Interference Cost</h3>
                                <div className={`text-6xl font-bold mb-4 ${interference > 30 ? 'text-red-500' : 'text-green-600'}`}>
                                    {interference.toFixed(1)}%
                                </div>
                                <p className="text-gray-600 mb-6">
                                    {interference > 30 ? "High Interference (Cognitive Load Affects Motor)" : "Low Interference (Normal)"}
                                </p>
                                <Button onClick={() => setPhase('intro')} variant="outline">Test Again</Button>
                            </div>
                        )}

                    </Card>
                </div>

                {/* GRAPHS (Only show after Phase 1 is done to avoid distraction?) */}
                {(phase === 'break' || phase === 'results') && (
                    <Card title="Tremor Analysis" className="mt-8">
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={formatChartData(phase === 'break' ? baselineData : dualData)}>
                                    <defs>
                                        <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4A7C59" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#4A7C59" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <YAxis hide />
                                    <Tooltip />
                                    <Area type="monotone" dataKey="val" stroke="#4A7C59" fillOpacity={1} fill="url(#colorVal)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="text-center text-xs text-gray-400 mt-2">Motion Variance Visualization</p>
                    </Card>
                )}

            </div>
        </Layout>
    );
};

export default DualTask;
