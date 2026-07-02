import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Button, Card, StreakBadge, Dialog } from '@/components/ui';
import { useStore } from '@/store/useStore';
import { replyApi, alertApi } from '@/services/api.types';
import { reportError } from '@/services/errorReporter';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';
import type { ReplyStatus } from '@/types';

const statusConfig: Record<ReplyStatus, { illustration: string; title: string; subtitle?: string }> = {
  idle: {
    illustration: '☀️',
    title: '今天天气不错',
  },
  waiting: {
    illustration: '🌙',
    title: '今天还好吗？',
  },
  replied: {
    illustration: '☺️',
    title: '今天已回复',
    subtitle: '妈妈知道你今天平安',
  },
  grace: {
    illustration: '💭',
    title: '还没回复，有点担心...',
    subtitle: '看到消息回一下？',
  },
  alert: {
    illustration: '🚨',
    title: '已通知联系人',
    subtitle: '你的联系人正在确认你的安全',
  },
  paused: {
    illustration: '⏸️',
    title: '守护已暂停',
    subtitle: '点击恢复守护',
  },
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
  const { todayStatus, streak, reminder, activeAlert, reply, undoReply, setTodayStatus, setReminder, setStreak, setActiveAlert } = useStore();
  const config = statusConfig[todayStatus];

  const [showUndoDialog, setShowUndoDialog] = useState(false);
  const [undoCountdown, setUndoCountdown] = useState(30);
  const [showUndoButton, setShowUndoButton] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch reply status when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      replyApi.getStatus().then((data) => {
        if (cancelled) return;
        setTodayStatus(data.status as ReplyStatus);
        if (data.reminderConfig) {
          setReminder({
            startTime: data.reminderConfig.startTime,
            endTime: data.reminderConfig.endTime,
            gracePeriodMin: data.reminderConfig.gracePeriodMin,
          });
        }
        if (data.monthlyStats) {
          setStreak(data.monthlyStats.repliedDays);
        }
        if (data.status === 'alert') {
          alertApi.getActive().then((alertData) => {
            if (!cancelled && alertData) {
              setActiveAlert({
                id: alertData.id,
                triggeredAt: alertData.triggeredAt,
                status: 'active',
                lastReplyAt: alertData.lastReplyAt,
                contactsNotified: alertData.contactsNotified,
                smsRounds: alertData.smsRounds,
                timeline: alertData.timeline,
              });
            }
          }).catch((e) => reportError(e, { scope: 'home.loadActiveAlert' }));
        } else {
          setActiveAlert(null);
        }
      }).catch((e) => reportError(e, { scope: 'home.loadStatus' }));
      return () => { cancelled = true; };
    }, [setTodayStatus, setReminder, setStreak, setActiveAlert]),
  );

  // Undo countdown effect
  useEffect(() => {
    if (todayStatus === 'replied') {
      setShowUndoButton(true);
      setUndoCountdown(30);

      undoTimerRef.current = setInterval(() => {
        setUndoCountdown((prev) => {
          if (prev <= 1) {
            if (undoTimerRef.current) {
              clearInterval(undoTimerRef.current);
            }
            setShowUndoButton(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (undoTimerRef.current) {
          clearInterval(undoTimerRef.current);
        }
      };
    }
  }, [todayStatus]);

  const handleReply = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const result = await replyApi.reply();
      reply(); // update local store
      setTodayStatus(result.guardStatus as ReplyStatus);
    } catch (err: any) {
      const message = err.response?.data?.message || '回复失败，请重试';
      reportError(err, { scope: 'home.reply', message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUndo = () => {
    setShowUndoDialog(true);
  };

  const confirmUndo = async () => {
    setShowUndoDialog(false);
    try {
      const result = await replyApi.undoReply();
      undoReply(); // update local store
      setTodayStatus(result.guardStatus as ReplyStatus);
      setShowUndoButton(false);
    } catch (err: any) {
      const message = err.response?.data?.message || '撤回失败';
      reportError(err, { scope: 'home.undoReply', message });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })} · {getGreeting()}</Text>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.illustration}>{config.illustration}</Text>
          <Text style={styles.title}>{config.title}</Text>
          {todayStatus === 'idle'
            ? <Text style={styles.subtitle}>今晚 {reminder.endTime} 会收到提醒</Text>
            : config.subtitle && <Text style={styles.subtitle}>{config.subtitle}</Text>
          }
        </View>

        {/* Streak */}
        <StreakBadge count={streak} />

        {/* Reminder time */}
        {todayStatus === 'waiting' && (
          <Card style={styles.reminderCard}>
            <Text style={styles.reminderText}>
              提醒时间：{reminder.startTime} - {reminder.endTime}
            </Text>
          </Card>
        )}

        {/* Grace period countdown */}
        {todayStatus === 'grace' && (
          <Card variant="warm" style={styles.graceCard}>
            <Text style={styles.graceTitle}>距离通知联系人还有</Text>
            <Text style={styles.graceTimer}>29:42</Text>
            <Text style={styles.graceHint}>回复后不会通知联系人</Text>
          </Card>
        )}

        {/* Alert status */}
        {todayStatus === 'alert' && activeAlert && (
          <Card variant="danger" style={styles.alertCard}>
            <Text style={styles.alertText}>
              {activeAlert.lastReplyAt
                ? `最后回复：${new Date(activeAlert.lastReplyAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                : '今天尚未回复'}
            </Text>
            <Text style={styles.alertContacts}>
              已通知：{activeAlert.contactsNotified.map((c) => c.name).join('、')}
            </Text>
          </Card>
        )}

        {/* Confirm button */}
        {(todayStatus === 'waiting' || todayStatus === 'grace' || todayStatus === 'alert') && (
          <View style={styles.buttonContainer}>
            <Pressable
              onPress={handleReply}
              disabled={actionLoading}
              style={({ pressed }) => [
                styles.confirmButton,
                pressed && styles.confirmButtonPressed,
                actionLoading && styles.confirmButtonDisabled,
              ]}
            >
              <Text style={styles.confirmButtonText}>
                {actionLoading ? '处理中...' : '今天还好 ✓'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Replied state with undo */}
        {todayStatus === 'replied' && (
          <>
            <Card style={styles.repliedCard}>
              <Text style={styles.nextReminder}>明天 {reminder.endTime} 再见</Text>
            </Card>

            {showUndoButton && (
              <Button
                variant="ghost"
                size="sm"
                onPress={handleUndo}
                style={styles.undoButton}
              >
                {`撤回回复${undoCountdown > 0 ? ` (${undoCountdown}s)` : ''}`}
              </Button>
            )}
          </>
        )}

        {/* Quick action shortcuts */}
        <View style={styles.quickRow}>
          <Pressable
            onPress={() => router.push('/guardian')}
            style={styles.quickBtn}
          >
            <Text style={styles.quickIcon}>👨‍👩‍👧</Text>
            <Text style={styles.quickLabel}>守护中心</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/help/emergency')}
            style={[styles.quickBtn, styles.quickBtnDanger]}
          >
            <Text style={styles.quickIcon}>🆘</Text>
            <Text style={[styles.quickLabel, styles.quickLabelDanger]}>紧急求助</Text>
          </Pressable>
        </View>

        {/* Settings link */}
        <Pressable onPress={() => router.push('/settings')} style={styles.settingsLink}>
          <Text style={styles.settingsText}>设置</Text>
        </Pressable>

        {/* Undo confirmation dialog */}
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
  container: {
    flex: 1,
    backgroundColor: Colors.gray50,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  greeting: {
    fontSize: FontSizes.sm,
    color: Colors.gray600,
    fontWeight: FontWeights.medium,
  },
  hero: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  illustration: {
    fontSize: 80,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSizes.base,
    color: Colors.gray600,
    textAlign: 'center',
  },
  reminderCard: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  reminderText: {
    fontSize: FontSizes.base,
    color: Colors.gray700,
    fontWeight: FontWeights.medium,
  },
  graceCard: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  graceTitle: {
    fontSize: FontSizes.base,
    color: Colors.warmDark,
    fontWeight: FontWeights.semibold,
    marginBottom: Spacing.sm,
  },
  graceTimer: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    color: Colors.warmDark,
    marginBottom: Spacing.xs,
  },
  graceHint: {
    fontSize: FontSizes.sm,
    color: Colors.warmDark,
  },
  alertCard: {
    marginTop: Spacing.md,
    alignItems: 'center',
  },
  alertText: {
    fontSize: FontSizes.base,
    color: Colors.gray700,
    marginBottom: Spacing.sm,
  },
  alertContacts: {
    fontSize: FontSizes.sm,
    color: Colors.gray600,
  },
  buttonContainer: {
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  confirmButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  confirmButtonPressed: {
    transform: [{ scale: 0.93 }],
    backgroundColor: Colors.primaryDark,
  },
  confirmButtonDisabled: {
    opacity: 0.65,
  },
  confirmButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.white,
    textAlign: 'center',
  },
  repliedCard: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  nextReminder: {
    fontSize: FontSizes.base,
    color: Colors.gray700,
    fontWeight: FontWeights.medium,
  },
  undoButton: {
    alignSelf: 'center',
    marginTop: Spacing.md,
  },
  settingsLink: {
    alignSelf: 'center',
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  settingsText: {
    fontSize: FontSizes.sm,
    color: Colors.gray600,
    textDecorationLine: 'underline',
  },
  quickRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryLight,
  },
  quickBtnDanger: {
    backgroundColor: Colors.dangerLight,
  },
  quickIcon: {
    fontSize: 20,
  },
  quickLabel: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.primaryDark,
  },
  quickLabelDanger: {
    color: Colors.dangerDark,
  },
});
