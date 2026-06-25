import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Card, Button, Timeline } from '@/components/ui';
import { useStore } from '@/store/useStore';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';
import type { AlertTimelineItem } from '@/types';

const resolvedTimeline: AlertTimelineItem[] = [
  { time: '22:00', action: '系统检测到超时' },
  { time: '22:00', action: '发送关心式提醒给小李' },
  { time: '22:30', action: '小李未回复，触发告警' },
  { time: '22:30', action: '通知联系人（妈妈）' },
  { time: '22:35', action: '妈妈确认：已联系，TA没事' },
];

export default function AlertConfirmScreen() {
  const router = useRouter();

  const handleDone = () => {
    useStore.getState().resolveAlert();
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Back header */}
        <View style={styles.header}>
          <Text style={styles.title}>确认安全</Text>
        </View>

        {/* Success state */}
        <View style={styles.successSection}>
          <Text style={styles.successEmoji}>✅</Text>
          <Text style={styles.successTitle}>告警已解除</Text>
          <Text style={styles.eventDate}>6月24日告警 · 已解除</Text>
          <Text style={styles.resolveDetail}>
            你已确认小李安全 · 处理时间：22:35
          </Text>
        </View>

        {/* Timeline */}
        <Card title="处理记录" style={styles.timelineCard}>
          <Timeline items={resolvedTimeline} />
        </Card>

        {/* Done button */}
        <Button variant="primary" size="lg" onPress={handleDone} style={styles.doneButton}>
          好的
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray50,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
  },
  successSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  successEmoji: {
    fontSize: 56,
    marginBottom: Spacing.sm,
  },
  successTitle: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
  },
  eventDate: {
    fontSize: FontSizes.sm,
    color: Colors.gray500,
  },
  resolveDetail: {
    fontSize: FontSizes.base,
    color: Colors.gray600,
    textAlign: 'center',
  },
  timelineCard: {
    marginBottom: Spacing.xl,
  },
  doneButton: {
    marginTop: 'auto',
  },
});
