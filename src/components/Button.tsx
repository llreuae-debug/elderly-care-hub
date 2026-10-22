import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  ViewStyle,
} from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'normal' | 'large';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'large',
  loading = false,
  disabled,
  style,
  ...props
}) => {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isOutline = variant === 'outline';
  const isGhost = variant === 'ghost';

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled || loading}
      style={[
        styles.base,
        size === 'large' ? styles.large : styles.normal,
        isPrimary && styles.primary,
        isSecondary && styles.secondary,
        isOutline && styles.outline,
        isGhost && styles.ghost,
        disabled && styles.disabled,
        style as ViewStyle,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: loading }}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#FFFFFF' : '#0E7490'} size="small" />
      ) : (
        <Text
          style={[
            styles.text,
            size === 'large' ? styles.textLarge : styles.textNormal,
            isPrimary && styles.textPrimary,
            isSecondary && styles.textSecondary,
            (isOutline || isGhost) && styles.textOutline,
            disabled && styles.textDisabled,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  large: {
    minHeight: 56,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  normal: {
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  primary: {
    backgroundColor: '#0E7490', // Deep calming teal
  },
  secondary: {
    backgroundColor: '#E0F2FE', // Light soft sky
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#0E7490',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    backgroundColor: '#E2E8F0',
    borderColor: '#CBD5E1',
  },
  text: {
    fontWeight: '700',
    textAlign: 'center',
  },
  textLarge: {
    fontSize: 18,
    lineHeight: 24,
  },
  textNormal: {
    fontSize: 16,
    lineHeight: 22,
  },
  textPrimary: {
    color: '#FFFFFF',
  },
  textSecondary: {
    color: '#0369A1',
  },
  textOutline: {
    color: '#0E7490',
  },
  textDisabled: {
    color: '#94A3B8',
  },
});
