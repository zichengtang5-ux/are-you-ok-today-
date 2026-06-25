import { View, Text, ScrollView, Pressable, Linking, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Card, Button } from '@/components/ui';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';

interface ActionItemProps {
  emoji: string;
  label: string;
  detail?: string;
  actionLabel: string;
  actionColor?: string;
  onPress: () => void;
}

function ActionItem({ emoji, label, detail, actionLabel, actionColor = Colors.primary, onPress }: ActionItemProps) {
  return (
    <View style={styles.actionItem}>
      <View style={styles.actionInfo}>
        <Text style={styles.actionEmoji}>{emoji}</Text>
        <View style={styles.actionText}>
          <Text style={styles.actionLabel}>{label}</Text>
          {detail && <Text style={styles.actionDetail}>{detail}</Text>}
        </View>
      </View>
      <Pressable
        onPress={onPress}
        style={[styles.actionButton, { borderColor: actionColor }]}
      >
        <Text style={[styles.actionButtonText, { color: actionColor }]}>
          {actionLabel}
        </Text>
      </Pressable>
    </View>
  );
}

export default function AlertHelpScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← 返回</Text>
        </Pressable>
        <Text style={styles.title}>需要帮助</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Danger banner */}
        <Card variant="danger" style={styles.banner}>
          <Text style={styles.bannerText}>
            🚨 联系不上小李，请按照以下建议行动
          </Text>
        </Card>

        {/* Action list */}
        <Card style={styles.actionCard}>
          <ActionItem
            emoji="📞"
            label="拨打小李电话"
            detail="138****5678"
            actionLabel="拨号 →"
            onPress={() => Linking.openURL('tel:13800005678')}
          />

          <ActionItem
            emoji="🚑"
            label="拨打 120 急救"
            detail="小李地址：XX市XX区XX路XX号"
            actionLabel="拨号 →"
            actionColor={Colors.danger}
            onPress={() => Linking.openURL('tel:120')}
          />

          <ActionItem
            emoji="👥"
            label="联系其他联系人"
            detail="免费版仅支持 1 位联系人"
            actionLabel="升级 →"
            actionColor={Colors.warm}
            onPress={() => {}}
          />

          <ActionItem
            emoji="🏠"
            label="查看小李最近地址"
            detail="如已获取位置信息"
            actionLabel="查看 →"
            onPress={() => {}}
          />
        </Card>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          目前暂不支持自动拨打120，如需紧急救援请手动拨打
        </Text>

        {/* Back button */}
        <Button
          variant="ghost"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          返回告警页
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray50,
  },
  header: {
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    marginBottom: Spacing.sm,
  },
  backText: {
    fontSize: FontSizes.base,
    color: Colors.primary,
    fontWeight: FontWeights.medium,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  banner: {
    marginBottom: Spacing.sm,
  },
  bannerText: {
    fontSize: FontSizes.base,
    color: Colors.dangerDark,
    fontWeight: FontWeights.semibold,
  },
  actionCard: {
    gap: Spacing.md,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  actionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.sm,
  },
  actionEmoji: {
    fontSize: 24,
  },
  actionText: {
    flex: 1,
  },
  actionLabel: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    color: Colors.gray900,
  },
  actionDetail: {
    fontSize: FontSizes.sm,
    color: Colors.gray500,
    marginTop: 2,
  },
  actionButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
  },
  disclaimer: {
    fontSize: FontSizes.sm,
    color: Colors.gray500,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  backBtn: {
    marginTop: Spacing.md,
  },
});
