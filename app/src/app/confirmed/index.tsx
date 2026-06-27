import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Card } from '@/components/ui';
import { useStore } from '@/store/useStore';
import { Colors, FontSizes, FontWeights, Spacing } from '@/theme';

export default function ConfirmedScreen() {
  const router = useRouter();
  const { streak, reminder } = useStore();

  const now = new Date();
  const currentDay = now.getDate();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.back();
    }, 2000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        <View style={styles.emoji}>
          <View style={styles.emojiCircle}>
            <View style={styles.eyeLeft} />
            <View style={styles.eyeRight} />
            <View style={styles.mouth} />
          </View>
        </View>

        <Text style={styles.title}>收到，安心了</Text>
        <Text style={styles.subtitle}>已收到你的平安</Text>

        <View style={styles.monthBadge}>
          <Text style={styles.monthBadgeText}>本月平安 {streak}/{currentDay} 天</Text>
        </View>

        <Card style={styles.card}>
          <Text style={styles.cardText}>明天 {reminder.endTime} 再见</Text>
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg },
  emoji: { marginBottom: Spacing.xl },
  emojiCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#FFF9C4',
    alignItems: 'center', justifyContent: 'center',
  },
  eyeLeft: {
    position: 'absolute', left: 20, top: 24,
    width: 6, height: 10, borderRadius: 3,
    backgroundColor: '#F57F17',
  },
  eyeRight: {
    position: 'absolute', right: 20, top: 24,
    width: 6, height: 10, borderRadius: 3,
    backgroundColor: '#F57F17',
  },
  mouth: {
    position: 'absolute', bottom: 18,
    width: 20, height: 10, borderRadius: 10,
    borderBottomWidth: 3, borderBottomColor: '#F57F17',
  },
  title: { fontSize: FontSizes['2xl'], fontWeight: FontWeights.bold, color: Colors.primary, marginBottom: 8 },
  subtitle: { fontSize: FontSizes.base, color: Colors.gray600, marginBottom: Spacing.xl },
  monthBadge: { backgroundColor: Colors.primaryLight, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginBottom: Spacing.xl },
  monthBadgeText: { fontSize: 15, fontWeight: '600', color: Colors.primaryDark },
  card: { alignItems: 'center' },
  cardText: { fontSize: FontSizes.base, color: Colors.gray600, fontWeight: FontWeights.medium },
});
