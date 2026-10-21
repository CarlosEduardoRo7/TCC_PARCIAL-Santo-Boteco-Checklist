import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from './firebase';

export async function getFuncionarios() {
    const usuariosRef = collection(db, 'Usuarios');
    const q = query(usuariosRef, orderBy('nome'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
}

export async function addFuncionario(dados) {
    const usuariosRef = collection(db, 'Usuarios');
    const docRef = await addDoc(usuariosRef, dados);
    return docRef.id;
}

export async function updateFuncionario(id, dados) {
    const usuarioRef = doc(db, 'Usuarios', id);
    await updateDoc(usuarioRef, dados);
}

export async function deleteFuncionario(id) {
    const usuarioRef = doc(db, 'Usuarios', id);
    await deleteDoc(usuarioRef);
}