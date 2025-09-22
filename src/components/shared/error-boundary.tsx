/**
 * @fileoverview Error Boundary component with comprehensive logging
 * Catches React errors and provides fallback UI while logging to the monitoring system
 */

'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { logErrorBoundary, logger } from '@/services/loggingService';
import { EventCategory } from '@/types';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    errorId: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });

    // Log the error to our monitoring system
    this.logError(error, errorInfo);
  }

  private async logError(error: Error, errorInfo: ErrorInfo) {
    try {
      // Log to our centralized logging system
      await logErrorBoundary(error, errorInfo, {
        errorId: this.state.errorId,
        retryCount: this.retryCount,
        maxRetries: this.maxRetries,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      });

      // Also log additional context
      await logger.critical(
        'React Error Boundary caught an unhandled error',
        error,
        EventCategory.SYSTEM,
        {
          errorId: this.state.errorId,
          componentStack: errorInfo.componentStack,
          errorBoundary: true,
          retryCount: this.retryCount,
          url: window.location.href,
        }
      );
    } catch (loggingError) {
      // If logging fails, fall back to console
      console.error('Failed to log error to monitoring system:', loggingError);
      console.error('Original error:', error);
      console.error('Error info:', errorInfo);
    }
  }

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null,
      });

      // Log retry attempt
      logger.info('Error boundary retry attempted', EventCategory.SYSTEM, {
        retryCount: this.retryCount,
        maxRetries: this.maxRetries,
        errorId: this.state.errorId,
      });
    }
  };

  private handleGoHome = () => {
    // Reset the error boundary state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });

    // Navigate to home
    window.location.href = '/';
  };

  private handleRefresh = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle className="text-red-600 dark:text-red-400">
                משהו השתבש
              </CardTitle>
              <CardDescription>
                אירעה שגיאה בלתי צפויה. אנו עובדים על פתרון הבעיה.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.props.showDetails && this.state.error && (
                <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-md text-sm">
                  <div className="font-medium mb-1">פרטי השגיאה:</div>
                  <div className="text-gray-600 dark:text-gray-400 font-mono text-xs">
                    {this.state.error.message}
                  </div>
                  {this.state.errorId && (
                    <div className="mt-2 text-xs text-gray-500">
                      ID: {this.state.errorId}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col space-y-2">
                {this.retryCount < this.maxRetries && (
                  <Button onClick={this.handleRetry} className="w-full">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    נסה שוב ({this.maxRetries - this.retryCount} נסיונות נותרו)
                  </Button>
                )}
                
                <Button 
                  onClick={this.handleGoHome} 
                  variant="outline" 
                  className="w-full"
                >
                  <Home className="w-4 h-4 mr-2" />
                  חזור לעמוד הבית
                </Button>
                
                <Button 
                  onClick={this.handleRefresh} 
                  variant="outline" 
                  className="w-full"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  רענן את הדף
                </Button>
              </div>

              <div className="text-xs text-gray-500 text-center">
                אם הבעיה נמשכת, אנא צור קשר עם התמיכה
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for easier use
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Hook for programmatic error reporting
export function useErrorReporting() {
  const reportError = async (error: Error, context?: Record<string, any>) => {
    try {
      await logger.error(
        'Programmatically reported error',
        error,
        EventCategory.SYSTEM,
        {
          reportedProgrammatically: true,
          url: window.location.href,
          timestamp: new Date().toISOString(),
          ...context,
        }
      );
    } catch (loggingError) {
      console.error('Failed to report error:', loggingError);
      console.error('Original error:', error);
    }
  };

  return { reportError };
}

export default ErrorBoundary;
