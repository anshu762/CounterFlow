import { Component } from 'react';
import ErrorState from './ErrorState';

class Boundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('UI error:', error);
  }

  componentDidUpdate(prev) {
    // Leaving the broken page (resetKey = pathname) clears the error.
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorState
          title="This page hit a problem"
          message="Something unexpected happened while showing this page. Your data is safe."
          onRetry={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}

// Exported as a function component so React Fast Refresh and the lint rule stay happy.
export default function ErrorBoundary({ resetKey, children }) {
  return <Boundary resetKey={resetKey}>{children}</Boundary>;
}