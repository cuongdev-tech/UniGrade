import { collection, doc, documentId, getDocsFromServer, query, where } from 'firebase/firestore';
import { addOwnerSuffix } from '../services/courseIdService';

// Các model được ghi ở đây dùng giá trị vô hướng của Firestore.
const firestoreValue = (value) => {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Number.isSafeInteger(value)) return { integerValue: String(value) };
  if (Number.isFinite(value)) return { doubleValue: value };
  throw new Error('Giá trị Firestore không hợp lệ.');
};

const toWrite = ({ reference, data, type }, parent) => {
  const name = `${parent}/${reference.path}`;
  if (type === 'delete') return { delete: name };
  const update = {
    name,
    fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, firestoreValue(value)])),
  };
  if (type === 'create') return { update, currentDocument: { exists: false } };
  return { update, updateMask: { fieldPaths: Object.keys(data) }, currentDocument: { exists: true } };
};

const readOwnedDocument = async (db, name, id, uid) => {
  const result = await getDocsFromServer(query(
    collection(db, name), where('user_id', '==', uid), where(documentId(), '==', id)
  ));
  return result.docs[0];
};

// REST Commit hỗ trợ điều kiện chưa tồn tại, nên phiên tạo sau không thể ghi đè ID đã được giữ.
export async function writeWithCompactIds(db, user, build) {
  const projectId = db.app.options.projectId;
  const parent = `projects/${projectId}/databases/(default)/documents`;
  const collisions = new Set();

  const allocate = async (name, base, existingIds, reuse, reserved) => {
    const knownIds = new Set(existingIds);
    let stem = base;
    let number = 1;
    while (true) {
      const id = number === 1 ? stem : `${stem}_${number}`;
      const reference = doc(db, name, id);
      const collided = collisions.has(reference.path);
      if (reuse || collided) {
        const owned = await readOwnedDocument(db, name, id, user.uid);
        if (owned && reuse?.(owned.data())) return { reference, existing: true };
        if (collided && !owned && stem === base) {
          stem = addOwnerSuffix(base, user.uid);
          number = 1;
          continue;
        }
        if (owned || collided) {
          number += 1;
          continue;
        }
      }
      if (!knownIds.has(id) && !reserved.has(reference.path)) {
        reserved.add(reference.path);
        return { reference, existing: false };
      }
      number += 1;
    }
  };

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const reserved = new Set();
    const { writes, result } = await build((name, base, { existingIds = [], reuse } = {}) =>
      allocate(name, base, existingIds, reuse, reserved)
    );
    if (writes.length === 0) return result;
    const token = await user.getIdToken();
    const response = await fetch(`https://firestore.googleapis.com/v1/${parent}:commit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ writes: writes.map((write) => toWrite(write, parent)) }),
    });
    const payload = await response.json();
    if (response.ok && !payload.error) return result;
    const status = payload.error?.status;
    const message = payload.error?.message || 'Không thể lưu dữ liệu Firestore.';
    const creates = writes.filter(({ type }) => type === 'create');
    const conflictingWrite = status === 'ALREADY_EXISTS' && (
      creates.length === 1 ? creates[0] : creates.find(({ reference }) => message.includes(`${parent}/${reference.path}`))
    );
    if (conflictingWrite) {
      collisions.add(conflictingWrite.reference.path);
      continue;
    }
    if (status === 'ABORTED') continue;
    const error = new Error(message);
    error.code = status?.toLowerCase().replace(/_/g, '-');
    throw error;
  }

  throw new Error('Mã vừa được sử dụng bởi thao tác khác. Vui lòng lưu lại.');
}
