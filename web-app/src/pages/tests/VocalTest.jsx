import React from 'react';
import Layout from '../../components/common/Layout';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import AudioVisualizer from '../../components/common/AudioVisualizer';
import useAudioAnalysis from '../../hooks/useAudioAnalysis';
import { Mic, Activity, AlertCircle } from 'lucide-react';

const VocalTest = ({ onComplete, isWizardMode = false }) => {
    const {
        isRecording,
        startRecording,
        stopRecording,
        duration,
        metrics,
        analyser,
        audioBuffer
    } = useAudioAnalysis();

    const getStatusParams = (val, thresholds) => {
        if (val === 0) return { color: 'text-gray-400', text: 'Waiting' };
        if (val < thresholds.risk) return { color: 'text-green-600', text: 'Normal' };
        return { color: 'text-red-500', text: 'Risk Indicated' };
    };

    const [analysisResult, setAnalysisResult] = React.useState(null);

    // Reverse logic for MPT (Higher is better)
    const getMptStatus = (val) => {
        if (val === 0) return { color: 'text-gray-400', text: 'Waiting' };
        if (val > 10) return { color: 'text-green-600', text: 'Normal (>10s)' };
        return { color: 'text-red-500', text: 'Risk (<10s)' };
    }

    const [error, setError] = React.useState(null);

    // Auto-stop logic
    React.useEffect(() => {
        if (isRecording && duration >= 5) {
            handleStopAndAnalyze();
        }
    }, [isRecording, duration]);

    const handleStopAndAnalyze = async () => {
        stopRecording();
        setError(null);
        // Send to ML Backend
        if (audioBuffer.current && audioBuffer.current.length > 0) {
            try {
                const sampleRate = 44100;
                // Downsample if needed to reduce payload? (Optional optimization)

                const res = await fetch('http://127.0.0.1:5000/predict_audio', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        audio: Array.from(audioBuffer.current),
                        rate: sampleRate
                    })
                });

                if (!res.ok) {
                    throw new Error(`Server Error: ${res.status}`);
                }

                const data = await res.json();
                if (data.label) {
                    setAnalysisResult(data);
                    if (isWizardMode && onComplete) {
                        setTimeout(() => onComplete(data), 2000); // 2s delay to show success
                    }
                } else {
                    throw new Error("Invalid response from server");
                }
            } catch (e) {
                console.error("ML Verification Failed", e);
                setError(e.message);
            }
        } else {
            setError("No audio recorded.");
        }
    };

    const Content = () => (
        <div className="max-w-4xl mx-auto space-y-8">
            {!isWizardMode && (
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-bold text-park-navy mb-4">Vocal Motor Test</h1>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                        Take a deep breath and say <span className="font-bold text-park-sage">"Ahhhhh"</span> for as long and steadily as you can.
                    </p>
                </div>
            )}

            <Card className="bg-white">
                <div className="mb-8">
                    <AudioVisualizer analyser={analyser} isRecording={isRecording} />
                </div>

                <div className="flex flex-col items-center justify-center mb-8 space-y-4">
                    {isRecording ? (
                        <div className="w-full max-w-md space-y-2 text-center">
                            <div className="text-2xl font-bold text-park-navy animate-pulse">
                                Recording... {(5 - duration).toFixed(1)}s
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div
                                    className="bg-park-sage h-2.5 rounded-full transition-all duration-100 ease-linear"
                                    style={{ width: `${(duration / 5) * 100}%` }}
                                ></div>
                            </div>
                            <p className="text-sm text-gray-500">Keep saying "Ahhhhh"...</p>
                        </div>
                    ) : (analysisResult || error) ? (
                        <div className="text-center animate-in fade-in zoom-in duration-300">
                            <h3 className="text-2xl font-bold text-park-navy mb-2">Analysis Complete</h3>

                            {error ? (
                                <div className="text-red-500 font-bold mb-4 bg-red-50 p-4 rounded-lg border border-red-200">
                                    Analysis Failed: {error}
                                </div>
                            ) : (
                                <div className={`text-xl font-bold ${analysisResult?.label === 'Healthy' ? 'text-green-600' : 'text-red-500'}`}>
                                    Result: {analysisResult?.label} ({analysisResult?.confidence}%)
                                </div>
                            )}

                            {!isWizardMode && (
                                <Button onClick={() => { setAnalysisResult(null); setError(null); startRecording(); }} className="mt-4" variant="secondary">
                                    Retake Test
                                </Button>
                            )}
                            {isWizardMode && !error && (
                                <p className="text-park-sage mt-2">Proceeding to next step...</p>
                            )}
                        </div>
                    ) : (
                        <Button onClick={() => { setAnalysisResult(null); setError(null); startRecording(); }} className="w-64">
                            <Mic className="w-6 h-6 mr-2" />
                            Start 5s Test
                        </Button>
                    )}
                </div>
            </Card>

            {/* Only show results if available */}
            {analysisResult && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <ResultCard
                        title="Jitter (Pitch Shake)"
                        value={`${Number(analysisResult.features.jitter).toFixed(1)}%`}
                        icon={AlertCircle}
                        statusColor={analysisResult.features.jitter < 1.04 ? 'text-green-600' : 'text-red-500'}
                        description="Cycle-to-cycle variation in pitch."
                    />
                    <ResultCard
                        title="Shimmer (Vol Shake)"
                        value={`${Number(analysisResult.features.shimmer).toFixed(1)}%`}
                        icon={Activity}
                        statusColor={analysisResult.features.shimmer < 3.81 ? 'text-green-600' : 'text-red-500'}
                        description="Cycle-to-cycle variation in loudness."
                    />
                    <ResultCard
                        title="HNR (Breathiness)"
                        value={`${Number(analysisResult.features.hnr).toFixed(1)} dB`}
                        icon={Activity}
                        statusColor={analysisResult.features.hnr > 20 ? 'text-green-600' : 'text-red-500'}
                        description="Harmonics-to-Noise Ratio."
                    />
                </div>
            )}
        </div >
    );

    if (isWizardMode) return <Content />;

    return (
        <Layout>
            <Content />
        </Layout >
    );
};

const ResultCard = ({ title, value, statusColor, icon: Icon, description }) => (
    <Card className="text-center p-4 bg-white border-t-4 border-park-sage h-full flex flex-col justify-between">
        <div>
            <div className="flex justify-center mb-3 text-park-sage opacity-80">
                <Icon size={24} />
            </div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">{title}</h3>
            <div className="text-3xl font-bold text-park-navy mb-1">{value}</div>
            {/* Status Text Removed per user request */}
        </div>
        <p className="text-xs text-gray-400 leading-tight mt-2">{description}</p>
    </Card>
);

export default VocalTest;
