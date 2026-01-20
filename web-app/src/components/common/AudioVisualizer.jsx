import React, { useRef, useEffect } from 'react';

const AudioVisualizer = ({ analyser, isRecording }) => {
    const canvasRef = useRef(null);
    const animationRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Handle High DPI displays
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        ctx.lineWidth = 2;
        ctx.strokeStyle = '#4A7C59'; // Park Sage
        ctx.fillStyle = '#F0F4F8'; // Bg

        const draw = () => {
            if (!analyser) return;

            const bufferLength = analyser.fftSize;
            const dataArray = new Uint8Array(bufferLength);
            analyser.getByteTimeDomainData(dataArray);

            ctx.clearRect(0, 0, rect.width, rect.height);

            if (!isRecording) {
                // Draw flat line
                ctx.beginPath();
                ctx.moveTo(0, rect.height / 2);
                ctx.lineTo(rect.width, rect.height / 2);
                ctx.stroke();
                return;
            }

            ctx.beginPath();
            const sliceWidth = rect.width * 1.0 / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * rect.height / 2;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }

                x += sliceWidth;
            }

            ctx.lineTo(canvas.width, rect.height / 2);
            ctx.stroke();

            animationRef.current = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [analyser, isRecording]);

    return (
        <canvas
            ref={canvasRef}
            className="w-full h-48 bg-gray-50 rounded-xl border border-gray-200 shadow-inner"
        />
    );
};

export default AudioVisualizer;
