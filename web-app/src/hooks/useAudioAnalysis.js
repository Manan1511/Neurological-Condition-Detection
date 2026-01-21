import { useState, useRef, useEffect, useCallback } from 'react';

const useAudioAnalysis = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0); // MPT
    const [jitter, setJitter] = useState(0);
    const [shimmer, setShimmer] = useState(0);
    const [visualTimeout, setVisualTimeout] = useState(null);

    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const sourceRef = useRef(null);
    const rafRef = useRef(null);
    const streamRef = useRef(null);

    // Analysis State
    const startTimeRef = useRef(0);
    const amplitudeHistoryRef = useRef([]);
    const pitchHistoryRef = useRef([]);

    // Stale closure fix
    const isRecordingRef = useRef(false);

    // Config
    const FFT_SIZE = 2048;
    const SILENCE_THRESHOLD = 0.02; // Amplitude threshold to count as "voicing"

    // Full Buffer for Backend (Float32)
    const audioBufferRef = useRef([]);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = FFT_SIZE;

            sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
            sourceRef.current.connect(analyserRef.current);

            setIsRecording(true);
            isRecordingRef.current = true;

            setDuration(0);
            setJitter(0);
            setShimmer(0);
            amplitudeHistoryRef.current = [];
            pitchHistoryRef.current = [];
            audioBufferRef.current = [];
            startTimeRef.current = Date.now();

            analyze();

        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone. Please allow permissions.");
        }
    }, []);

    const stopRecording = useCallback(() => {
        setIsRecording(false);
        isRecordingRef.current = false;

        if (rafRef.current) cancelAnimationFrame(rafRef.current);

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
        }

        // Final Calculation
        calculateMetrics();

    }, []);

    const analyze = () => {
        if (!analyserRef.current) return;

        const bufferLength = analyserRef.current.fftSize;
        const timeData = new Float32Array(bufferLength);
        analyserRef.current.getFloatTimeDomainData(timeData);

        // Access current ref value to avoid stale closure
        if (isRecordingRef.current) {
            // Buffer management:
            // Since we overlap significantly (60Hz vs 46ms window), we shouldn't just push EVERYTHING.
            // But for safety to ensure no data loss for ML, pushing all is safer if RAM permits.
            // 5s of float32 at 44.1k is ~800KB if contiguous. With overlap 3x, it's 2.4MB. Fine.
            audioBufferRef.current.push(...timeData);

            // 1. Calculate RMS Amplitude (Loudness) for this frame
            let sumSquares = 0;
            for (let i = 0; i < bufferLength; i++) {
                sumSquares += timeData[i] * timeData[i];
            }
            const rms = Math.sqrt(sumSquares / bufferLength);

            // Update Duration if above threshold
            if (rms > SILENCE_THRESHOLD) {
                setDuration((Date.now() - startTimeRef.current) / 1000);
                amplitudeHistoryRef.current.push(rms);

                // 2. Calculate Pitch (Autocorrelation) for Jitter
                const pitch = autoCorrelate(timeData, audioContextRef.current.sampleRate);
                if (pitch !== -1) {
                    pitchHistoryRef.current.push(pitch);
                }
            }

            rafRef.current = requestAnimationFrame(analyze);
        }
    };

    const calculateMetrics = () => {
        // --- Shimmer ---
        const amps = amplitudeHistoryRef.current;
        if (amps.length > 10) {
            let sumDiff = 0;
            let sumAmp = 0;
            for (let i = 1; i < amps.length; i++) {
                sumDiff += Math.abs(amps[i] - amps[i - 1]);
                sumAmp += amps[i];
            }
            const meanAmp = sumAmp / amps.length;
            const calculatedShimmer = (sumDiff / (amps.length - 1)) / meanAmp;
            setShimmer(calculatedShimmer * 100);
        }

        // --- Jitter ---
        const pitches = pitchHistoryRef.current;
        if (pitches.length > 10) {
            let numPeriods = 0;
            const periods = pitches.map(f => 1 / f);
            let sumPeriod = 0;
            let sumPeriodDiff = 0;

            for (let i = 1; i < periods.length; i++) {
                sumPeriodDiff += Math.abs(periods[i] - periods[i - 1]);
                sumPeriod += periods[i];
            }

            const meanPeriod = sumPeriod / periods.length;
            const calculatedJitter = (sumPeriodDiff / (periods.length - 1)) / meanPeriod;
            setJitter(calculatedJitter * 100);
        }
    };

    // Simple Autocorrelation for Pitch Detection
    const autoCorrelate = (buffer, sampleRate) => {
        let SIZE = buffer.length;
        let sumOfSquares = 0;
        for (let i = 0; i < SIZE; i++) {
            const val = buffer[i];
            sumOfSquares += val * val;
        }
        const rootMeanSquare = Math.sqrt(sumOfSquares / SIZE);
        if (rootMeanSquare < 0.01) {
            return -1; // Not enough signal
        }

        let r1 = 0, r2 = SIZE - 1, thres = 0.2;
        for (let i = 0; i < SIZE / 2; i++) {
            if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
        }
        for (let i = 1; i < SIZE / 2; i++) {
            if (Math.abs(buffer[SIZE - i]) < thres) { r2 = SIZE - i; break; }
        }

        buffer = buffer.slice(r1, r2);
        SIZE = buffer.length;

        const c = new Array(SIZE).fill(0);
        for (let i = 0; i < SIZE; i++) {
            for (let j = 0; j < SIZE - i; j++) {
                c[i] = c[i] + buffer[j] * buffer[j + i];
            }
        }

        let d = 0;
        while (c[d] > c[d + 1]) d++;
        let maxval = -1, maxpos = -1;
        for (let i = d; i < SIZE; i++) {
            if (c[i] > maxval) {
                maxval = c[i];
                maxpos = i;
            }
        }
        let T0 = maxpos;

        // Interpolation
        let x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
        let a = (x1 + x3 - 2 * x2) / 2;
        let b = (x3 - x1) / 2;
        if (a) T0 = T0 - b / (2 * a);

        return sampleRate / T0;
    };

    const clearAudioBuffer = useCallback(() => {
        audioBufferRef.current = [];
    }, []);

    return {
        isRecording,
        startRecording,
        stopRecording,
        duration,
        metrics: { jitter, shimmer },
        analyser: analyserRef.current,
        audioBuffer: audioBufferRef
    };
};

export default useAudioAnalysis;

