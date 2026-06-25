import React from 'react';
import { TextInput, View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Colors, Radius, Spacing, FontSizes, FontWeights } from '@/theme';

interface Props {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  keyboardType?: 'default' | 'phone-pad' | 'numeric' | 'email-address';
  maxLength?: number;
  editable?: boolean;
  style?: ViewStyle;
}

export function Input({ label, value, onChangeText, placeholder, error, keyboardType, maxLength, editable = true, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        maxLength={maxLength}
        editable={editable}
        style={[
          styles.input,
          error && styles.inputError,
          !editable && styles.inputDisabled,
        ]}
        placeholderTextColor={Colors.gray400}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    color: Colors.gray700,
    marginBottom: Spacing.xs,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.gray300,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: FontSizes.base,
    color: Colors.gray900,
    backgroundColor: Colors.white,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  inputDisabled: {
    backgroundColor: Colors.gray100,
    color: Colors.gray500,
  },
  error: {
    fontSize: FontSizes.xs,
    color: Colors.danger,
    marginTop: Spacing.xs,
  },
});
