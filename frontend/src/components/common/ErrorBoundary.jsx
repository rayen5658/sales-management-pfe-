import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div style={{
            padding: '1rem',
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            borderRadius: '8px',
            color: 'var(--danger-text)',
            fontSize: '0.85rem',
          }}>
            ⚠ This component could not load.
            <br />
            <code style={{ fontSize: '0.75rem', opacity: 0.7 }}>
              {this.state.error?.message}
            </code>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
