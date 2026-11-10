// src/mockups/LockScreenNotification.js
//
// MOCKUP giao diện thông báo trên màn hình khóa điện thoại.
// - ĐÂY KHÔNG PHẢI màn hình trong app.
// - Không được import vào luồng điều hướng 12 màn hình chính.
// - Trên thiết bị thật, phần này do Android/iOS tự hiển thị từ notification
//   (title + body) khi dùng expo-notifications; app không cần vẽ lại.
//
// Dùng để tham khảo thiết kế / chèn vào báo cáo / demo riêng nếu cần.

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS } from "../constants/themeAndData";

const DEFAULT_REMINDER = {
  courseName: "Kiểm thử Phần mềm",
  time: "07:30",
  room: "Phòng A204",
  note: "Nhớ mang thẻ sinh viên!",
};

export default function LockScreenNotification({
  reminder = DEFAULT_REMINDER,
  onOpenDetail,
  onClose,
}) {
  const data = { ...DEFAULT_REMINDER, ...reminder };

  return (
    <View style={styles.lockScreen}>
      <View style={styles.lockGlowOne} />
      <View style={styles.lockGlowTwo} />

      <Text style={styles.statusTextLeft}>Viettel 5G</Text>
      <Text style={styles.statusTextRight}>100%</Text>

      <View style={styles.lockHeaderRow}>
        <View style={styles.lockIconWrap}>
          <Text style={styles.lockIcon}>🔒</Text>
        </View>
      </View>

      <Text style={styles.lockDate}>Thứ Ba, 15 tháng 12</Text>
      <Text style={styles.lockTime}>07:00</Text>

      <View style={styles.lockNotificationCard}>
        <View style={styles.notificationCardHeader}>
          <View style={styles.unigradeBadge}>
            <Text style={styles.unigradeBadgeText}>U</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.notificationBrand}>UNIGRADE • NHẮC LỊCH THI</Text>
            <Text style={styles.notificationMeta}>Báo thức tự động</Text>
          </View>
          <View style={styles.nowPill}>
            <Text style={styles.nowPillText}>Bây giờ</Text>
          </View>
        </View>

        <Text style={styles.notificationTitle}>
          🔔 ĐẾN GIỜ THI: {data.courseName} • {data.room}
        </Text>
        <Text style={styles.notificationLine}>
          ⏰ Ca thi bắt đầu lúc {data.time} Sáng (Còn 30 phút)
        </Text>
        <Text style={styles.notificationNote}>📌 Ghi chú: {data.note}</Text>

        <View style={styles.divider} />

        <View style={styles.notificationActions}>
          <TouchableOpacity style={styles.primaryActionBtn} onPress={onOpenDetail}>
            <Text style={styles.primaryActionText}>Mở UniGrade xem chi tiết</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryActionBtn}>
            <Text style={styles.secondaryActionText}>Báo lại 10p</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.lockFooterRow}>
        <View style={styles.lockShortcut}>
          <Text style={styles.lockShortcutText}>🔦</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={{ flex: 1 }}>
          <Text style={styles.lockHint}>Chạm để quay lại UniGrade</Text>
        </TouchableOpacity>
        <View style={styles.lockShortcut}>
          <Text style={styles.lockShortcutText}>📷</Text>
        </View>
      </View>

      <View style={styles.homeIndicator} />
    </View>
  );
}

const styles = StyleSheet.create({
  lockScreen: {
    flex: 1,
    backgroundColor: "#0F172A",
    position: "relative",
    paddingTop: 14,
    paddingHorizontal: 16,
  },
  lockGlowOne: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    top: 120,
    right: -20,
  },
  lockGlowTwo: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    bottom: -20,
    left: -40,
  },
  statusTextLeft: {
    position: "absolute",
    top: 18,
    left: 20,
    color: "#F8FAFC",
    fontSize: 12,
    fontWeight: "600",
  },
  statusTextRight: {
    position: "absolute",
    top: 18,
    right: 20,
    color: "#F8FAFC",
    fontSize: 12,
    fontWeight: "600",
  },
  lockHeaderRow: { alignItems: "center", marginTop: 44, marginBottom: 8 },
  lockIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  lockIcon: { fontSize: 15 },
  lockDate: {
    textAlign: "center",
    color: "#CBD5E1",
    fontSize: 14,
    marginBottom: 8,
  },
  lockTime: {
    textAlign: "center",
    color: "#FFFFFF",
    fontSize: 68,
    fontWeight: "600",
    lineHeight: 72,
  },
  lockNotificationCard: {
    marginTop: 32,
    backgroundColor: "#FFFFFF",
    borderColor: "#10B981",
    borderWidth: 2,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  notificationCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  unigradeBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  unigradeBadgeText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  notificationBrand: { color: "#10B981", fontSize: 11, fontWeight: "700" },
  notificationMeta: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "500",
    marginTop: 2,
  },
  nowPill: {
    backgroundColor: "#FEF3C7",
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  nowPillText: { color: "#D97706", fontSize: 10, fontWeight: "700" },
  notificationTitle: {
    color: "#0F172A",
    fontSize: 12.5,
    fontWeight: "700",
    marginBottom: 8,
  },
  notificationLine: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 4,
  },
  notificationNote: { color: "#D97706", fontSize: 12, fontWeight: "500" },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginTop: 12,
    marginBottom: 12,
  },
  notificationActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  primaryActionBtn: {
    flex: 1,
    backgroundColor: COLORS.green,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryActionText: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },
  secondaryActionBtn: {
    width: 114,
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryActionText: { color: "#475569", fontWeight: "700", fontSize: 11 },
  lockFooterRow: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  lockShortcut: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  lockShortcutText: { fontSize: 18 },
  lockHint: {
    color: "#94A3B8",
    fontSize: 11.5,
    textAlign: "center",
    flex: 1,
  },
  homeIndicator: {
    position: "absolute",
    left: "50%",
    marginLeft: -67,
    bottom: 8,
    width: 134,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
});
