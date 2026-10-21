import { collection, addDoc, getDocs, orderBy, query, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

export async function getCargos() {
    const cargosRef = collection(db, 'Cargos');
    const q = query(cargosRef, orderBy('nome'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
}

export async function addCargo(dados) {
    const cargosRef = collection(db, 'Cargos');
    const docRef = await addDoc(cargosRef, dados);
    return docRef.id;
}

export async function updateCargo(id, dados) {
    const cargoRef = doc(db, 'Cargos', id);
    await updateDoc(cargoRef, dados);
}

export async function deleteCargo(id) {
    const cargoRef = doc(db, 'Cargos', id);
    await deleteDoc(cargoRef);
}