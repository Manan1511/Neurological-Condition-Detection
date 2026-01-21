import React, { useState } from 'react';
import Layout from '../components/common/Layout';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import TremorTest from './tests/TremorTest';
import VocalTest from './tests/VocalTest';
import TapTest from './tests/TapTest';
import { useSerialContext } from '../context/SerialContext';
import { Activity, Mic, MousePointer, CheckCircle, AlertTriangle, FileText, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import { Navigate } from 'react-router-dom';

import BackgroundTremorMonitor from '../components/common/BackgroundTremorMonitor';

const FullAssessment = () => {
    const [step, setStep] = useState(0); // 0=Intro, 1=Tremor, 2=Vocal, 3=Tap, 4=Results
    const [results, setResults] = useState({
        tremor: null,
        vocal: null,
        tap: null
    });

    const { connect, isConnected } = useSerialContext();
    const [backgroundLogs, setBackgroundLogs] = useState([]);

    const handleBackgroundLog = (log) => {
        // Keep last 20 logs
        setBackgroundLogs(prev => [...prev.slice(-19), log]);
    };

    const handleNext = React.useCallback((data) => {
        console.log("FullAssessment: handleNext called from step", step, "Data:", data);
        // Save result based on current step
        if (step === 1) setResults(p => ({ ...p, tremor: data }));
        if (step === 2) setResults(p => ({ ...p, vocal: data }));
        if (step === 3) setResults(p => ({ ...p, tap: data }));

        setStep(p => p + 1);
    }, [step]);

    const generatePDF = () => {
        const doc = new jsPDF();
        const date = new Date().toLocaleDateString();

        // --- Header ---
        doc.setFillColor(31, 45, 61); // park-navy
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text("neurolife", 20, 25);
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text("Clinical Assessment Report", 20, 35);
        doc.setTextColor(0, 0, 0);
        doc.text(`Date: ${date}`, 150, 35);

        let y = 60;

        // --- 1. Resting Tremor ---
        doc.setFontSize(16);
        doc.setTextColor(31, 45, 61);
        doc.text("1. Resting Tremor Analysis", 20, y);
        y += 10;
        doc.setFontSize(10);
        doc.setTextColor(100);
        if (results.tremor) {
            doc.text(`Classification: ${results.tremor.label}`, 25, y);
            doc.text(`Dominant Frequency: ${results.tremor.features.dom_freq.toFixed(2)} Hz`, 100, y);
            y += 6;
            doc.text(`Tremor Energy: ${results.tremor.features.tremor_energy.toFixed(2)}`, 25, y);

            // Simple Bar for Energy
            doc.setDrawColor(200);
            doc.rect(100, y - 4, 50, 4);
            doc.setFillColor(results.tremor.features.tremor_energy > 500 ? 255 : 0, results.tremor.features.tremor_energy > 500 ? 0 : 200, 0);
            const w = Math.min(50, results.tremor.features.tremor_energy / 20); // Scale
            doc.rect(100, y - 4, w, 4, 'F');
        } else {
            doc.text("Not Completed", 25, y);
        }
        y += 20;

        // --- 2. Vocal Motor ---
        doc.setFontSize(16);
        doc.setTextColor(31, 45, 61);
        doc.text("2. Vocal Motor Analysis", 20, y);
        y += 10;
        doc.setFontSize(10);
        doc.setTextColor(100);
        if (results.vocal) {
            doc.text(`Classification: ${results.vocal.label} (${results.vocal.confidence}%)`, 25, y);
            y += 6;
            doc.text(`Jitter (Micro-fluctuations): ${results.vocal.features.jitter.toFixed(2)}%`, 25, y);
            doc.text(`Shimmer (Amplitude Var): ${results.vocal.features.shimmer.toFixed(2)}%`, 100, y);
            y += 6;
            doc.text(`HNR (Noise Ratio): ${results.vocal.features.hnr.toFixed(2)} dB`, 25, y);
        } else {
            doc.text("Not Completed", 25, y);
        }
        y += 20;

        // --- 3. Rapid Tap ---
        doc.setFontSize(16);
        doc.setTextColor(31, 45, 61);
        doc.text("3. Rapid Tap (Bradykinesia)", 20, y);
        y += 10;
        doc.setFontSize(10);
        doc.setTextColor(100);
        if (results.tap) {
            doc.text(`Total Taps (15s): ${results.tap.taps}`, 25, y);
            doc.text(`Fatigue Decay: ${results.tap.fatigue}%`, 100, y);

            // Tap Speed Graph
            y += 10;
            doc.text("Tap Intervals (ms) - Lower is Faster", 25, y);
            y += 5;

            if (results.tap.data && results.tap.data.length > 2) {
                const data = results.tap.data;
                const intervals = [];
                for (let i = 1; i < data.length; i++) intervals.push(data[i] - data[i - 1]);

                // Draw Graph
                const startX = 25;
                const startY = y + 30;
                const maxInterval = Math.max(...intervals, 500);
                const stepX = 100 / intervals.length;

                doc.setLineWidth(0.5);
                doc.setDrawColor(100, 150, 200);

                for (let i = 0; i < intervals.length - 1; i++) {
                    const h1 = (intervals[i] / maxInterval) * 30;
                    const h2 = (intervals[i + 1] / maxInterval) * 30;
                    doc.line(startX + (i * stepX), startY - h1, startX + ((i + 1) * stepX), startY - h2);
                }

                // Baseline
                doc.setDrawColor(200);
                doc.line(startX, startY, startX + 100, startY);
                y += 35;
            } else {
                doc.text(" insufficient data for graph", 25, y);
                y += 10;
            }

        } else {
            doc.text("Not Completed", 25, y);
            y += 10;
        }
        y += 10;

        // --- 4. Background Monitor Log ---
        if (y > 230) { doc.addPage(); y = 20; }

        doc.setFontSize(16);
        doc.setTextColor(31, 45, 61);
        doc.text("4. Background Monitor Logs", 20, y);
        y += 10;
        doc.setFontSize(9);
        doc.setTextColor(120);

        doc.text("Timestamp", 25, y);
        doc.text("Event", 60, y);
        doc.text("Confidence", 120, y);
        doc.text("Freq", 160, y);
        y += 4;
        doc.line(25, y, 180, y);
        y += 5;

        backgroundLogs.slice(0, 15).forEach(log => {
            doc.text(log.timestamp, 25, y);
            doc.text(log.label, 60, y);
            doc.text(`${log.confidence}%`, 120, y);
            doc.text(`${log.freq.toFixed(1)} Hz`, 160, y);
            y += 6;
        });

        if (backgroundLogs.length === 0) {
            doc.text("No significant background events detected.", 25, y);
        }

        // Save
        doc.save(`neurolife_report_${Date.now()}.pdf`);
    };

    const steps = [
        { title: "Assessment Ready", icon: FileText },
        { title: "Resting Tremor", icon: Activity },
        { title: "Vocal Motor", icon: Mic },
        { title: "Rapid Tap", icon: MousePointer },
        { title: "Complete", icon: CheckCircle }
    ];

    return (
        <Layout>
            <div className="max-w-5xl mx-auto">
                <BackgroundTremorMonitor onLog={handleBackgroundLog} />
                {/* Wizard Header */}
                <div className="mb-12">
                    <h1 className="text-3xl font-bold text-park-navy mb-6 text-center">Full Diagnostic Assessment</h1>
                    <div className="flex justify-between items-center relative">
                        <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -z-10 transform -translate-y-1/2"></div>
                        {steps.map((s, i) => {
                            const Icon = s.icon;
                            let state = 'pending';
                            if (i < step) state = 'completed';
                            if (i === step) state = 'active';

                            return (
                                <div key={i} className="flex flex-col items-center bg-park-bg px-2">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${state === 'active' ? 'bg-park-sage border-park-sage text-white scale-110 shadow-lg' :
                                        state === 'completed' ? 'bg-green-100 border-green-500 text-green-600' :
                                            'bg-white border-gray-300 text-gray-300'
                                        }`}>
                                        <Icon size={20} />
                                    </div>
                                    <span className={`text-xs mt-2 font-medium ${state === 'active' ? 'text-park-navy' : 'text-gray-400'}`}>
                                        {s.title}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Content */}
                <Card className="min-h-[500px]">
                    {step === 0 && (
                        <div className="text-center py-10 space-y-6">
                            <FileText className="w-20 h-20 text-park-sage mx-auto" />
                            <h2 className="text-2xl font-bold text-park-navy">Ready to begin?</h2>
                            <p className="text-gray-600 max-w-lg mx-auto">
                                This assessment runs 3 standard tests in sequence to evaluate motor and vocal function.
                                It takes approximately 1.5 minutes.
                            </p>

                            {!isConnected && (
                                <div className="p-4 bg-yellow-50 rounded-lg max-w-md mx-auto mb-4 border border-yellow-200">
                                    <AlertTriangle className="inline-block text-yellow-600 mr-2" />
                                    <span className="text-yellow-700 font-medium">Device connection required for full metrics.</span>
                                    <div className="mt-3">
                                        <Button onClick={connect} variant="outline" className="w-full">Connect Sensor</Button>
                                    </div>
                                </div>
                            )}

                            <Button onClick={() => setStep(1)} className="w-48 text-lg py-3">
                                Start Assessment
                            </Button>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="animate-in fade-in slide-in-from-right duration-300">
                            <h2 className="text-center text-xl font-bold text-gray-500 mb-6 uppercase tracking-wider">Step 1: Tremor Analysis (10s)</h2>
                            <TremorTest isWizardMode={true} onComplete={handleNext} />
                        </div>
                    )}

                    {step === 2 && (
                        <div className="animate-in fade-in slide-in-from-right duration-300">
                            <h2 className="text-center text-xl font-bold text-gray-500 mb-6 uppercase tracking-wider">Step 2: Vocal Analysis (5s)</h2>
                            <VocalTest isWizardMode={true} onComplete={handleNext} />
                        </div>
                    )}

                    {step === 3 && (
                        <div className="animate-in fade-in slide-in-from-right duration-300">
                            <h2 className="text-center text-xl font-bold text-gray-500 mb-6 uppercase tracking-wider">Step 3: Rapid Tap (15s)</h2>
                            <TapTest isWizardMode={true} onComplete={handleNext} />
                        </div>
                    )}

                    {step === 4 && (
                        <div className="text-center py-10 space-y-8 animate-in zoom-in duration-500">
                            <div className="inline-block p-4 rounded-full bg-green-100 mb-4">
                                <CheckCircle className="w-24 h-24 text-green-600" />
                            </div>
                            <h2 className="text-3xl font-bold text-park-navy">Assessment Complete</h2>
                            <p className="text-gray-600">Your data has been processed.</p>

                            <div className="flex justify-center space-x-4">
                                <Button onClick={generatePDF} className="w-64 text-lg py-4 shadow-xl shadow-park-sage/20">
                                    <Download className="w-6 h-6 mr-3" />
                                    Download Report
                                </Button>
                            </div>

                            <Button onClick={() => window.location.reload()} variant="ghost" className="text-gray-400 hover:text-park-sage">
                                Return to Dashboard
                            </Button>
                        </div>
                    )}
                </Card>
            </div>
        </Layout>
    );
};

export default FullAssessment;
