import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS, COURSES_DATA, EXAMS_DATA, SEMESTERS_DATA } from "../constants/themeAndData";

const FIELD_CONFIG = {
  login: [
    { key: "email", label: "Email", placeholder: "name@example.com" },
    { key: "password", label: "Mật khẩu", placeholder: "Nhập mật khẩu", secure: true },
  ],
  register: [
    { key: "name", label: "Họ và tên", placeholder: "Nguyễn Văn A" },
    { key: "email", label: "Email", placeholder: "name@example.com" },
    { key: "password", label: "Mật khẩu", placeholder: "Tối thiểu 8 ký tự", secure: true },
    { key: "confirmPassword", label: "Nhập lại mật khẩu", placeholder: "Nhập lại mật khẩu", secure: true },
  ],
  addCourse: [
    { key: "name", label: "Tên môn học", placeholder: "Ví dụ: Lập trình di động" },
    { key: "code", label: "Mã môn học", placeholder: "Ví dụ: MOB101" },
    { key: "credits", label: "Số tín chỉ", placeholder: "3", keyboardType: "numeric" },
  ],
  editGrade: [
    { key: "name", label: "Tên môn học", placeholder: "Lập trình di động" },
    { key: "grade", label: "Điểm tổng kết", placeholder: "8.5", keyboardType: "decimal-pad" },
  ],
  addExam: [
    { key: "name", label: "Tên kỳ thi", placeholder: "Tên môn học hoặc kỳ thi" },
    { key: "date", label: "Ngày thi", placeholder: "DD/MM/YYYY" },
    { key: "time", label: "Giờ thi", placeholder: "08:00" },
    { key: "location", label: "Địa điểm", placeholder: "Phòng thi" },
  ],
};

const SCREEN_CONTENT = {
  login: {
    title: "Đăng nhập",
    subtitle: "Chào mừng bạn quay lại UniGrade",
    action: "Đăng nhập",
    message: "Đã nhận thông tin đăng nhập.",
  },
  register: {
    title: "Tạo tài khoản",
    subtitle: "Đăng ký để quản lý điểm và lịch thi",
    action: "Tạo tài khoản",
    message: "Thông tin đăng ký đã được ghi nhận.",
  },
  semesters: {
    title: "Quản lý học kỳ",
    subtitle: "Theo dõi các học kỳ và tiến độ học tập",
    action: "Tạo học kỳ",
    message: "Đã thêm học kỳ mới.",
  },
  semesterDetail: {
    title: "Chi tiết học kỳ",
    subtitle: "Học kỳ 1 · Năm học 2025–2026",
  },
  courses: {
    title: "Danh sách môn học",
    subtitle: "Tra cứu môn học và điểm số của bạn",
  },
  addCourse: {
    title: "Thêm môn học",
    subtitle: "Nhập thông tin môn học mới",
    action: "Lưu môn học",
    message: "Đã lưu môn học.",
  },
  editGrade: {
    title: "Chỉnh sửa điểm",
    subtitle: "Cập nhật điểm môn học",
    action: "Lưu thay đổi",
    message: "Đã cập nhật điểm.",
  },
  simulator: {
    title: "Mô phỏng điểm số",
    subtitle: "Thử các mức điểm để dự báo kết quả học kỳ",
  },
  profile: {
    title: "Hồ sơ và lịch thi",
    subtitle: "Thông tin cá nhân và các kỳ thi sắp tới",
  },
  addExam: {
    title: "Thêm nhắc nhở kỳ thi",
    subtitle: "Tạo lịch nhắc để không bỏ lỡ ngày thi",
    action: "Lưu nhắc nhở",
    message: "Đã lưu nhắc nhở kỳ thi.",
  },
};

function ActionButton({ label, onPress, secondary = false }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.button, secondary && styles.secondaryButton]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{label}</Text>
    </TouchableOpacity>
  );
}

function DataCard({ title, subtitle, badge, onPress, actionLabel }) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.cardCopy}>
          <Text style={styles.cardTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.muted}>{subtitle}</Text>}
        </View>
        {!!badge && <Text style={styles.badge}>{badge}</Text>}
      </View>
      {!!onPress && (
        <TouchableOpacity accessibilityRole="button" onPress={onPress} style={styles.inlineAction}>
          <Text style={styles.inlineActionText}>{actionLabel || "Xem chi tiết  →"}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function FeatureScreen({ variant, navigate }) {
  const [values, setValues] = useState({
    name: variant === "editGrade" ? COURSES_DATA[0].name : "",
    grade: variant === "editGrade" ? COURSES_DATA[0].grade : "",
    score: "8.5",
  });
  const [message, setMessage] = useState("");
  const config = SCREEN_CONTENT[variant];

  const updateValue = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }));
    setMessage("");
  };

  const renderFields = () => (
    <>
      {FIELD_CONFIG[variant].map((field) => (
        <View key={field.key} style={styles.field}>
          <Text style={styles.label}>{field.label}</Text>
          <TextInput
            accessibilityLabel={field.label}
            autoCapitalize={field.key === "email" ? "none" : "sentences"}
            keyboardType={field.keyboardType || "default"}
            onChangeText={(value) => updateValue(field.key, value)}
            placeholder={field.placeholder}
            secureTextEntry={field.secure}
            style={styles.input}
            value={values[field.key] || ""}
          />
        </View>
      ))}
      <ActionButton label={config.action} onPress={() => setMessage(config.message)} />
      {!!message && <Text style={styles.successMessage}>{message}</Text>}
      {variant === "login" && (
        <TouchableOpacity onPress={() => navigate("register")} style={styles.textLink}>
          <Text style={styles.inlineActionText}>Chưa có tài khoản? Đăng ký</Text>
        </TouchableOpacity>
      )}
      {variant === "register" && (
        <TouchableOpacity onPress={() => navigate("login")} style={styles.textLink}>
          <Text style={styles.inlineActionText}>Đã có tài khoản? Đăng nhập</Text>
        </TouchableOpacity>
      )}
    </>
  );

  const renderContent = () => {
    if (FIELD_CONFIG[variant]) {
      return <View style={styles.card}>{renderFields()}</View>;
    }

    if (variant === "semesters") {
      return (
        <>
          {SEMESTERS_DATA.map((semester) => (
            <DataCard
              key={semester.id}
              title={semester.name}
              subtitle={semester.year}
              badge="Đang học"
              onPress={() => navigate("semesterDetail")}
            />
          ))}
          <ActionButton label={config.action} onPress={() => setMessage(config.message)} />
          {!!message && <Text style={styles.successMessage}>{message}</Text>}
        </>
      );
    }

    if (variant === "semesterDetail") {
      return (
        <>
          <View style={styles.summaryCard}>
            <Text style={styles.muted}>Điểm trung bình học kỳ</Text>
            <Text style={styles.score}>8.4 / 10</Text>
            <Text style={styles.muted}>Đã hoàn thành 15 tín chỉ</Text>
          </View>
          {COURSES_DATA.map((course) => (
            <DataCard
              key={course.id}
              title={course.name}
              subtitle={`${course.code} · ${course.credits} tín chỉ`}
              badge={course.grade}
            />
          ))}
        </>
      );
    }

    if (variant === "courses") {
      return (
        <>
          <ActionButton label="+ Thêm môn học" onPress={() => navigate("addCourse")} />
          {COURSES_DATA.map((course) => (
            <DataCard
              key={course.id}
              title={course.name}
              subtitle={`${course.code} · ${course.credits} tín chỉ`}
              badge={course.grade}
              actionLabel="Chỉnh sửa điểm  →"
              onPress={() => navigate("editGrade")}
            />
          ))}
        </>
      );
    }

    if (variant === "simulator") {
      const score = Number(values.score) || 0;
      const projected = Math.min(10, Math.max(0, score)).toFixed(1);
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Điểm dự kiến môn học</Text>
          <Text style={styles.muted}>Nhập điểm bạn muốn thử (0–10)</Text>
          <TextInput
            accessibilityLabel="Điểm dự kiến"
            keyboardType="decimal-pad"
            onChangeText={(value) => updateValue("score", value)}
            style={styles.input}
            value={values.score}
          />
          <View style={styles.resultCard}>
            <Text style={styles.muted}>Điểm mô phỏng</Text>
            <Text style={styles.score}>{projected}</Text>
            <Text style={styles.muted}>GPA học kỳ dự kiến: {((8.4 + Number(projected)) / 2).toFixed(2)}</Text>
          </View>
        </View>
      );
    }

    if (variant === "profile") {
      return (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nguyễn Minh Anh</Text>
            <Text style={styles.muted}>Sinh viên · minh.anh@example.com</Text>
            <Text style={styles.muted}>Mã sinh viên: 20240001</Text>
          </View>
          <Text style={styles.sectionTitle}>Kỳ thi sắp tới</Text>
          {EXAMS_DATA.map((exam) => (
            <DataCard
              key={exam.id}
              title={exam.name}
              subtitle={exam.date}
              badge={exam.status}
            />
          ))}
          <ActionButton label="+ Thêm nhắc nhở kỳ thi" onPress={() => navigate("addExam")} />
        </>
      );
    }

    return null;
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{config.title}</Text>
      <Text style={styles.subtitle}>{config.subtitle}</Text>
      {renderContent()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 36, width: "100%", maxWidth: 760, alignSelf: "center" },
  title: { color: COLORS.textDark, fontSize: 24, fontWeight: "800", marginBottom: 5 },
  subtitle: { color: COLORS.textMuted, fontSize: 14, marginBottom: 18 },
  card: { backgroundColor: COLORS.white, borderColor: COLORS.border, borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardCopy: { flex: 1 },
  cardTitle: { color: COLORS.textDark, fontSize: 16, fontWeight: "700" },
  muted: { color: COLORS.textMuted, fontSize: 13, marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { color: COLORS.blue, backgroundColor: COLORS.blueLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, fontWeight: "700" },
  inlineAction: { paddingTop: 12, alignSelf: "flex-start" },
  inlineActionText: { color: COLORS.blue, fontWeight: "700" },
  field: { marginBottom: 14 },
  label: { color: COLORS.textDark, fontSize: 13, fontWeight: "700", marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, backgroundColor: COLORS.bg, color: COLORS.textDark, paddingHorizontal: 12, paddingVertical: 11, marginTop: 10 },
  button: { backgroundColor: COLORS.blue, borderRadius: 11, paddingVertical: 13, paddingHorizontal: 16, alignItems: "center", marginBottom: 12 },
  buttonText: { color: COLORS.white, fontWeight: "700" },
  secondaryButton: { backgroundColor: COLORS.blueLight },
  secondaryButtonText: { color: COLORS.blue },
  textLink: { alignItems: "center", paddingVertical: 10 },
  successMessage: { color: COLORS.green, fontWeight: "600", marginTop: 2 },
  summaryCard: { backgroundColor: COLORS.blue, borderRadius: 16, padding: 18, marginBottom: 14 },
  resultCard: { backgroundColor: COLORS.purpleLight, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 12 },
  score: { color: COLORS.textDark, fontSize: 30, fontWeight: "800", marginVertical: 5 },
  sectionTitle: { color: COLORS.textDark, fontSize: 17, fontWeight: "800", marginVertical: 10 },
});
