import { useState, useRef, useCallback } from 'react';

/**
 * Hook to manage Web Serial API connection and data parsing.
 * 
 * firmware expectation:
 * 115200 baud
 * CSV: Timestamp, AccelX, AccelY, AccelZ, GyroX, GyroY, GyroZ, FSR
 */
const useSerialConnection = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState(null);
    const portRef = useRef(null);
    const readerRef = useRef(null);
    const keepReadingRef = useRef(false);

    const connect = useCallback(async (onData) => {
        if (!navigator.serial) {
            setError("Web Serial API not supported in this browser.");
            return;
        }

        try {
            const port = await navigator.serial.requestPort();
            await port.open({ baudRate: 115200 });

            portRef.current = port;
            setIsConnected(true);
            setError(null);
            keepReadingRef.current = true;

            // Start reading loop
            readLoop(port, onData);
        } catch (err) {
            console.error("Serial Connection Error:", err);
            setError(err.message || "Failed to connect.");
            setIsConnected(false);
        }
    }, []);

    const disconnect = useCallback(async () => {
        keepReadingRef.current = false;
        if (readerRef.current) {
            try {
                await readerRef.current.cancel();
            } catch (e) {
                console.error("Error cancelling reader:", e);
            }
        }

        if (portRef.current) {
            try {
                await portRef.current.close();
            } catch (e) {
                console.error("Error closing port:", e);
            }
            portRef.current = null;
        }
        setIsConnected(false);
    }, []);

    const readLoop = async (port, onData) => {
        const textDecoder = new TextDecoderStream();
        const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
        const reader = textDecoder.readable.getReader();
        readerRef.current = reader;

        let buffer = '';

        try {
            while (keepReadingRef.current) {
                const { value, done } = await reader.read();
                if (done) {
                    break;
                }
                if (value) {
                    buffer += value;
                    const lines = buffer.split('\n');
                    buffer = lines.pop();

                    for (const line of lines) {
                        const cleanLine = line.trim();
                        console.log("Raw:", cleanLine);
                        if (cleanLine) {
                            const parsed = parseLine(cleanLine);
                            if (parsed) {
                                console.log("Parsed:", parsed);
                                onData(parsed);
                            } else {
                                console.warn("Parse Fail:", cleanLine);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Read Loop Error:", error);
            setError("Connection lost.");
            setIsConnected(false);
        } finally {
            reader.releaseLock();
        }
    };

    const parseLine = (line) => {
        try {
            const parts = line.split(',');
            if (parts.length === 8) {
                return {
                    timestamp: parseInt(parts[0], 10),
                    accel: {
                        x: parseFloat(parts[1]),
                        y: parseFloat(parts[2]),
                        z: parseFloat(parts[3])
                    },
                    gyro: {
                        x: parseFloat(parts[4]),
                        y: parseFloat(parts[5]),
                        z: parseFloat(parts[6])
                    },
                    fsr: intOrFloat(parts[7])
                };
            }
            return null;
        } catch (e) {
            return null; // Ignore malformed lines
        }
    };

    const intOrFloat = (val) => {
        const parsed = parseFloat(val);
        return isNaN(parsed) ? 0 : parsed;
    }

    return { connect, disconnect, isConnected, error };
};

export default useSerialConnection;
