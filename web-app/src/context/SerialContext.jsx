import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

const SerialContext = createContext();

export const SerialProvider = ({ children }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState(null);
    const portRef = useRef(null);
    const readerRef = useRef(null);
    const keepReadingRef = useRef(false);

    // Subscribers
    const dataHandlerRef = useRef(null);

    const setDataHandler = useCallback((handler) => {
        dataHandlerRef.current = handler;
    }, []);

    const connect = useCallback(async () => {
        if (!navigator.serial) {
            setError("Web Serial API not supported in this browser.");
            return;
        }

        // Prevent multiple connections
        if (portRef.current) {
            console.warn("Already connected.");
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
            readLoop(port);
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
        // Port closing is handled after reader lock release in readLoop
    }, []);

    const readLoop = async (port) => {
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
                        if (cleanLine) {
                            const parsed = parseLine(cleanLine);
                            if (parsed && dataHandlerRef.current) {
                                dataHandlerRef.current(parsed);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Read Loop Error:", error);
            setError("Connection lost.");
        } finally {
            reader.releaseLock();
            try {
                await readableStreamClosed.catch(() => { }); // Catch pipeTo errors
                await port.close();
            } catch (e) {
                console.error("Error closing port:", e);
            }
            portRef.current = null;
            setIsConnected(false);
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
                    fsr: parseFloat(parts[7]) || 0
                };
            }
            return null;
        } catch (e) {
            return null;
        }
    };

    // Auto-cleanup on unmount of the Provider (App close)
    useEffect(() => {
        return () => {
            // Force disconnect if unmounting
            if (portRef.current) {
                disconnect();
            }
        };
    }, []);

    return (
        <SerialContext.Provider value={{ connect, disconnect, isConnected, error, setDataHandler }}>
            {children}
        </SerialContext.Provider>
    );
};

export const useSerialContext = () => useContext(SerialContext);
