import { Component } from "react";

// One render throw anywhere below this boundary would otherwise unmount the
// whole app (public board included) with no way back — this keeps the shell
// alive and gives the visitor a Reload button.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error: error || new Error("Unknown error") };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled error while rendering:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-lg p-6 text-center space-y-3">
          <h1 className="text-lg font-semibold text-gray-900">Something went wrong</h1>
          <p className="text-sm text-gray-600">This page could not be displayed. Reloading usually fixes it.</p>
          <p className="text-xs text-danger break-words">{this.state.error.message || "Unknown error"}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-[44px] px-6 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
