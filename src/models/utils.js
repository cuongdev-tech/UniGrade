// Hàm dùng chung cho các model khi đọc dữ liệu Firestore.
// Firestore là NoSQL: mỗi document có thể dùng tên field khác nhau,
// nên các model đọc theo danh sách ưu tiên (alias) để tương thích dữ liệu cũ.

export const firstValue = (data, keys, fallback = null) => {
  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null && data[key] !== '') return data[key];
  }
  return fallback;
};

export const numericValue = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
