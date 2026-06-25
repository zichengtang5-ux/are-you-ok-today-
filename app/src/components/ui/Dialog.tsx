import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing, FontSizes, FontWeights, Shadows } from '@/theme';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  variant?: 'default' | 'danger' | 'warm';
}

const confirmColorMap = {
  default: Colors.primary,
  danger: Colors.danger,
  warm: Colors.warm,
};

export function Dialog({ visible, title, message, confirmText = '确认', cancelText = '取消', onConfirm, onCancel, variant = 'default' }: Props) {
  const confirmColor = confirmColorMap[variant];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            {onCancel && (
              <Pressable onPress={onCancel} style={[styles.btn, styles.cancelBtn]}>
                <Text style={styles.cancelText}>{cancelText}</Text>
              </Pressable>
            )}
            <Pressable onPress={onConfirm} style={[styles.btn, { backgroundColor: confirmColor }]}>
              <Text style={styles.confirmText}>{confirmText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    width: '100%',
    ...Shadows.lg,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: FontSizes.base,
    color: Colors.gray600,
    lineHeight: 22,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'flex-end',
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: Colors.gray100,
  },
  cancelText: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    color: Colors.gray600,
  },
  confirmText: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    color: Colors.white,
  },
});
