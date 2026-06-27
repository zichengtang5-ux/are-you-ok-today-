import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Card, Dialog } from '@/components/ui';
import { GreenStatusBar } from '@/components/ui/GreenStatusBar';
import { StatusIllustration } from '@/components/ui/StatusIllustration';
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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '凌晨好';
  if (hour < 12) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

export default function HomeScreen() {
  const router = useRouter();
  const { todayStatus, streak, reminder, activeAlert, user, notificationAuthorized, reply, undoReply, setTodayStatus, setReminder, setStreak, setActiveAlert } = useStore();
  const config = statusConfig[todayStatus];

  const [showUndoDialog, setShowUndoDialog] = useState(false);
  const [undoCountdown, setUndoCountdown] = useState(30);
  const [showUndoButton, setShowUndoButton] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      replyApi.getStatus().then((data) => {
        if (cancelled) return;
        setTodayStatus(data.status as ReplyStatus);
        if (data.reminderConfig) {
          setReminder({ startTime: data.reminderConfig.startTime, endTime: data.reminderConfig.endTime, gracePeriodMin: data.reminderConfig.gracePeriodMin });
        }
        if (data.monthlyStats) { setStreak(data.monthlyStats.repliedDays); }
        if (data.status === 'alert') {
          alertApi.getActive().then((alertData) => {
            if (!cancelled && alertData) {
              setActiveAlert({ id: alertData.id, triggeredAt: alertData.triggeredAt, status: 'active', lastReplyAt: alertData.lastReplyAt, contactsNotified: alertData.contactsNotified, smsRounds: alertData.smsRounds, timeline: alertData.timeline });
            }
          }).catch(() => {});
        } else { setActiveAlert(null); }
      }).catch(() => {});
      return () => { cancelled = true; };
    }, [setTodayStatus, setReminder, setStreak, setActiveAlert]),
  );

  useEffect(() => {
    if (todayStatus === 'replied') {
      setShowUndoButton(true);
      setUndoCountdown(30);
      undoTimerRef.current = setInterval(() => {
        setUndoCountdown((prev) => {
          if (prev <= 1) { if (undoTimerRef.current) clearInterval(undoTimerRef.current); setShowUndoButton(false); return 0; }
          return prev - 1;
        });
      }, 1000);
      return () => { if (undoTimerRef.current) clearInterval(undoTimerRef.current); };
    }
  }, [todayStatus]);

  const handleReply = async () => {
    setActionLoading(true);
    try {
      const result = await replyApi.reply();
      reply();
      setTodayStatus(result.guardStatus as ReplyStatus);
      router.push('/confirmed');
    } catch (err: any) {
      // silently handle
    } finally {
      setActionLoading(false);
    }
  };

  const confirmUndo = async () => {
    setShowUndoDialog(false);
    try {
      const result = await replyApi.undoReply();
      undoReply();
      setTodayStatus(result.guardStatus as ReplyStatus);
      setShowUndoButton(false);
    } catch (err: any) {}
  };

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
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
          {now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })} · {getGreeting()}{nickname ? `，${nickname}` : ''}
        </Text>

        <View style={styles.hero}>
          <StatusIllustration status={todayStatus} />
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
          <Text style={styles.monthBadgeText}>本月平安 {streak}/{currentDay} 天</Text>
        </View>

        {todayStatus === 'idle' && !notificationAuthorized && (
          <Pressable style={styles.warnBanner} onPress={() => router.push('/onboarding/notification-auth')}>
            <Text style={styles.warnBannerText}>! 消息推送未授权，前往授权</Text>
          </Pressable>
        )}

        {todayStatus === 'grace' && (
          <Card variant="warm" style={styles.graceCard}>
            <Text style={styles.graceTitle}>距离通知联系人还有</Text>
            <Text style={styles.graceTimer}>29:42</Text>
            <Text style={styles.graceHint}>回复后不会通知联系人</Text>
          </Card>
        )}

        {isActive && (
          <View style={styles.buttonContainer}>
            <Pressable
              onPress={handleReply}
              disabled={actionLoading}
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
          <>
            <Card style={styles.repliedCard}>
              <Text style={styles.nextReminder}>明天 {reminder.endTime} 再见</Text>
            </Card>
            {showUndoButton && (
              <Pressable onPress={() => setShowUndoDialog(true)} style={styles.undoBtn}>
                <Text style={styles.undoText}>撤回回复{undoCountdown > 0 ? ` (${undoCountdown}s)` : ''}</Text>
              </Pressable>
            )}
          </>
        )}

        <View style={{ flex: 1 }} />

        <View style={styles.bottomLinks}>
          <Pressable onPress={() => router.push('/(tabs)/settings')}>
            <Text style={styles.bottomLink}>设置</Text>
          </Pressable>
          <Text style={styles.bottomSeparator}> | </Text>
          <Pressable onPress={() => router.push('/help/emergency')}>
            <Text style={[styles.bottomLink, styles.bottomLinkDanger]}>紧急求助</Text>
          </Pressable>
        </View>

        <Dialog
          visible={showUndoDialog}
          title="确定撤回回复吗？"
          message="撤回后，系统会重新进入等待回复状态，超时后可能通知你的联系人。"
          confirmText="撤回回复"
          cancelText="取消"
          variant="warm"
          onConfirm={confirmUndo}
          onCancel={() => setShowUndoDialog(false)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  content: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  greeting: { fontSize: FontSizes.sm, color: Colors.gray600, fontWeight: FontWeights.medium, marginBottom: Spacing.lg },
  hero: { alignItems: 'center', marginBottom: Spacing.lg },
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
  buttonContainer: { alignItems: 'center', marginTop: Spacing.xl, marginBottom: Spacing.lg },
  confirmButton: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8,
  },
  confirmButtonDisabled: { backgroundColor: Colors.gray300, shadowOpacity: 0 },
  confirmButtonText: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, color: Colors.white, textAlign: 'center' },
  confirmButtonTextDisabled: { color: Colors.gray500 },
  buttonHint: { fontSize: FontSizes.sm, color: Colors.gray500, marginTop: Spacing.md },
  repliedCard: { alignItems: 'center', marginTop: Spacing.md },
  nextReminder: { fontSize: FontSizes.base, color: Colors.gray700, fontWeight: FontWeights.medium },
  undoBtn: { alignSelf: 'center', marginTop: Spacing.md, padding: Spacing.sm },
  undoText: { fontSize: FontSizes.sm, color: Colors.gray500 },
  bottomLinks: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: Spacing.lg },
  bottomLink: { fontSize: FontSizes.sm, color: Colors.gray600, padding: 8 },
  bottomLinkDanger: { color: Colors.danger },
  bottomSeparator: { fontSize: FontSizes.sm, color: Colors.gray300 },
});
