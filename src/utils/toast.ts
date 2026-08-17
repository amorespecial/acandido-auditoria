import React from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

class ToastManager {
  private toasts: ToastItem[] = [];
  private listeners: Set<ToastListener> = new Set();

  subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    listener(this.toasts);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener([...this.toasts]));
  }

  show(message: string, type: ToastType = "info", duration: number = 4000) {
    if (!message) return;
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newToast: ToastItem = { id, message, type, duration };
    
    // Limit to max 4 concurrent toasts
    this.toasts = [...this.toasts.slice(-3), newToast];
    this.notify();

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  clear() {
    this.toasts = [];
    this.notify();
  }
}

export const toastManager = new ToastManager();

export const toast = {
  success: (message: string, duration = 4000) => toastManager.show(message, "success", duration),
  error: (message: string, duration = 5000) => toastManager.show(message, "error", duration),
  warning: (message: string, duration = 4500) => toastManager.show(message, "warning", duration),
  info: (message: string, duration = 4000) => toastManager.show(message, "info", duration),
  dismiss: (id: string) => toastManager.dismiss(id),
  clear: () => toastManager.clear(),
};

export const showToast = (message: string, type: ToastType = "info", duration = 4000) => {
  toastManager.show(message, type, duration);
};
