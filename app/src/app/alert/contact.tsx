import { View, Text, ScrollView, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Card, Banner } from '@/components/ui';
import { useStore } from '@/store/useStore';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';

export default function AlertContactScreen() {
  const router = useRouter();
  const { activeAlert } = useStore();

  if (!activeAlert) {
    return null;
  }

  const handleConfirmSafe = () => {
    useStore.getState().resolveAlert();
    router.push('/alert/confirm');
  };

  const handleNeedHelp = () => {
    router.push('/alert/help');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.contextLabel}>联系人视角 · 妈妈收到通知</Text>
        </View>

        {/* Notification card */}
        <Card variant="danger" style={styles.notificationCard}>
          <Text style={styles.appName}>今天还好 · 安全提醒</Text>
          <Text style={styles.alertMessage}>小李今天没有回复平安</Text>
          <Text style={styles.alertDetail}>最后回复时间：昨天 20:15</Text>
        </Card>

        {/* Alert status banner */}
        <Banner variant="danger">
          告警状态 · 等待联系人确认
        </Banner>

        {/* Timeline */}
        <Card title="告警时间线" style={styles.timelineCard}>
          <View style={styles.timeline}>
            <View style={styles.timelineItem}>
              <View style={styles.dot} />
              <Text style={styles.timelineTime}>22:32</Text>
              <Text style={styles.timelineAction}>系统检测到超时</Text>
            </View>
            <View style={styles.timelineItem}>
              <View style={styles.dot} />
              <Text style={styles.timelineTime}>22:32</Text>
              <Text style={styles.timelineAction}>发送关心式提醒给小李</Text>
            </View>
            <View style={styles.timelineItem}>
              <View style={styles.dot} />
              <Text style={styles.timelineTime}>23:02</Text>
              <Text style={styles.timelineAction}>小李未回复，触发告警</Text>
            </View>
            <View style={styles.timelineItem}>
              <View style={[styles.dot, styles.dotCurrent]} />
              <Text style={styles.timelineTime}>23:02</Text>
              <Text style={[styles.timelineAction, styles.timelineCurrent]}>通知联系人（妈妈）</Text>
            </View>
            <View style={styles.timelineItem}>
              <View style={[styles.dot, styles.dotCurrent]} />
              <Text style={styles.timelineTime}>等待中</Text>
              <Text style={[styles.timelineAction, styles.timelineCurrent]}>等待确认中...</Text>
            </View>
          </View>
        </Card>

        {/* Next round countdown */}
        <Card variant="warm" style={styles.countdownCard}>
          <Text style={styles.countdownLabel}>距第二轮通知还有</Text>
          <Text style={styles.countdownTimer}>08:42</Text>
        </Card>

        {/* Action buttons */}
        <View style={styles.actions}>
          <Button variant="primary" size="lg" onPress={handleConfirmSafe}>
            已联系，TA没事 ✓
          </Button>
          <Button variant="outline" size="lg" onPress={handleNeedHelp}>
            联系不上，需要帮助
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray50,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  header: {
    marginBottom: Spacing.sm,
  },
  contextLabel: {
    fontSize: FontSizes.sm,
    color: Colors.gray600,
    fontWeight: FontWeights.medium,
  },
  notificationCard: {
    gap: Spacing.sm,
  },
  appName: {
    fontSize: FontSizes.sm,
    color: Colors.dangerDark,
    fontWeight: FontWeights.medium,
    marginBottom: Spacing.xs,
  },
  alertMessage: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
  },
  alertDetail: {
    fontSize: FontSizes.base,
    color: Colors.gray600,
  },
  timelineCard: {
    gap: Spacing.sm,
  },
  timeline: {
    gap: Spacing.sm,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.gray400,
    marginTop: 6,
  },
  dotCurrent: {
    backgroundColor: Colors.primary,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineTime: {
    fontSize: FontSizes.xs,
    color: Colors.gray500,
    fontWeight: FontWeights.medium,
    width: 50,
  },
  timelineAction: {
    fontSize: FontSizes.sm,
    color: Colors.gray800,
    flex: 1,
  },
  timelineCurrent: {
    fontWeight: FontWeights.semibold,
    color: Colors.primary,
  },
  countdownCard: {
    alignItems: 'center',
  },
  countdownLabel: {
    fontSize: FontSizes.base,
    color: Colors.warmDark,
    fontWeight: FontWeights.semibold,
    marginBottom: Spacing.xs,
  },
  countdownTimer: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    color: Colors.warmDark,
  },
  actions: {
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
});
