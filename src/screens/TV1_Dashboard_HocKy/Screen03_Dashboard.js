import React, { useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
} from "react-native";
import { COLORS, SEMESTERS_DATA, COURSES_DATA, EXAMS_DATA } from "../../constants/themeAndData";

const Screen03Dashboard = () => {
  const [search, setSearch] = useState("");
  const [selectedTab, setSelectedTab] = useState("Tổng quan");

  const chips = ["Tổng quan", "Học kỳ", "Môn học", "Kết quả"];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <ScrollView contentContainerStyle={styles.bodyPadding}>
        <Text style={styles.screenTitle}>Dashboard Học kỳ</Text>

        <View style={styles.heroBlueCard}>
          <Text style={styles.heroSub}>Điểm trung bình</Text>
          <Text style={styles.heroBig}>8.7</Text>
          <Text style={styles.heroSub}>+0.3 so với kỳ trước</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Tổng quan</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm kiếm môn học..."
            style={styles.searchBar}
          />

          <View style={styles.rowGap}>
            {chips.map((chip) => {
              const active = chip === selectedTab;
              return (
                <TouchableOpacity
                  key={chip}
                  onPress={() => setSelectedTab(chip)}
                  style={active ? { ...styles.chipActive, backgroundColor: COLORS.blue } : styles.chipGray}
                >
                  <Text style={active ? styles.chipActiveText : styles.chipGrayText}>{chip}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardHeader}>Kết quả học tập</Text>
            <View style={styles.badgeBlue}><Text style={styles.badgeBlueText}>Đạt</Text></View>
          </View>

          <View style={styles.chartBox}>
            {[62, 76, 90, 88, 82].map((value, index) => (
              <View key={index} style={{ height: value, width: 26, backgroundColor: index === 2 ? COLORS.blue : COLORS.border, borderRadius: 8 }} />
            ))}
          </View>

          <View style={styles.gradeGrid4}>
            <View style={styles.gradeCol}>
              <Text style={styles.gradeLabel}>A</Text>
              <Text style={styles.gradeVal}>4</Text>
            </View>
            <View style={styles.gradeCol}>
              <Text style={styles.gradeLabel}>B+</Text>
              <Text style={styles.gradeVal}>3</Text>
            </View>
            <View style={styles.gradeCol}>
              <Text style={styles.gradeLabel}>B</Text>
              <Text style={styles.gradeVal}>5</Text>
            </View>
            <View style={styles.gradeCol}>
              <Text style={styles.gradeLabel}>C</Text>
              <Text style={styles.gradeVal}>2</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Môn học đang học</Text>
          {COURSES_DATA.slice(0, 3).map((course) => (
            <View key={course.id} style={[styles.card, { marginBottom: 10 }]}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.itemTitle}>{course.name}</Text>
                  <Text style={styles.itemSub}>{course.code} • {course.credits} tín chỉ</Text>
                </View>
                <View style={styles.badgePurple}><Text style={styles.badgePurpleText}>{course.grade || "B+"}</Text></View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Kỳ thi sắp tới</Text>
          {EXAMS_DATA.slice(0, 2).map((exam) => (
            <View key={exam.id} style={[styles.card, { marginBottom: 10 }]}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.itemTitle}>{exam.name}</Text>
                  <Text style={styles.itemSub}>{exam.date}</Text>
                </View>
                <View style={styles.badgeAmber}><Text style={styles.badgeAmberText}>{exam.status}</Text></View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Screen03Dashboard;

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
