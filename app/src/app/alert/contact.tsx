import { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Button, Card, Banner, LoadingState, ErrorState } from '@/components/ui';
import { alertApi, type ActiveAlertResponse } from '@/services/api.types';
import { Colors, FontSizes, FontWeights, Spacing } from '@/theme';

function maskPhone(phone: string): string {
  if (phone.length >= 7) {
    return phone.slice(0, 3) + '****' + phone.slice(-4);
  }
  return phone;
}

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoString;
  }
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
  } catch {
    return '';
  }
}

export default function AlertContactScreen() {
  const router = useRouter();
  const { contactId } = useLocalSearchParams<{ contactId?: string }>();

  const [alert, setAlert] = useState<ActiveAlertResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setError('');

      alertApi.getActive()
        .then((data) => {
          if (!cancelled) {
            setAlert(data);
            if (!data) {
              setError('当前没有活跃告警');
            }
          }
        })
        .catch(() => {
          if (!cancelled) setError('获取告警信息失败');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      return () => { cancelled = true; };
    }, []),
  );

  const handleConfirmSafe = async () => {
    if (!alert || !contactId) return;

    setConfirming(true);
    try {
      const result = await alertApi.confirm(alert.id, contactId);
      router.push({
        pathname: '/alert/confirm',
        params: {
          alertId: alert.id,
          resolvedAt: result.alert.resolvedAt,
        },
      });
    } catch (err: any) {
      const message = err.response?.data?.message || '确认失败，请重试';
      setError(message);
    } finally {
      setConfirming(false);
    }
  };

  const handleNeedHelp = () => {
    if (!alert) return;
    router.push({
      pathname: '/alert/help',
      params: { alertId: alert.id, contactId: contactId ?? '' },
    });
  };

  if (loading) {
    return <LoadingState message="获取告警信息..." />;
  }

  if (error && !alert) {
    return (
      <SafeAreaView style={styles.container}>
        <ErrorState message={error} onRetry={() => router.back()} />
      </SafeAreaView>
    );
  }

  if (!alert) return null;

  const lastReplyDate = formatDate(alert.lastReplyAt);
  const lastReplyTime = formatTime(alert.lastReplyAt);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.contextLabel}>联系人视角 · 安全确认</Text>
        </View>

        {/* Notification card */}
        <Card variant="danger" style={styles.notificationCard}>
          <Text style={styles.appName}>今天还好 · 安全提醒</Text>
          <Text style={styles.alertMessage}>对方今天没有回复平安</Text>
          <Text style={styles.alertDetail}>
            最后回复时间：{lastReplyDate} {lastReplyTime}
          </Text>
        </Card>

        {/* Alert status banner */}
        <Banner variant="danger">
          {`告警状态 · 已通知 ${alert.contactsNotified.length} 位联系人`}
        </Banner>

        {/* Notified contacts */}
        <Card style={styles.contactsCard}>
          {alert.contactsNotified.map((contact) => (
            <View key={contact.id} style={styles.contactRow}>
              <Text style={styles.contactName}>{contact.name}</Text>
              <Text style={styles.contactPhone}>{maskPhone(contact.phone)}</Text>
            </View>
          ))}
        </Card>

        {/* Timeline */}
        {alert.timeline.length > 0 && (
          <Card title="告警时间线" style={styles.timelineCard}>
            <View style={styles.timeline}>
              {alert.timeline.map((item, index) => (
                <View key={index} style={styles.timelineItem}>
                  <View style={[styles.dot, item.isCurrent && styles.dotCurrent]} />
                  <Text style={styles.timelineTime}>{item.time}</Text>
                  <Text style={[styles.timelineAction, item.isCurrent && styles.timelineCurrent]}>
                    {item.action}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* SMS rounds info */}
        {alert.smsRounds > 0 && (
          <Card variant="warm" style={styles.countdownCard}>
            <Text style={styles.countdownLabel}>已发送 {alert.smsRounds} 轮通知</Text>
            <Text style={styles.countdownHint}>请尽快确认对方安全</Text>
          </Card>
        )}

        {/* Error message */}
        {error && (
          <Banner variant="danger">{error}</Banner>
        )}

        {/* Action buttons */}
        <View style={styles.actions}>
          <Button
            variant="primary"
            size="lg"
            onPress={handleConfirmSafe}
            loading={confirming}
            disabled={!contactId}
          >
            已联系，TA没事 ✓
          </Button>
          <Button
            variant="outline"
            size="lg"
            onPress={handleNeedHelp}
            disabled={!contactId}
          >
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
  contactsCard: {
    gap: Spacing.sm,
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  contactName: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    color: Colors.gray900,
  },
  contactPhone: {
    fontSize: FontSizes.sm,
    color: Colors.gray500,
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
  countdownHint: {
    fontSize: FontSizes.sm,
    color: Colors.warmDark,
  },
  actions: {
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
});
