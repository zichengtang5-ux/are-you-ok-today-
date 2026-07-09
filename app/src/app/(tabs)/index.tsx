import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Card } from '@/components/ui';
import { GreenStatusBar } from '@/components/ui/GreenStatusBar';
import { MascotLogo } from '@/components/ui/MascotLogo';
import { useStore } from '@/store/useStore';
import { replyApi, alertApi } from '@/services/api.types';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';
import type { ReplyStatus } from '@/types';

const statusConfig: Record<ReplyStatus, { title: string; subtitle?: string }> = {
  idle: { title: '今天还好吗？' },
  waiting: { title: '今天还好吗？' },
  replied: { title: '今天已回复', subtitle: '已收到你的平安' },
  grace: { title: '还没回复，有点担心...', subtitle: '看到消息回一下？' },
  alert: { title: '你的联系人正在确认你的安全' },
  paused: { title: '守护已暂停', subtitle: '点击恢复守护' },
};

const statusBarVariant: Record<ReplyStatus, 'primary' | 'warn' | 'danger' | 'white'> = {
  idle: 'primary',
  waiting: 'primary',
  replied: 'primary',
  grace: 'warn',
  alert: 'danger',
  paused: 'white',
};

function computeEffectiveStatus(
  backendStatus: string,
  reminderConfig?: { startTime: string; endTime: string },
): ReplyStatus {
  if (backendStatus !== 'idle' || !reminderConfig) return backendStatus as ReplyStatus;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = reminderConfig.startTime.split(':').map(Number);
  const [eh, em] = reminderConfig.endTime.split(':').map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  if (mins >= start && mins < end) return 'waiting';
  return 'idle';
}

export default function HomeScreen() {
  const router = useRouter();
  const { todayStatus, streak, reminder, activeAlert, user, notificationAuthorized, reply, setTodayStatus, setReminder, setStreak, setActiveAlert } = useStore();
  const config = statusConfig[todayStatus];

  const [actionLoading, setActionLoading] = useState(false);
  const [graceCountdown, setGraceCountdown] = useState('--:--');
  const [daysInMonth, setDaysInMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  });

  useEffect(() => {
    if (todayStatus !== 'grace') return;
    const calcRemaining = () => {
      const now = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      const secs = now.getSeconds();
      const [eh, em] = reminder.endTime.split(':').map(Number);
      const deadlineMin = eh * 60 + em + reminder.gracePeriodMin;
      const remainSec = (deadlineMin * 60) - (mins * 60 + secs);
      if (remainSec <= 0) return '00:00';
      const m = Math.floor(remainSec / 60);
      const s = remainSec % 60;
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    setGraceCountdown(calcRemaining());
    const timer = setInterval(() => setGraceCountdown(calcRemaining()), 1000);
    return () => clearInterval(timer);
  }, [todayStatus, reminder.endTime, reminder.gracePeriodMin]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      replyApi.getStatus().then((data) => {
        if (cancelled) return;
        const effectiveStatus = computeEffectiveStatus(data.status, data.reminderConfig ?? undefined);
        setTodayStatus(effectiveStatus);
        if (data.reminderConfig) {
          setReminder({ startTime: data.reminderConfig.startTime, endTime: data.reminderConfig.endTime, gracePeriodMin: data.reminderConfig.gracePeriodMin });
        }
        if (data.monthlyStats) {
          setStreak(data.monthlyStats.repliedDays);
          setDaysInMonth(data.monthlyStats.daysInMonth);
        }
        if (data.status === 'alert') {
          alertApi.getActive().then((alertData) => {
            if (!cancelled && alertData) {
              setActiveAlert({ id: alertData.id, triggeredAt: alertData.triggeredAt, status: 'active', lastReplyAt: alertData.lastReplyAt ?? undefined, contactsNotified: alertData.contactsNotified, timeline: alertData.timeline });
            }
          }).catch(() => {});
        } else { setActiveAlert(null); }
      }).catch(() => {});
      return () => { cancelled = true; };
    }, [setTodayStatus, setReminder, setStreak, setActiveAlert]),
  );

  const handleReply = async () => {
    setActionLoading(true);
    try {
      const result = await replyApi.reply();
      reply();
      setTodayStatus(result.guardStatus as ReplyStatus);
    } catch (err: any) {
      if (err.response?.status === 409) {
        Alert.alert('守护已暂停', err.response?.data?.message || '请先恢复守护再签到', [
          { text: '去恢复', onPress: () => router.push('/settings/pause-settings') },
          { text: '稍后', style: 'cancel' },
        ]);
        return;
      }
      // silently handle other errors
    } finally {
      setActionLoading(false);
    }
  };

  const now = new Date();
  const nickname = user?.nickname ?? '';

  const confirmBtnBg = todayStatus === 'grace' ? Colors.warm : todayStatus === 'alert' ? Colors.danger : Colors.primary;
  const isActive = todayStatus === 'waiting' || todayStatus === 'grace' || todayStatus === 'alert';

  const renderSubtitle = () => {
    if (todayStatus === 'idle') {
      return <Text style={styles.subtitle}>今晚 {reminder.endTime} 会收到提醒</Text>;
    }
    if (todayStatus === 'waiting') {
      return <Text style={styles.subtitle}>提醒时间：{reminder.startTime} - {reminder.endTime}</Text>;
    }
    if (config.subtitle) {
      return <Text style={[styles.subtitle, todayStatus === 'replied' && { color: Colors.primary }]}>{config.subtitle}</Text>;
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <GreenStatusBar variant={statusBarVariant[todayStatus]} title="今天还好" showMascot />
      <View style={styles.content}>
        <Text style={styles.greeting}>
          hello{nickname ? `，${nickname}` : ''}
        </Text>
        <Text style={styles.date}>
          {now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
        </Text>

        <View style={styles.hero}>
          <MascotLogo size="lg" variant={(todayStatus === 'waiting' || todayStatus === 'alert') ? 'double-bar' : 'default'} />
          <Text style={[styles.title, styles.titleBelowIcon, todayStatus === 'replied' && { color: Colors.primary }]}>{config.title}</Text>
          {renderSubtitle()}
          {todayStatus === 'alert' && activeAlert && (
            <Text style={styles.alertMeta}>
              {activeAlert.lastReplyAt ? `最后回复：${new Date(activeAlert.lastReplyAt).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
            </Text>
          )}
        </View>

        {todayStatus === 'alert' && (
          <View style={styles.alertBanner}>
            <Text style={styles.alertBannerText}>已通知联系人 · 等待确认中</Text>
          </View>
        )}

        <View style={styles.monthBadge}>
          <Text style={styles.monthBadgeText}>本月平安 {streak}/{daysInMonth} 天</Text>
        </View>

        {todayStatus !== 'alert' && !notificationAuthorized && (
          <Pressable style={styles.warnBanner} onPress={() => router.push('/onboarding/notification-auth')}>
            <Text style={styles.warnBannerText}>! 消息推送未授权，前往授权</Text>
          </Pressable>
        )}

        {todayStatus === 'grace' && (
          <Card variant="warm" style={styles.graceCard}>
            <Text style={styles.graceTitle}>距离通知联系人还有</Text>
            <Text style={styles.graceTimer}>{graceCountdown}</Text>
            <Text style={styles.graceHint}>回复后不会通知联系人</Text>
          </Card>
        )}

        {isActive && (
          <View style={styles.buttonContainer}>
            <Pressable
              onPress={handleReply}
              disabled={actionLoading}
              accessibilityRole="button"
              accessibilityLabel="今天还好，确认平安"
              accessibilityHint="点击回复今日平安状态"
              style={({ pressed }) => [
                [styles.confirmButton, { backgroundColor: confirmBtnBg }],
                pressed && { transform: [{ scale: 0.93 }], backgroundColor: Colors.primaryDark },
              ]}
            >
              <Text style={styles.confirmButtonText}>今天还好 ✓</Text>
            </Pressable>
            {todayStatus === 'alert' && (
              <Text style={styles.buttonHint}>回复后可解除告警</Text>
            )}
          </View>
        )}

        {todayStatus === 'idle' && (
          <View style={styles.buttonContainer}>
            <View style={[styles.confirmButton, styles.confirmButtonDisabled]}>
              <Text style={[styles.confirmButtonText, styles.confirmButtonTextDisabled]}>
                今晚{'\n'}{reminder.startTime}
              </Text>
            </View>
          </View>
        )}

        {todayStatus === 'replied' && (
          <Card style={styles.repliedCard}>
            <Text style={styles.nextReminder}>明天 {reminder.endTime} 再见</Text>
          </Card>
        )}

        <View style={styles.bottomLinks}>
          <Text style={styles.bottomCombined}>
            <Text onPress={() => router.push('/settings')} accessibilityRole="link" style={styles.bottomLink}>设置</Text>
            <Text style={styles.bottomDivider}>｜</Text>
            <Text onPress={() => router.push('/help/emergency')} accessibilityRole="link" style={[styles.bottomLink, styles.bottomLinkDanger]}>紧急求助</Text>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  content: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  greeting: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
    textAlign: 'center',
  },
  date: {
    fontSize: FontSizes.sm,
    color: Colors.gray500,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: Spacing.lg,
  },
  hero: { alignItems: 'center', marginBottom: Spacing.md },
  title: { fontSize: FontSizes['2xl'], fontWeight: FontWeights.bold, color: Colors.gray900, textAlign: 'center', marginBottom: Spacing.sm },
  titleBelowIcon: { marginTop: Spacing.md },
  subtitle: { fontSize: FontSizes.base, color: Colors.gray600, textAlign: 'center' },
  alertMeta: { fontSize: FontSizes.sm, color: Colors.gray500, textAlign: 'center', marginTop: 4 },
  monthBadge: { alignSelf: 'center', backgroundColor: Colors.primaryLight, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginBottom: Spacing.md },
  monthBadgeText: { fontSize: 13, fontWeight: '600', color: Colors.primaryDark },
  warnBanner: { padding: 12, borderRadius: Radius.sm, backgroundColor: Colors.warmLight, marginBottom: Spacing.md },
  warnBannerText: { fontSize: FontSizes.sm, color: Colors.warmDark, fontWeight: FontWeights.medium, textAlign: 'center' },
  graceCard: { alignItems: 'center', marginTop: Spacing.md },
  graceTitle: { fontSize: FontSizes.base, color: Colors.warmDark, fontWeight: FontWeights.semibold, marginBottom: Spacing.sm },
  graceTimer: { fontSize: 28, fontWeight: FontWeights.bold, color: Colors.warmDark, marginBottom: Spacing.xs },
  graceHint: { fontSize: FontSizes.sm, color: Colors.warmDark },
  alertBanner: { padding: 12, borderRadius: Radius.sm, backgroundColor: Colors.dangerLight, marginBottom: Spacing.md, alignSelf: 'center' },
  alertBannerText: { fontSize: FontSizes.sm, color: Colors.danger, fontWeight: FontWeights.semibold, textAlign: 'center' },
  buttonContainer: { alignItems: 'center', marginTop: Spacing.xl, marginBottom: Spacing.sm },
  confirmButton: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8,
  },
  confirmButtonDisabled: { backgroundColor: Colors.gray300, shadowOpacity: 0 },
  confirmButtonText: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, color: Colors.white, textAlign: 'center' },
  confirmButtonTextDisabled: { color: Colors.gray500 },
  buttonHint: { fontSize: FontSizes.sm, color: Colors.gray500, marginTop: Spacing.md },
  repliedCard: { alignItems: 'center' },
  nextReminder: { fontSize: FontSizes.base, color: Colors.gray700, fontWeight: FontWeights.medium },
  bottomLinks: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  bottomCombined: { textAlign: 'center' },
  bottomLink: { fontSize: FontSizes.sm, color: Colors.gray600 },
  bottomDivider: { fontSize: FontSizes.sm, color: Colors.gray300 },
  bottomLinkDanger: { color: Colors.danger },
});
