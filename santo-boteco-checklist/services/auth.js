import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export async function loginWithFirestore(username, password) {
  const usuariosRef = collection(db, 'Usuarios');
  const q = query(usuariosRef, where('user', '==', username));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    throw new Error('Usuário não encontrado');
  }

  const userDoc = snapshot.docs[0];
  const userData = userDoc.data();

  if (userData.password !== password) {
    throw new Error('Senha incorreta');
  }

  return { id: userDoc.id, ...userData };
}