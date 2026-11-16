import { Component } from "react";

// Catches a crash in any page so the user sees a way out instead of a blank screen.
// App.jsx gives it a `key` of the current path, so moving to another page resets it.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Page crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="container detail">
        <div className="empty empty--tall" role="alert">
          <p className="stamp stamp--big" aria-hidden="true">Torn page</p>
          <h1 className="empty__title">Something went wrong on this page.</h1>
          <p className="muted">Your data is safe. Try again, or head back to the start.</p>
          <div className="hero__actions hero__actions--center">
            <button type="button" className="btn btn--ink" onClick={() => window.location.reload()}>
              Try again
            </button>
            <a href="/" className="btn btn--ghost">Go home</a>
          </div>
        </div>
      </div>
    );
  }
}
