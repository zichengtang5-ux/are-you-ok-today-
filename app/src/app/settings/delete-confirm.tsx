import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Input, Button } from '@/components/ui';
import { GreenStatusBar } from '@/components/ui/GreenStatusBar';
import { Colors, FontSizes, FontWeights, Spacing } from '@/theme';

export default function DeleteConfirmScreen() {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState('');

  const handleDelete = () => {
    if (confirmText === '确认删除') {
      // TODO: Call API to delete user data
      console.log('Deleting user data...');
      router.replace('/onboarding/login');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <GreenStatusBar variant="white" title="删除数据" showMascot={false} onBack={() => router.back()} />
      <View style={styles.content}>
        <View style={styles.warningSection}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.title}>确定删除所有数据吗？</Text>
          <Text style={styles.description}>
            删除后无法恢复，包括：回复记录、{'\n'}
            联系人信息、守护设置。{'\n'}
            你的紧急联系人将不再收到通知。
          </Text>
        </View>

        <View style={styles.inputSection}>
          <Input
            label='请输入"确认删除"以继续'
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder="确认删除"
          />
        </View>

        <Button
          variant="danger"
          size="lg"
          onPress={handleDelete}
          disabled={confirmText !== '确认删除'}
          style={styles.confirmButton}
        >
          确认删除
        </Button>
        <Button
          variant="ghost"
          size="md"
          onPress={() => router.back()}
        >
          取消
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  content: { flex: 1, padding: Spacing.lg },
  warningSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  warningIcon: { fontSize: 48, marginBottom: Spacing.md },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  description: {
    fontSize: FontSizes.base,
    color: Colors.gray500,
    textAlign: 'center',
    lineHeight: 24,
  },
  inputSection: {
    marginBottom: Spacing.lg,
  },
  confirmButton: {
    marginBottom: Spacing.md,
  },
});
