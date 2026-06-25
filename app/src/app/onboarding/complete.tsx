import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card } from '@/components/ui';
import { useStore } from '@/store/useStore';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';
import { useRouter } from 'expo-router';

export default function CompleteScreen() {
  const router = useRouter();
  const { reminder, contacts } = useStore();

  const handleEnter = () => {
    useStore.getState().completeOnboarding();
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.illustration}>🎉</Text>
          <Text style={styles.title}>守护已开启</Text>
        </View>

        {/* Preview card */}
        <Card style={styles.previewCard}>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>提醒时间</Text>
            <Text style={styles.previewValue}>
              {reminder.startTime} - {reminder.endTime}
            </Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>紧急联系人</Text>
            <Text style={styles.previewValue}>{contacts[0]?.name}</Text>
          </View>
        </Card>

        {/* Auth status banner */}
        <Card variant="info" style={styles.banner}>
          <Text style={styles.bannerText}>
            今晚 8 点，你会收到第一条"今天还好吗？"
          </Text>
        </Card>

        {/* Enter button */}
        <Button variant="primary" size="lg" onPress={handleEnter} style={styles.button}>
          进入首页
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
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  illustration: {
    fontSize: 80,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
  },
  previewCard: {
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  previewLabel: {
    fontSize: FontSizes.base,
    color: Colors.gray600,
  },
  previewValue: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    color: Colors.gray900,
  },
  banner: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  bannerText: {
    fontSize: FontSizes.base,
    color: Colors.gray700,
    textAlign: 'center',
    fontWeight: FontWeights.medium,
  },
  button: {
    marginTop: 'auto',
  },
});
