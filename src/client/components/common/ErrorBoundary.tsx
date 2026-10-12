import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Непредвиденная ошибка интерфейса',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    if (!import.meta.env.PROD) {
      console.error('[ErrorBoundary]', error, info);
    }
  }

  handleReload = (): void => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            padding: '2rem',
            margin: '2rem auto',
            maxWidth: '520px',
            borderRadius: '12px',
            border: '1px solid var(--border, #e5e7eb)',
            backgroundColor: 'var(--card, #ffffff)',
            color: 'var(--foreground, #1f2937)',
            textAlign: 'center',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.06)',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            {this.props.fallbackTitle || 'Что-то пошло не так'}
          </h2>
          <p style={{ fontSize: '0.92rem', color: 'var(--muted-foreground, #6b7280)', marginBottom: '1rem' }}>
            Возникла ошибка при отображении раздела. Ваши финансовые данные в безопасности.
          </p>
          {this.state.errorMessage && (
            <pre
              style={{
                fontSize: '0.78rem',
                padding: '0.75rem',
                borderRadius: '8px',
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                overflowX: 'auto',
                marginBottom: '1.25rem',
              }}
            >
              {this.state.errorMessage}
            </pre>
          )}
          <button
            type="button"
            onClick={this.handleReload}
            className="btn btn-primary"
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Обновить страницу
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
