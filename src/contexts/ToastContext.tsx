import React, { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `${++idRef.current}`;
    const toast: Toast = { id, message, type };
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// Internal container component
function ToastContainer({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;

  return (
    <>
      {toasts.map((toast) => (
        <View
          key={toast.id}
          style={{
            position: 'absolute',
            bottom: 40 + (toasts.indexOf(toast) * 56),
            left: 16,
            right: 16,
            zIndex: 9999,
            elevation: 10,
          }}
          pointerEvents="none"
        >
          <View
            style={{
              backgroundColor:
                toast.type === 'success'
                  ? '#34C759'
                  : toast.type === 'error'
                    ? '#FF3B30'
                    : '#007AFF',
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
            }}
          >
            <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600', flex: 1 }}>
              {toast.message}
            </Text>
          </View>
        </View>
      ))}
    </>
  );
}

// Need View/Text imported here since this file is self-contained
import { View, Text } from 'react-native';
