import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Card } from '@/components/ui';
import { GreenStatusBar } from '@/components/ui/GreenStatusBar';
import { useStore } from '@/store/useStore';
import { contactApi } from '@/services/api.types';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';

export default function EditContactScreen() {
  const router = useRouter();
  const { contacts, subscription, removeContact, addContact } = useStore();
  const isPremium = !!subscription?.isPremium;
  const contact = contacts[0] || null;

  const [name, setName] = useState(contact?.name ?? '');
  const [phone, setPhone] = useState(contact?.phone ?? '');
  const [relation, setRelation] = useState(contact?.relation ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError('请输入联系人姓名'); return; }
    if (phone.length !== 11 || !/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入正确的手机号');
      return;
    }
    setError('');
    setLoading(true);
    try {
      if (contact) {
        await contactApi.update(contact.id, { name, phone, relation: relation || '家人' });
        removeContact(contact.id);
        addContact({ ...contact, name, phone, relation: relation || '家人' });
      } else {
        const newContact = await contactApi.create({ name, phone, relation: relation || '家人' });
        addContact(newContact);
      }
      router.back();
    } catch (err: any) {
      setError(err.response?.data?.message || '保存失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('删除联系人', '确定要删除这位紧急联系人吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          if (!contact) return;
          try {
            await contactApi.delete(contact.id);
            removeContact(contact.id);
            router.back();
          } catch {}
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <GreenStatusBar variant="white" title="编辑紧急联系人" showMascot={false} onBack={() => router.back()} />
      <View style={styles.content}>
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{contact ? '修改联系人' : '设置紧急联系人'}</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>姓名</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={(t) => { setName(t); setError(''); }}
              placeholder="联系人姓名"
              placeholderTextColor={Colors.gray400}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>手机号</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={(t) => { setPhone(t.replace(/\D/g, '')); setError(''); }}
              placeholder="13800138000"
              keyboardType="phone-pad"
              maxLength={11}
              placeholderTextColor={Colors.gray400}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>关系</Text>
            <TextInput
              style={styles.input}
              value={relation}
              onChangeText={(t) => { setRelation(t); setError(''); }}
              placeholder="如：母亲、父亲、朋友"
              placeholderTextColor={Colors.gray400}
            />
          </View>
        </Card>

        {!isPremium && (
          <Card variant="info" style={styles.banner}>
            <Text style={styles.bannerText}>免费版支持 1 位联系人，升级可添加最多 5 位</Text>
          </Card>
        )}

        {!isPremium && (
          <Pressable style={styles.addMoreBtn} onPress={() => router.push('/subscription')}>
            <Text style={styles.addMoreText}>+ 添加更多联系人</Text>
          </Pressable>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button variant="primary" size="lg" onPress={handleSave} loading={loading} style={styles.saveBtn}>
          保存
        </Button>

        {contact && (
          <Pressable style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteText}>删除联系人</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  content: { flex: 1, padding: Spacing.lg, gap: Spacing.lg },
  card: { gap: Spacing.md },
  cardTitle: { fontSize: FontSizes.base, color: Colors.gray700, fontWeight: FontWeights.medium, textAlign: 'center' },
  field: {},
  fieldLabel: { fontSize: FontSizes.sm, color: Colors.gray600, marginBottom: 6, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: Colors.gray300,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: FontSizes.base,
    color: Colors.gray900,
    backgroundColor: Colors.white,
  },
  banner: { alignItems: 'center' },
  bannerText: { fontSize: FontSizes.sm, color: Colors.warmDark, textAlign: 'center' },
  addMoreBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  addMoreText: { fontSize: FontSizes.base, color: Colors.primary, fontWeight: FontWeights.medium },
  errorText: { fontSize: FontSizes.sm, color: Colors.danger, textAlign: 'center' },
  saveBtn: { marginTop: Spacing.sm },
  deleteBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  deleteText: { fontSize: FontSizes.base, color: Colors.danger, fontWeight: FontWeights.medium },
});
