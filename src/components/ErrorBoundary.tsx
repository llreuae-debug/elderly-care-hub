import React, { Component, ErrorInfo, ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.icon}>🛡️</Text>
          <Text style={styles.title}>Something unexpected happened</Text>
          <Text style={styles.description}>
            {this.props.fallbackMessage ||
              'We encountered a problem loading this screen. Your data is safe and your care circle remains intact.'}
          </Text>
          {this.state.errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{this.state.errorMessage}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.retryButton}
            onPress={this.handleReset}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Try Again"
          >
            <Text style={styles.retryButtonText}>🔄 Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  icon: {
    fontSize: 54,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    maxWidth: '100%',
    marginBottom: 20,
  },
  errorText: {
    fontSize: 12,
    color: '#991B1B',
    fontFamily: 'monospace',
  },
  retryButton: {
    backgroundColor: '#0E7490',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
