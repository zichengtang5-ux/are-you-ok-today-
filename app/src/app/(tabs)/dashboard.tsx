import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Button } from '@/components/ui';
import { useStore } from '@/store/useStore';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';

export default function DashboardScreen() {
  const { guardians } = useStore();
  const guardian = guardians[0];

  if (!guardian) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>👨‍👩‍👧</Text>
          <Text style={styles.emptyTitle}>还没有守护的家人</Text>
          <Text style={styles.emptyText}>为家人开通守护，随时查看平安状态</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Guardian info */}
        <View style={styles.header}>
          <Text style={styles.title}>关怀看板</Text>
          <View style={styles.profile}>
            <Text style={styles.avatar}>👵</Text>
            <View>
              <Text style={styles.name}>{guardian.wardName}的守护</Text>
              <Text style={styles.detail}>
                提醒时间 {guardian.reminderConfig.startTime}-{guardian.reminderConfig.endTime}
              </Text>
            </View>
            <View style={[styles.statusTag, guardian.status === 'replied' ? styles.statusOk : styles.statusAlert]}>
              <Text style={styles.statusText}>{guardian.status === 'replied' ? '正常' : '未确认'}</Text>
            </View>
          </View>
        </View>

        {/* Calendar */}
        <Card title="平安日历">
          <Text style={styles.calendarLabel}>最近 7 天</Text>
          <View style={styles.calendarGrid}>
            {['一', '二', '三', '四', '五', '六', '日'].map((d) => (
              <Text key={d} style={styles.weekday}>{d}</Text>
            ))}
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <View
                key={i}
                style={[
                  styles.dayCell,
                  i <= 5 ? styles.dayOk : styles.dayMiss,
                  i === 7 && styles.dayToday,
                ]}
              >
                <Text style={styles.dayNumber}>{18 + i - 1}</Text>
              </View>
            ))}
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendOk]} />
              <Text style={styles.legendText}>已回复</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendMiss]} />
              <Text style={styles.legendText}>未回复</Text>
            </View>
          </View>
        </Card>

        {/* Stats */}
        <Card title="统计数据" style={styles.statsCard}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>最后回复</Text>
            <Text style={styles.statValue}>{guardian.lastReplyAt}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>连续平安</Text>
            <Text style={styles.statValue}>{guardian.streak} 天</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>6月18日</Text>
            <View style={styles.eventTag}>
              <Text style={styles.eventText}>妈妈未回复，你代确认了</Text>
            </View>
          </View>
        </Card>

        {/* Proxy confirm */}
        {guardian.status !== 'replied' && (
          <Button variant="primary" onPress={() => {}}>
            代确认「TA没事」
          </Button>
        )}

        {/* Upgrade hint */}
        <Card variant="warm" style={styles.upgradeCard}>
          <Text style={styles.upgradeTitle}>升级守护版</Text>
          <Text style={styles.upgradeText}>
            查看完整 7 天平安日历，获取更详细的关怀数据
          </Text>
          <Button variant="warm" size="sm" onPress={() => {}}>
            升级守护版
          </Button>
        </Card>
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
    gap: Spacing.lg,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSizes.base,
    color: Colors.gray600,
    textAlign: 'center',
  },
  header: {
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
    marginBottom: Spacing.md,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  avatar: {
    fontSize: 32,
  },
  name: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    color: Colors.gray900,
  },
  detail: {
    fontSize: FontSizes.sm,
    color: Colors.gray600,
    marginTop: 2,
  },
  statusTag: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusOk: {
    backgroundColor: Colors.primaryLight,
  },
  statusAlert: {
    backgroundColor: Colors.warmLight,
  },
  statusText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
    color: Colors.primaryDark,
  },
  calendarLabel: {
    fontSize: FontSizes.sm,
    color: Colors.gray600,
    marginBottom: Spacing.md,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Spacing.md,
  },
  weekday: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: FontSizes.xs,
    color: Colors.gray500,
    marginBottom: Spacing.sm,
  },
  dayCell: {
    width: '14.28%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
  },
  dayOk: {
    backgroundColor: Colors.primaryLight,
  },
  dayMiss: {
    backgroundColor: Colors.dangerLight,
  },
  dayToday: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  dayNumber: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.gray800,
  },
  legend: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendOk: {
    backgroundColor: Colors.primaryLight,
  },
  legendMiss: {
    backgroundColor: Colors.dangerLight,
  },
  legendText: {
    fontSize: FontSizes.xs,
    color: Colors.gray600,
  },
  statsCard: {
    gap: Spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  statLabel: {
    fontSize: FontSizes.base,
    color: Colors.gray600,
  },
  statValue: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    color: Colors.gray900,
  },
  eventTag: {
    backgroundColor: Colors.warmLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  eventText: {
    fontSize: FontSizes.sm,
    color: Colors.warmDark,
  },
  upgradeCard: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  upgradeTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.warmDark,
  },
  upgradeText: {
    fontSize: FontSizes.base,
    color: Colors.warmDark,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
});
