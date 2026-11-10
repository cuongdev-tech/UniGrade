// src/components/NotificationShade.js
//
// Mô phỏng thanh thông báo của hệ điều hành (notification shade).
// - Người dùng vuốt từ mép trên màn hình xuống để mở.
// - Bấm vào thông báo -> mở Màn 13 (Chi tiết thông báo nhắc thi).
// - Vuốt lên / chạm ra ngoài / bấm nút đóng để tắt shade.
//
// Đây chỉ là lớp mô phỏng phục vụ demo/test. Trên thiết bị thật,
// Android/iOS sẽ hiển thị notification thật từ expo-notifications.

import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { COLORS } from "../constants/themeAndData";

const CLOSED_OFFSET = -440;

export default function NotificationShade({ visible, reminder, onOpen, onClose }) {
  const slide = useRef(new Animated.Value(CLOSED_OFFSET)).current;
  const [rendered, setRendered] = useState(visible);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      slide.setValue(CLOSED_OFFSET);
      Animated.timing(slide, {
        toValue: 0,
        duration: 220,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    } else {
      Animated.timing(slide, {
        toValue: CLOSED_OFFSET,
        duration: 200,
        useNativeDriver: Platform.OS !== "web",
      }).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [visible, slide]);

  const closePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6,
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < -30) onClose();
      },
    })
  ).current;

  if (!rendered || !reminder) return null;

  const data = reminder || {};
  const courseName = data.courseName;
  const room = data.room;
  const time = data.time;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <Animated.View style={[styles.panel, { transform: [{ translateY: slide }] }]}>
        <View {...closePan.panHandlers}>
          <View style={styles.statusRow}>
            <Text style={styles.statusTextLight}>09:41</Text>
            <View style={styles.statusRight}>
              <Text style={styles.statusTextLight}>5G</Text>
              <Ionicons name="cellular" size={12} color="#E2E8F0" />
              <Ionicons name="battery-full" size={14} color="#E2E8F0" />
            </View>
          </View>

          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          <Text style={styles.dateText}>{data.date}</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.notificationCard}
          onPress={onOpen}
        >
          <View style={styles.notificationHeader}>
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
            🔔 ĐẾN GIỜ THI: {courseName} • {room}
          </Text>
          <Text style={styles.notificationLine}>
            ⏰ Ca thi bắt đầu lúc {time} Sáng (Còn 30 phút)
          </Text>
          {!!data.note && <Text style={styles.notificationNote}>📌 Ghi chú: {data.note}</Text>}

          <View style={styles.divider} />

          <View style={styles.notificationActions}>
            <TouchableOpacity style={styles.primaryActionBtn} onPress={onOpen}>
              <Text style={styles.primaryActionText}>Mở UniGrade xem chi tiết</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionBtn} onPress={onClose}>
              <Text style={styles.secondaryActionText}>Báo lại 10p</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="chevron-up" size={16} color="#CBD5E1" />
          <Text style={styles.closeText}>Vuốt lên hoặc chạm ra ngoài để đóng</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "box-none",
    zIndex: 999,
    elevation: 999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 6, 23, 0.55)",
  },
  panel: {
    backgroundColor: "#0B1220",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  statusRight: { flexDirection: "row", alignItems: "center", gap: 5 },
  statusTextLight: { color: "#E2E8F0", fontSize: 12, fontWeight: "600" },
  handleWrap: { alignItems: "center", paddingVertical: 10 },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  dateText: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 10,
  },
  notificationCard: {
    backgroundColor: "#FFFFFF",
    borderColor: COLORS.green,
    borderWidth: 2,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  unigradeBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.green,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  unigradeBadgeText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  notificationBrand: { color: COLORS.green, fontSize: 11, fontWeight: "700" },
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
    width: 110,
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryActionText: { color: "#475569", fontWeight: "700", fontSize: 11 },
  closeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingTop: 12,
  },
  closeText: { color: "#94A3B8", fontSize: 10.5, fontWeight: "500" },
});
