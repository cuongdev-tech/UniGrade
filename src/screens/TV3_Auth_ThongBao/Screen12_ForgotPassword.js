import React from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { COLORS } from "../../constants/themeAndData";

export default function Screen12_ForgotPassword({ onNavigate }) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.authScroll}>
        <TouchableOpacity onPress={() => onNavigate && onNavigate(1)} style={{ alignSelf: "flex-start", marginBottom: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.green }}>
            ⬅ Quay lại Đăng nhập
          </Text>
        </TouchableOpacity>

        <View style={[styles.logoBox, { backgroundColor: COLORS.greenLight, borderWidth: 1.5, borderColor: COLORS.green }]}>
          <Text style={{ fontSize: 28 }}>🔐</Text>
        </View>
        <Text style={styles.authTitle}>Quên Mật Khẩu</Text>
        <Text style={styles.authSub}>Nhập Email sinh viên và tạo mật khẩu mới</Text>

        <View style={[styles.card, { borderColor: COLORS.green, borderWidth: 1.5 }]}>
          <Text style={styles.label}>Email sinh viên đã đăng ký *</Text>
          <TextInput style={styles.input} defaultValue="sinhvien@student.edu.vn" keyboardType="email-address" />

          <Text style={styles.label}>Nhập mật khẩu mới *</Text>
          <TextInput style={styles.input} defaultValue="12345678" secureTextEntry />

          <Text style={styles.label}>Nhập lại mật khẩu mới *</Text>
          <TextInput style={styles.input} defaultValue="12345678" secureTextEntry />

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: COLORS.green, marginTop: 10 }]}
            onPress={() => onNavigate && onNavigate(1)}
          >
            <Text style={styles.primaryBtnText}>Cập nhật mật khẩu</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.cardCenter} onPress={() => onNavigate && onNavigate(1)}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.green }}>
            ⬅ Đã nhớ mật khẩu? Quay lại Đăng nhập
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  authScroll: { padding: 20, justifyContent: 'center', flexGrow: 1 },
  bodyPadding: { padding: 16, paddingBottom: 36 },
  logoBox: {
    width: 60, height: 60, borderRadius: 16, backgroundColor: COLORS.green,
    alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  logoBoxSmall: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: COLORS.white, fontSize: 26, fontWeight: '800' },
  authTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textDark, textAlign: 'center' },
  authSub: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', marginBottom: 18 },
  screenTitle: { fontSize: 19, fontWeight: '800', color: COLORS.textDark, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textDark, marginVertical: 8 },
  heroBlueCard: { backgroundColor: COLORS.blue, padding: 16, borderRadius: 16, marginBottom: 14 },
  heroSub: { color: '#DBEAFE', fontSize: 11, fontWeight: '500' },
  heroBig: { color: COLORS.white, fontSize: 28, fontWeight: '800', marginVertical: 2 },
  card: {
    backgroundColor: COLORS.white, padding: 14, borderRadius: 16, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  cardCenter: {
    backgroundColor: COLORS.white, padding: 12, borderRadius: 14, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center',
  },
  offlineBanner: {
    backgroundColor: COLORS.greenLight, borderColor: COLORS.green, borderWidth: 1,
    padding: 12, borderRadius: 14,
  },
  cardHeader: { fontSize: 14, fontWeight: '800', color: COLORS.textDark, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textDark, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10, backgroundColor: COLORS.bg, fontSize: 13,
  },
  searchBar: {
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10, fontSize: 12,
  },
  primaryBtn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  secondaryBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  smallBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  primaryBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 13 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowGap: { flexDirection: 'row', gap: 8 },
  itemTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textDark },
  itemSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 3 },
  badgeBlue: { backgroundColor: COLORS.blueLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeBlueText: { color: COLORS.blue, fontWeight: '800', fontSize: 11 },
  badgePurple: { backgroundColor: COLORS.purpleLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgePurpleText: { color: COLORS.purple, fontWeight: '800', fontSize: 11 },
  badgeGreen: { backgroundColor: COLORS.greenLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeGreenText: { color: COLORS.green, fontWeight: '800', fontSize: 11 },
  badgeAmber: { backgroundColor: COLORS.amberLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeAmberText: { color: COLORS.amber, fontWeight: '800', fontSize: 10 },
  badgeRed: { backgroundColor: COLORS.dangerLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeRedText: { color: COLORS.danger, fontWeight: '800', fontSize: 11 },
  badgeGray: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeGrayText: { color: COLORS.textMuted, fontWeight: '700', fontSize: 11 },
  chipActive: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  chipActiveText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  chipGray: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center' },
  chipGrayText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700' },
  chartBox: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end',
    backgroundColor: COLORS.bg, padding: 12, borderRadius: 12, height: 110, marginTop: 6,
  },
  gradeGrid4: {
    flexDirection: 'row', backgroundColor: COLORS.bg, borderRadius: 10, paddingVertical: 8, marginTop: 8,
  },
  gradeCol: { flex: 1, alignItems: 'center' },
  gradeLabel: { fontSize: 10, color: COLORS.textMuted, marginBottom: 2 },
  gradeVal: { fontSize: 12, fontWeight: '800', color: COLORS.textDark },
  weightBox: {
    flex: 1, backgroundColor: COLORS.purpleLight, borderColor: COLORS.purple, borderWidth: 1,
    borderRadius: 10, paddingVertical: 8, alignItems: 'center',
  },
  weightVal: { fontSize: 12, fontWeight: '800', color: COLORS.purple },
  resultBox: {
    backgroundColor: COLORS.purpleLight, borderColor: COLORS.purple, borderWidth: 1.5,
    borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 12,
  },
  bottomTab: {
    flexDirection: 'row', height: 58, backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.border, alignItems: 'center',
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 11, fontWeight: '800', color: COLORS.textMuted },
});