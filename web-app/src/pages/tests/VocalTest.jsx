import React from 'react';
import Layout from '../../components/common/Layout';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import AudioVisualizer from '../../components/common/AudioVisualizer';
import useAudioAnalysis from '../../hooks/useAudioAnalysis';
import { Mic, Activity, AlertCircle } from 'lucide-react';

const VocalTest = () => {
    const {
        isRecording,
        startRecording,
        stopRecording,
        duration,
        metrics,
        analyser
    } = useAudioAnalysis();

    const getStatusParams = (val, thresholds) => {
        if (val === 0) return { color: 'text-gray-400', text: 'Waiting' };
        if (val < thresholds.risk) return { color: 'text-green-600', text: 'Normal' };
        return { color: 'text-red-500', text: 'Risk Indicated' };
    };

    // Reverse logic for MPT (Higher is better)
    const getMptStatus = (val) => {
        if (val === 0) return { color: 'text-gray-400', text: 'Waiting' };
        if (val > 10) return { color: 'text-green-600', text: 'Normal (>10s)' };
        return { color: 'text-red-500', text: 'Risk (<10s)' };
    }

    return (
        <Layout>
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-bold text-park-navy mb-4">Vocal Motor Test</h1>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                        Take a deep breath and say <span className="font-bold text-park-sage">"Ahhhhh"</span> for as long and steadily as you can.
                    </p>
                </div>

                <Card className="bg-white">
                    <div className="mb-8">
                        <AudioVisualizer analyser={analyser} isRecording={isRecording} />
                    </div>

                    <div className="flex justify-center mb-8">
                        {!isRecording ? (
                            <Button onClick={startRecording} className="w-64">
                                <Mic className="w-6 h-6 mr-2" />
                                Start Recording
                            </Button>
                        ) : (
                            <Button onClick={async () => {
                                stopRecording();
                                // Send to ML Backend
                                if (audioBuffer.current.length > 0) {
                                    console.log("Sending Audio to ML...", audioBuffer.current.length);
                                    try {
                                        const res = await fetch('http://localhost:5000/predict_audio', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                audio: Array.from(audioBuffer.current), // Convert Float32Array to Array
                                                rate: 44100
                                            })
                                        });
                                        const data = await res.json();
                                        if (data.label) {
                                            // setMlResult(data); 
                                            // Ideally pass this to a result state.
                                            // For now just console log or maybe alert?
                                            // Let's add a state for it.
                                            console.log("ML Result:", data);
                                            alert(`Voice Analysis: ${data.label} (${data.confidence}%)`);
                                        }
                                    } catch (e) {
                                        console.error("ML Verification Failed", e);
                                    }
                                }
                            }} variant="danger" className="w-64 animate-pulse">
                                Stop & Analyze
                            </Button>
                        )}
                    </div>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <ResultCard
                        title="Phonation Time"
                        value={`${duration.toFixed(1)}s`}
                        icon={Activity}
                        status={getMptStatus(duration)}
                        description="Max duration of sustained sound."
                    />
                    <ResultCard
                        title="Jitter (Pitch)"
                        value={`${metrics.jitter.toFixed(2)}%`}
                        icon={AlertCircle}
                        status={getStatusParams(metrics.jitter, { risk: 1.04 })} // 1.04% is typical threshold
                        description="Cycle-to-cycle variation in pitch."
                    />
                    <ResultCard
                        title="Shimmer (Loudness)"
                        value={`${metrics.shimmer.toFixed(2)}%`}
                        icon={Activity}
                        status={getStatusParams(metrics.shimmer, { risk: 3.81 })} // 3.81% typical threshold
                        description="Cycle-to-cycle variation in loudness."
                    />
                </div>
            </div >
        </Layout >
    );
};

const ResultCard = ({ title, value, status, icon: Icon, description }) => (
    <Card className="text-center p-6 bg-white border-t-4 border-park-sage">
        <div className="flex justify-center mb-4 text-park-sage opacity-80">
            <Icon size={32} />
        </div>
        <h3 className="text-lg font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</h3>
        <div className="text-4xl font-bold text-park-navy mb-2">{value}</div>
        <div className={`text-sm font-bold ${status.color} mb-4`}>
            {status.text}
        </div>
        <p className="text-xs text-gray-400">{description}</p>
    </Card>
);

export default VocalTest;
