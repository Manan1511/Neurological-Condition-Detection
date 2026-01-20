import React, { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../../components/common/Layout';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { Brain, CheckCircle, AlertTriangle, RotateCcw, Play } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';

const StroopTest = () => {
    const [gameState, setGameState] = useState('intro'); // intro, test, results
    const [stimulus, setStimulus] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [results, setResults] = useState({ neutral: [], incongruent: [] });
    const [completedTrials, setCompletedTrials] = useState(0);

    // Configuration
    const TOTAL_TRIALS = 20; // 10 Neutral, 10 Incongruent
    const COLORS = [
        { name: 'RED', hex: '#EF4444', key: 'r' },
        { name: 'GREEN', hex: '#22C55E', key: 'g' },
        { name: 'BLUE', hex: '#3B82F6', key: 'b' },
        { name: 'YELLOW', hex: '#EAB308', key: 'y' }
    ];

    const startTimeRef = useRef(null);
    const timeoutRef = useRef(null);

    // --- LOGIC ---

    const generateStimulus = () => {
        const type = Math.random() > 0.5 ? 'neutral' : 'incongruent';
        const colorObj = COLORS[Math.floor(Math.random() * COLORS.length)];

        let word = '';
        if (type === 'neutral') {
            word = 'XXXX'; // Neutral stimulus (measure motor/color speed only)
        } else {
            // Incongruent: Word is a color name DIFFERENT from the ink color
            const otherColors = COLORS.filter(c => c.name !== colorObj.name);
            word = otherColors[Math.floor(Math.random() * otherColors.length)].name;
        }

        return {
            word: word,
            color: colorObj.hex,
            colorName: colorObj.name,
            type: type
        };
    };

    const nextTrial = useCallback(() => {
        setFeedback(null); // Clear feedback immediately

        if (completedTrials >= TOTAL_TRIALS) {
            setGameState('results');
            return;
        }

        // Random Inter-Stimulus Interval (ISI) 500-1500ms
        const delay = 500 + Math.random() * 1000;

        timeoutRef.current = setTimeout(() => {
            const newStimulus = generateStimulus();
            setStimulus(newStimulus);
            startTimeRef.current = Date.now();
        }, delay);

    }, [completedTrials]);

    const handleInput = useCallback((e) => {
        if (gameState !== 'test' || !stimulus) return;

        const pressedKey = e.key.toLowerCase();
        // Valid keys only
        if (!['r', 'g', 'b', 'y'].includes(pressedKey)) return;

        const targetKey = COLORS.find(c => c.name === stimulus.colorName).key;
        const reactionTime = Date.now() - startTimeRef.current;
        const isCorrect = pressedKey === targetKey;

        if (isCorrect) {
            setResults(prev => ({
                ...prev,
                [stimulus.type]: [...prev[stimulus.type], reactionTime]
            }));
            setFeedback('Correct');
        } else {
            setFeedback('Miss');
            // We penalize errors by not recording the time (or adding a penalty in real clinical settings)
        }

        setStimulus(null);
        setCompletedTrials(prev => prev + 1);

        // Short feedback pause
        setTimeout(nextTrial, 300);

    }, [gameState, stimulus, nextTrial, completedTrials]);

    // Keyboard Listener
    useEffect(() => {
        window.addEventListener('keydown', handleInput);
        return () => window.removeEventListener('keydown', handleInput);
    }, [handleInput]);

    useEffect(() => {
        return () => clearTimeout(timeoutRef.current);
    }, []);

    const startTest = () => {
        setResults({ neutral: [], incongruent: [] });
        setCompletedTrials(0);
        setGameState('test');
        nextTrial();
    };

    // --- SCORING (Interference) ---
    const getAverage = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    // CW (Color-Word / Incongruent) Time
    const avgIncongruent = getAverage(results.incongruent);
    // C (Color / Neutral) Time - serves as the "Predicted" baseline for motor speed
    const avgNeutral = getAverage(results.neutral);

    // Interference Score = CW - C
    // Positive score means Incongruent took longer (Normal Stroop Effect).
    // excessively high score (>300ms) indicates cognitive rigidity (PD risk).
    const interferenceScore = avgIncongruent - avgNeutral;

    const chartData = [
        { name: 'Neutral (Baseline)', time: Math.round(avgNeutral), fill: '#9CA3AF' },
        { name: 'Incongruent (Conflict)', time: Math.round(avgIncongruent), fill: '#EF4444' }
    ];

    return (
        <Layout>
            <div className="max-w-4xl mx-auto space-y-8">
                <header className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-park-navy mb-4">Stroop Interference Test</h1>
                    <p className="text-xl text-gray-600">
                        Measures <span className="font-bold text-park-sage">Cognitive Inhibition</span>.
                    </p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Card title="Instructions" className="h-full">
                        <div className="space-y-4 text-gray-700 text-lg">
                            <p>Identify the <span className="font-bold underline">INK COLOR</span> of the text shown.</p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>If you see <span className="font-bold text-red-500">XXXX</span>, press <b>R</b> (Red).</li>
                                <li>If you see <span className="font-bold text-blue-500">RED</span>, press <b>B</b> (Blue).</li>
                            </ul>
                            <div className="grid grid-cols-4 gap-2 mt-6">
                                <div className="p-3 bg-red-100 rounded text-center border-2 border-red-200"><b>R</b><br /><span className="text-xs">Red</span></div>
                                <div className="p-3 bg-green-100 rounded text-center border-2 border-green-200"><b>G</b><br /><span className="text-xs">Green</span></div>
                                <div className="p-3 bg-blue-100 rounded text-center border-2 border-blue-200"><b>B</b><br /><span className="text-xs">Blue</span></div>
                                <div className="p-3 bg-yellow-100 rounded text-center border-2 border-yellow-200"><b>Y</b><br /><span className="text-xs">Yell</span></div>
                            </div>
                        </div>
                    </Card>

                    <Card className="flex flex-col items-center justify-center min-h-[400px] bg-gray-50 relative">
                        {gameState === 'intro' && (
                            <div className="text-center">
                                <Brain className="w-20 h-20 text-park-sage mx-auto mb-6" />
                                <Button onClick={startTest} className="w-48 text-lg">
                                    <Play className="w-5 h-5 mr-2" /> Start Test
                                </Button>
                            </div>
                        )}

                        {gameState === 'test' && stimulus && (
                            <div className="absolute top-4 right-4 text-gray-400 font-mono text-sm">
                                Trial {completedTrials + 1} / {TOTAL_TRIALS}
                            </div>
                        )}

                        {gameState === 'test' && stimulus && (
                            <div className="animate-in fade-in zoom-in duration-200">
                                <div
                                    className="text-7xl font-black mb-12 select-none tracking-wider"
                                    style={{ color: stimulus.color }}
                                >
                                    {stimulus.word}
                                </div>
                            </div>
                        )}

                        {/* Visual Feedback Overlay */}
                        {feedback && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-sm">
                                {feedback === 'Correct' ? (
                                    <CheckCircle className="w-24 h-24 text-green-500 animate-bounce" />
                                ) : (
                                    <AlertTriangle className="w-24 h-24 text-red-500 animate-pulse" />
                                )}
                            </div>
                        )}

                        {gameState === 'results' && (
                            <div className="text-center w-full animate-in slide-in-from-bottom">
                                <h3 className="text-gray-500 uppercase tracking-widest text-sm font-bold mb-2">Interference Score</h3>
                                <div className={`text-6xl font-bold mb-2 ${interferenceScore > 300 ? 'text-red-500' : 'text-park-sage'}`}>
                                    {Math.round(interferenceScore)} <span className="text-2xl text-gray-400">ms</span>
                                </div>
                                <p className="text-gray-500 mb-6 text-sm">
                                    (Difference between Conflict and Baseline)
                                </p>

                                <div className="h-48 w-full mb-6">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} layout="vertical">
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                                            <Tooltip cursor={{ fill: 'transparent' }} />
                                            <Bar dataKey="time" radius={[0, 4, 4, 0]} barSize={40}>
                                                {chartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                <Button onClick={() => setGameState('intro')} variant="outline">
                                    <RotateCcw className="w-4 h-4 mr-2" /> Retry Test
                                </Button>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </Layout>
    );
};

export default StroopTest;
