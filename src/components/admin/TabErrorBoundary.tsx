import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  tabName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class TabErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error(`[TabErrorBoundary] Error in "${this.props.tabName}" tab:`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center p-8">
          <div className="p-4 rounded-2xl bg-destructive/10">
            <AlertTriangle className="w-10 h-10 text-destructive" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-1">
              Something went wrong{this.props.tabName ? ` in ${this.props.tabName}` : ""}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {this.state.error?.message || "An unexpected error occurred. Try refreshing this panel."}
            </p>
          </div>
          <Button
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={() => this.setState({ hasError: false, error: undefined })}
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
