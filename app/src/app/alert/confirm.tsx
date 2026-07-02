import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Card, Button, Timeline, LoadingState } from '@/components/ui';
import { alertApi } from '@/services/api.types';
import { Colors, FontSizes, FontWeights, Spacing } from '@/theme';
import type { AlertTimelineItem } from '@/types';

function formatDateTime(isoString: string): { date: string; time: string } {
  try {
    const date = new Date(isoString);
    return {
      date: date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }),
      time: date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    };
  } catch {
    return { date: '', time: isoString };
  }
}

export default function AlertConfirmScreen() {
  const router = useRouter();
  const { resolvedAt } = useLocalSearchParams<{ resolvedAt?: string }>();

  const [timeline, setTimeline] = useState<AlertTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    alertApi.getActive()
      .then((data) => {
        if (data?.timeline) {
          const resolved: AlertTimelineItem = {
            time: resolvedAt ? formatDateTime(resolvedAt).time : '',
            action: '联系人确认：已联系，TA没事',
          };
          setTimeline([...data.timeline, resolved]);
        }
      })
      .catch(() => {
        if (resolvedAt) {
          setTimeline([
            { time: formatDateTime(resolvedAt).time, action: '告警已解除' },
          ]);
        }
      })
      .finally(() => setLoading(false));
  }, [resolvedAt]);

  const handleDone = () => {
    router.replace('/(tabs)');
  };

  if (loading) {
    return <LoadingState message="加载处理记录..." />;
  }

  const resolved = resolvedAt ? formatDateTime(resolvedAt) : { date: '今天', time: '' };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>确认安全</Text>
        </View>

        {/* Success state */}
        <View style={styles.successSection}>
          <Text style={styles.successEmoji}>✅</Text>
          <Text style={styles.successTitle}>告警已解除</Text>
          <Text style={styles.eventDate}>{resolved.date}告警 · 已解除</Text>
          {resolved.time && (
            <Text style={styles.resolveDetail}>
              你已确认对方安全 · 处理时间：{resolved.time}
            </Text>
          )}
        </View>

        {/* Timeline */}
        {timeline.length > 0 && (
          <Card title="处理记录" style={styles.timelineCard}>
            <Timeline items={timeline} />
          </Card>
        )}

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
