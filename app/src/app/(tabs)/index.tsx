import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Card } from '@/components/ui';
import { GreenStatusBar } from '@/components/ui/GreenStatusBar';
import { MascotLogo } from '@/components/ui/MascotLogo';
import { useStore } from '@/store/useStore';
import { replyApi, alertApi, pauseApi } from '@/services/api.types';
import { isOfflineDevSession } from '@/services/devMock';
import { computeEffectiveStatus } from '@/utils/guardStatus';
import { formatNextReminderOccurrence, formatReminderWindow } from '@/utils/reminderWindow';
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

export default function HomeScreen() {
  const router = useRouter();
  const { todayStatus, streak, reminder, activeAlert, user, notificationAuthorized, demoCheckIn, reply, setTodayStatus, setReminder, setStreak, setActiveAlert, clearPauseStatus } = useStore();
  const config = statusConfig[todayStatus];

  const [actionLoading, setActionLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [graceCountdown, setGraceCountdown] = useState('--:--');
  const [graceDeadlineAt, setGraceDeadlineAt] = useState<string | null>(null);
  const [daysInMonth, setDaysInMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  });

  useEffect(() => {
    if (todayStatus !== 'grace') return;
    const calcRemaining = () => {
      const now = new Date();
      let deadline: Date;
      if (graceDeadlineAt) {
        deadline = new Date(graceDeadlineAt);
      } else {
        deadline = new Date(now);
        const [sh, sm] = reminder.startTime.split(':').map(Number);
        const [eh, em] = reminder.endTime.split(':').map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        const nowMin = now.getHours() * 60 + now.getMinutes();
        deadline.setHours(eh, em, 0, 0);
        if (endMin < startMin && nowMin >= startMin) {
          deadline.setDate(deadline.getDate() + 1);
        }
        deadline.setMinutes(deadline.getMinutes() + reminder.gracePeriodMin);
      }
      const remainSec = Math.ceil((deadline.getTime() - now.getTime()) / 1000);
      if (remainSec <= 0) return '00:00';
      const m = Math.floor(remainSec / 60);
      const s = remainSec % 60;
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    const initialTimer = setTimeout(() => setGraceCountdown(calcRemaining()), 0);
    const timer = setInterval(() => setGraceCountdown(calcRemaining()), 1000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(timer);
    };
  }, [todayStatus, graceDeadlineAt, reminder.startTime, reminder.endTime, reminder.gracePeriodMin]);

  useFocusEffect(
    useCallback(() => {
      if (__DEV__ && demoCheckIn) {
        return () => {};
      }
      let cancelled = false;
      replyApi.getStatus().then((data) => {
        if (cancelled) return;
        const effectiveStatus = computeEffectiveStatus(data.status, data.reminderConfig ?? undefined);
        setTodayStatus(effectiveStatus);
        setGraceDeadlineAt(data.graceDeadlineAt ?? null);
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
      }).catch(() => {
        if (!cancelled) {
          Alert.alert('状态同步失败', '暂时无法获取最新守护状态，请检查网络后重试。');
        }
      });
      return () => { cancelled = true; };
    }, [demoCheckIn, setTodayStatus, setReminder, setStreak, setActiveAlert]),
  );

  const handleReply = async () => {
    if (__DEV__ && demoCheckIn) {
      reply();
      setTodayStatus('replied');
      return;
    }
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
      const message = err.response?.data?.message;
      Alert.alert('签到失败', typeof message === 'string' ? message : '请检查网络后重试');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeGuard = async () => {
    if (resumeLoading) return;
    setResumeLoading(true);
    try {
      await pauseApi.resume();
      clearPauseStatus();
    } catch (error: any) {
      if (await isOfflineDevSession()) {
        clearPauseStatus();
        return;
      }
      const message = error.response?.data?.message;
      Alert.alert('恢复失败', typeof message === 'string' ? message : '请检查网络后重试');
    } finally {
      setResumeLoading(false);
    }
  };

  const now = new Date();
  const nickname = user?.nickname ?? '';

  const confirmBtnBg = todayStatus === 'grace' ? Colors.warm : todayStatus === 'alert' ? Colors.danger : Colors.primary;
  const isActive = todayStatus === 'waiting' || todayStatus === 'grace' || todayStatus === 'alert';

  const renderSubtitle = () => {
    if (todayStatus === 'idle') {
      return <Text style={styles.subtitle}>{formatNextReminderOccurrence(reminder.startTime, now)} 会收到提醒</Text>;
    }
    if (todayStatus === 'waiting') {
      return <Text style={styles.subtitle}>提醒时间：{formatReminderWindow(reminder.startTime, reminder.endTime)}</Text>;
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
          <MascotLogo size="xl" variant={(todayStatus === 'waiting' || todayStatus === 'alert') ? 'double-bar' : 'default'} />
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
                下次提醒{'\n'}{reminder.startTime}
              </Text>
            </View>
          </View>
        )}

        {todayStatus === 'replied' && (
          <Card style={styles.repliedCard}>
            <Text style={styles.nextReminder}>下次提醒：{formatNextReminderOccurrence(reminder.startTime, now)}</Text>
          </Card>
        )}

        {todayStatus === 'paused' && (
          <Pressable
            style={({ pressed }) => [
              styles.resumeGuardButton,
              pressed && !resumeLoading && styles.resumeGuardButtonPressed,
            ]}
            onPress={handleResumeGuard}
            disabled={resumeLoading}
            accessibilityRole="button"
            accessibilityLabel="恢复守护"
            accessibilityState={{ busy: resumeLoading, disabled: resumeLoading }}
          >
            {resumeLoading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.resumeGuardButtonText}>恢复守护</Text>
            )}
          </Pressable>
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
    width: 152, height: 152, borderRadius: 76, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 8,
  },
  confirmButtonDisabled: { backgroundColor: Colors.gray300, shadowOpacity: 0 },
  confirmButtonText: { fontSize: 22, fontWeight: FontWeights.bold, color: Colors.white, textAlign: 'center' },
  confirmButtonTextDisabled: { color: Colors.gray500 },
  buttonHint: { fontSize: FontSizes.sm, color: Colors.gray500, marginTop: Spacing.md },
  repliedCard: { alignItems: 'center' },
  resumeGuardButton: {
    alignSelf: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  resumeGuardButtonText: { fontSize: FontSizes.base, color: Colors.white, fontWeight: FontWeights.semibold },
  resumeGuardButtonPressed: { backgroundColor: Colors.primaryDark },
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
