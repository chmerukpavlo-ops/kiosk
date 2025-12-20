import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('❌ ErrorBoundary caught error:', error);
    console.error('Error details:', errorInfo);
    console.error('Error stack:', error.stack);
  }

  public render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || '';
      const isExtensionError = errorMessage.includes('solana') || 
                              errorMessage.includes('chrome-extension') ||
                              errorMessage.includes('moz-extension');
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {isExtensionError ? 'Конфлікт з розширенням браузера' : 'Щось пішло не так'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {isExtensionError 
                ? 'Розширення браузера (наприклад, Solana) викликало помилку. Спробуйте вимкнути розширення і перезавантажити сторінку.'
                : 'Вибачте за незручності. Сталася неочікувана помилка.'}
            </p>
            {this.state.error && !isExtensionError && (
              <details className="text-left mb-4">
                <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Деталі помилки
                </summary>
                <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-auto text-gray-900 dark:text-gray-100">
                  {this.state.error.toString()}
                  {this.state.error.stack && (
                    <>
                      {'\n\nStack trace:\n'}
                      {this.state.error.stack}
                    </>
                  )}
                </pre>
              </details>
            )}
            <div className="space-y-2">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = '/';
                }}
                className="btn btn-primary w-full"
              >
                Повернутися на головну
              </button>
              <button
                onClick={() => window.location.reload()}
                className="btn btn-secondary w-full"
              >
                Перезавантажити сторінку
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

