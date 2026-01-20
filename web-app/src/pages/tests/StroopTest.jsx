import React, { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../../components/common/Layout';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { Brain, CheckCircle, AlertTriangle, RotateCcw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const StroopTest = () => {
    const [gameState, setGameState] = useState('intro'); // intro, test, results
    const [currentTrial, setCurrentTrial] = useState(0);
    const [stimulus, setStimulus] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [results, setResults] = useState({ congruent: [], incongruent: [] });

    // Configuration
    const TOTAL_TRIALS = 20;
    const COLORS = [
        { name: 'RED', hex: '#EF4444', key: 'r' },
        { name: 'GREEN', hex: '#22C55E', key: 'g' },
        { name: 'BLUE', hex: '#3B82F6', key: 'b' },
        { name: 'YELLOW', hex: '#EAB308', key: 'y' }
    ];

    const startTimeRef = useRef(null);
    const timeoutRef = useRef(null);

    const generateStimulus = () => {
        const wordObj = COLORS[Math.floor(Math.random() * COLORS.length)];
        const isCongruent = Math.random() > 0.5;
        let colorObj;

        if (isCongruent) {
            colorObj = wordObj;
        } else {
            const otherColors = COLORS.filter(c => c.name !== wordObj.name);
            colorObj = otherColors[Math.floor(Math.random() * otherColors.length)];
        }

        return {
            word: wordObj.name,
            color: colorObj.hex,
            colorName: colorObj.name,
            type: isCongruent ? 'congruent' : 'incongruent'
        };
    };

    const nextTrial = useCallback(() => {
        if (currentTrial >= TOTAL_TRIALS) {
            setGameState('results');
            return;
        }
        setFeedback(null);
        const delay = 500 + Math.random() * 1000;
        timeoutRef.current = setTimeout(() => {
            const newStimulus = generateStimulus();
            setStimulus(newStimulus);
            startTimeRef.current = Date.now();
        }, delay);
    }, [currentTrial]);

    const handleInput = useCallback((e) => {
        if (gameState !== 'test' || !stimulus) return;
        const pressedKey = e.key.toLowerCase();
        const targetKey = COLORS.find(c => c.name === stimulus.colorName).key;

        if (!['r', 'g', 'b', 'y'].includes(pressedKey)) return;

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
        }

        setStimulus(null);
        setCurrentTrial(prev => prev + 1);
        setTimeout(nextTrial, 500);
    }, [gameState, stimulus, nextTrial]);

    useEffect(() => {
        window.addEventListener('keydown', handleInput);
        return () => window.removeEventListener('keydown', handleInput);
    }, [handleInput]);

    useEffect(() => {
        return () => clearTimeout(timeoutRef.current);
    }, []);

    const startTest = () => {
        setResults({ congruent: [], incongruent: [] });
        setCurrentTrial(0);
        setGameState('test');
        nextTrial();
    };

    const getAverage = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const avgCongruent = getAverage(results.congruent);
    const avgIncongruent = getAverage(results.incongruent);
    const interference = avgIncongruent - avgCongruent;
    const status = interference > 250 ? "High Cognitive Load" : "Normal Range";

    const chartData = [
        { name: 'Congruent', time: Math.round(avgCongruent), fill: '#22C55E' },
        { name: 'Incongruent', time: Math.round(avgIncongruent), fill: '#EF4444' }
    ];

    return (
        <Layout>
            <div className="max-w-4xl mx-auto space-y-8">
                <header className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-park-navy mb-4">Cognitive Inhibition Test</h1>
                    <p className="text-xl text-gray-600">Based on the Stroop Effect.</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Card title="Instructions">
                        <div className="space-y-4 text-gray-700">
                            <p>Press the key for the <b>INK COLOR</b>, not the word.</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-2 bg-red-100 rounded text-center"><b>R</b> for Red</div>
                                <div className="p-2 bg-green-100 rounded text-center"><b>G</b> for Green</div>
                                <div className="p-2 bg-blue-100 rounded text-center"><b>B</b> for Blue</div>
                                <div className="p-2 bg-yellow-100 rounded text-center"><b>Y</b> for Yellow</div>
                            </div>
                        </div>
                    </Card>

                    <Card className="flex flex-col items-center justify-center min-h-[400px] bg-gray-50 relative">
                        {gameState === 'intro' && (
                            <div className="text-center">
                                <Brain className="w-16 h-16 text-park-sage mx-auto mb-4" />
                                <Button onClick={startTest}>Start Test</Button>
                            </div>
                        )}
                        {gameState === 'test' && (
                            <div className="absolute top-6 right-6 flex flex-col items-end">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Trial</span>
                                <span className="text-3xl font-black text-park-sage">{currentTrial + 1}<span className="text-gray-300 text-lg">/{TOTAL_TRIALS}</span></span>
                            </div>
                        )}
                        {gameState === 'test' && stimulus && (
                            <div className="text-8xl font-black mb-12 select-none" style={{ color: stimulus.color }}>
                                {stimulus.word}
                            </div>
                        )}
                        {feedback && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                                {feedback === 'Correct' ? <CheckCircle className="w-20 text-green-500" /> : <AlertTriangle className="w-20 text-red-500" />}
                            </div>
                        )}
                        {gameState === 'results' && (
                            <div className="text-center w-full">
                                <h3 className="text-gray-500 uppercase">Interference Cost</h3>
                                <div className={`text-6xl font-black mb-6 ${interference > 250 ? 'text-red-500' : 'text-green-600'}`}>
                                    {Math.round(interference)} <span className="text-3xl text-gray-400 font-medium">ms</span>
                                </div>
                                <p className="mb-4">{status}</p>
                                <div className="h-48 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData}>
                                            <XAxis dataKey="name" hide />
                                            <Tooltip />
                                            <Bar dataKey="time">
                                                {chartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <Button onClick={() => setGameState('intro')} variant="outline"><RotateCcw className="mr-2 h-4 w-4" /> Retry</Button>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </Layout>
    );
};
export default StroopTest;
