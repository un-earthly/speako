import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp,
  Timestamp,
  getDocs,
  getDoc,
  type QuerySnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface Conversation {
  id: string;
  participants: string[];
  participantLanguages: Record<string, string>;
  expectedOtherLanguage?: string | null;
  inviteCode: string | null;
  status: 'waiting' | 'active';
  mode?: 'faceToFace';
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  lastMessage?: {
    text: string;
    senderId: string;
    timestamp: Timestamp | null;
  };
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  type: 'text' | 'voice';
  audioURL?: string;
  createdAt: Timestamp | null;
}

export interface PublicUserProfile {
  uid: string;
  displayName: string | null;
  preferredLanguage: string;
  email: string | null;
  phone?: string | null;
}

export async function getUserProfile(uid: string): Promise<{ displayName: string | null } | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return { displayName: snap.data().displayName ?? null };
  } catch {
    return null;
  }
}

export async function searchUserByEmail(email: string): Promise<PublicUserProfile | null> {
  const q = query(
    collection(db, 'users'),
    where('email', '==', email.toLowerCase().trim()),
    where('isDiscoverable', '==', true),
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const data = snapshot.docs[0].data();
  return {
    uid: snapshot.docs[0].id,
    displayName: data.displayName,
    preferredLanguage: data.preferredLanguage || 'en',
    email: data.email,
    phone: data.phone,
  };
}

export async function searchUserByPhone(phone: string): Promise<PublicUserProfile | null> {
  const normalized = phone.replace(/\s+/g, '');
  const q = query(
    collection(db, 'users'),
    where('phone', '==', normalized),
    where('isDiscoverable', '==', true),
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const data = snapshot.docs[0].data();
  return {
    uid: snapshot.docs[0].id,
    displayName: data.displayName,
    preferredLanguage: data.preferredLanguage || 'en',
    email: data.email,
    phone: data.phone,
  };
}

async function findExistingConversation(uid1: string, uid2: string): Promise<string | null> {
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', uid1),
  );
  const snapshot = await getDocs(q);
  for (const docSnap of snapshot.docs) {
    if (docSnap.data().participants.includes(uid2)) return docSnap.id;
  }
  return null;
}

export async function createDirectConversation(
  myUid: string,
  myLanguage: string,
  otherUid: string,
  otherLanguage: string,
): Promise<string> {
  const existing = await findExistingConversation(myUid, otherUid);
  if (existing) {
    await updateDoc(doc(db, 'conversations', existing), {
      participantLanguages: { [myUid]: myLanguage, [otherUid]: otherLanguage },
      updatedAt: serverTimestamp(),
    });
    return existing;
  }

  const convoRef = await addDoc(collection(db, 'conversations'), {
    participants: [myUid, otherUid],
    participantLanguages: { [myUid]: myLanguage, [otherUid]: otherLanguage },
    inviteCode: null,
    status: 'active',
    createdBy: myUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return convoRef.id;
}

function generateInviteCode(): string {
  // Excludes ambiguous chars: 0/O, 1/I/L
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createFaceToFaceConversation(
  userId: string,
  langA: string,
  langB: string,
): Promise<string> {
  const convoRef = await addDoc(collection(db, 'conversations'), {
    participants: [userId],
    participantLanguages: { [userId]: langA },
    expectedOtherLanguage: langB,
    inviteCode: null,
    status: 'active',
    mode: 'faceToFace',
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return convoRef.id;
}

export async function createConversation(
  userId: string,
  myLanguage: string,
  expectedOtherLanguage?: string,
): Promise<{ conversationId: string; inviteCode: string }> {
  const inviteCode = generateInviteCode();
  const convoRef = await addDoc(collection(db, 'conversations'), {
    participants: [userId],
    participantLanguages: { [userId]: myLanguage },
    expectedOtherLanguage: expectedOtherLanguage || null,
    inviteCode,
    status: 'waiting',
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { conversationId: convoRef.id, inviteCode };
}

export async function joinConversation(
  inviteCode: string,
  userId: string,
  myLanguage: string,
): Promise<string> {
  const q = query(
    collection(db, 'conversations'),
    where('inviteCode', '==', inviteCode.toUpperCase()),
    where('status', '==', 'waiting'),
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    throw new Error('Invalid or expired invite code. Check the code and try again.');
  }
  const convoDoc = snapshot.docs[0];
  const data = convoDoc.data();

  if (data.participants.includes(userId)) {
    throw new Error('You created this conversation. Share the code with another person.');
  }

  await updateDoc(doc(db, 'conversations', convoDoc.id), {
    participants: [...data.participants, userId],
    participantLanguages: { ...data.participantLanguages, [userId]: myLanguage },
    status: 'active',
    updatedAt: serverTimestamp(),
  });

  return convoDoc.id;
}

export function subscribeToConversation(
  conversationId: string,
  callback: (conversation: Conversation | null) => void,
) {
  return onSnapshot(
    doc(db, 'conversations', conversationId),
    (docSnap) => {
      if (!docSnap.exists()) {
        callback(null);
        return;
      }
      const data = docSnap.data();
      callback({
        id: docSnap.id,
        participants: data.participants,
        participantLanguages: data.participantLanguages,
        expectedOtherLanguage: data.expectedOtherLanguage,
        inviteCode: data.inviteCode,
        status: data.status,
        mode: data.mode,
        createdBy: data.createdBy,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        lastMessage: data.lastMessage,
      });
    },
    (err) => console.error('subscribeToConversation:', err.message),
  );
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  originalText: string,
  translatedText: string,
  sourceLanguage: string,
  targetLanguage: string,
  type: 'text' | 'voice' = 'text',
  audioURL?: string
): Promise<void> {
  await addDoc(collection(db, 'messages'), {
    conversationId,
    senderId,
    originalText,
    translatedText,
    sourceLanguage,
    targetLanguage,
    type,
    audioURL: audioURL || null,
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'conversations', conversationId), {
    lastMessage: { text: originalText, senderId, timestamp: serverTimestamp() },
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToMessages(
  conversationId: string,
  callback: (messages: Message[]) => void
) {
  const q = query(
    collection(db, 'messages'),
    where('conversationId', '==', conversationId),
    orderBy('createdAt', 'asc'),
  );

  return onSnapshot(
    q,
    (snapshot: QuerySnapshot) => {
      const msgs: Message[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          conversationId: data.conversationId,
          senderId: data.senderId,
          originalText: data.originalText,
          translatedText: data.translatedText,
          sourceLanguage: data.sourceLanguage,
          targetLanguage: data.targetLanguage,
          type: data.type,
          audioURL: data.audioURL,
          createdAt: data.createdAt,
        };
      });
      callback(msgs);
    },
    (err) => console.error('subscribeToMessages:', err.message),
  );
}

export function subscribeToConversations(
  userId: string,
  callback: (conversations: Conversation[]) => void
) {
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', userId),
    orderBy('updatedAt', 'desc'),
  );

  return onSnapshot(
    q,
    (snapshot: QuerySnapshot) => {
      const convos: Conversation[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          participants: data.participants,
          participantLanguages: data.participantLanguages,
          expectedOtherLanguage: data.expectedOtherLanguage,
          inviteCode: data.inviteCode,
          status: data.status,
          mode: data.mode,
          createdBy: data.createdBy,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          lastMessage: data.lastMessage,
        };
      });
      callback(convos);
    },
    (err) => console.error('subscribeToConversations:', err.message),
  );
}

export async function deleteMessage(messageId: string): Promise<void> {
  await deleteDoc(doc(db, 'messages', messageId));
}

export async function deleteAllMessagesInConversation(conversationId: string): Promise<void> {
  const q = query(collection(db, 'messages'), where('conversationId', '==', conversationId));
  const snapshot = await getDocs(q);
  const deletes = snapshot.docs.map((d) => deleteDoc(doc(db, 'messages', d.id)));
  await Promise.all(deletes);
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await deleteAllMessagesInConversation(conversationId);
  await deleteDoc(doc(db, 'conversations', conversationId));
}

export async function getUserMessages(userId: string): Promise<Message[]> {
  const q = query(
    collection(db, 'messages'),
    where('senderId', '==', userId),
    orderBy('createdAt', 'desc'),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      conversationId: data.conversationId,
      senderId: data.senderId,
      originalText: data.originalText,
      translatedText: data.translatedText,
      sourceLanguage: data.sourceLanguage,
      targetLanguage: data.targetLanguage,
      type: data.type,
      audioURL: data.audioURL,
      createdAt: data.createdAt,
    };
  });
}
