import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card } from '@/components/ui';
import { GreenStatusBar } from '@/components/ui/GreenStatusBar';
import { MascotLogo } from '@/components/ui/MascotLogo';
import { useStore } from '@/store/useStore';
import { formatReminderTimeOfDay, formatReminderWindow } from '@/utils/reminderWindow';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';
import { useRouter } from 'expo-router';
import { syncWatchContext } from '@/services/watchSync';

export default function CompleteScreen() {
  const router = useRouter();
  const { reminder, contacts, notificationAuthorized } = useStore();

  const handleEnter = () => {
    useStore.getState().completeOnboarding();
    void syncWatchContext({ isOnboarded: true }).catch(() => {});
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <GreenStatusBar variant="primary" title="今天还好" showMascot />
      <View style={styles.content}>
        <View style={styles.hero}>
          <MascotLogo size="md" />
          <Text style={styles.title}>守护已开启</Text>
          <Text style={styles.subtitle}>
            每天{formatReminderTimeOfDay(reminder.startTime)}，你会收到“今天还好吗？”
          </Text>
        </View>

        <Card style={styles.previewCard}>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>提醒时间</Text>
            <Text style={styles.previewValue}>
              {formatReminderWindow(reminder.startTime, reminder.endTime)}
            </Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>紧急联系人</Text>
            <Text style={styles.previewValue}>{contacts[0]?.name}</Text>
          </View>
        </Card>

        {notificationAuthorized ? (
          <View style={styles.okBanner}>
            <Text style={styles.okBannerText}>[OK] 通知已授权，每日提醒将准时送达</Text>
          </View>
        ) : (
          <View style={styles.warnBanner}>
            <Text style={styles.warnBannerText}>! 消息推送未授权，可能无法收到提醒</Text>
          </View>
        )}

        <Button variant="primary" size="lg" onPress={handleEnter} style={styles.button}>
          进入首页
        </Button>
        {!notificationAuthorized && (
          <Button variant="ghost" size="md" onPress={() => router.replace('/onboarding/notification-auth')} style={styles.authBackBtn}>
            返回授权通知
          </Button>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  content: { flex: 1, padding: Spacing.lg, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: Spacing.xl },
  title: { fontSize: FontSizes['2xl'], fontWeight: FontWeights.bold, color: Colors.gray900, marginTop: Spacing.md },
  subtitle: { fontSize: FontSizes.base, color: Colors.gray600, textAlign: 'center', marginTop: Spacing.sm },
  previewCard: { marginBottom: Spacing.lg, gap: Spacing.sm },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  previewLabel: { fontSize: FontSizes.base, color: Colors.gray600 },
  previewValue: { fontSize: FontSizes.base, fontWeight: FontWeights.semibold, color: Colors.gray900 },
  okBanner: {
    padding: 12,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryLight,
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  okBannerText: { fontSize: FontSizes.sm, color: Colors.primaryDark, fontWeight: FontWeights.medium },
  warnBanner: {
    padding: 12,
    borderRadius: Radius.sm,
    backgroundColor: Colors.warmLight,
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  warnBannerText: { fontSize: FontSizes.sm, color: Colors.warmDark, fontWeight: FontWeights.medium },
  button: { marginTop: 'auto' },
  authBackBtn: { marginTop: Spacing.md },
});
