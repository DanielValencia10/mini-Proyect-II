import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  CollectionReference,
  DocumentData,
  serverTimestamp,
} from 'firebase/firestore'
import { firestore } from '../lib/firebase'

export interface UserData {
  uid: string
  email: string
  username: string
  nombres: string
  apellidos: string
  avatar?: string
}

class UserDao {
  private collectionRef: CollectionReference<DocumentData>

  constructor() {
    this.collectionRef = collection(firestore, 'users')
  }

  async getUserById(id: string) {
    try {
      const userDoc = await getDoc(doc(this.collectionRef, id))
      return userDoc.exists()
        ? { success: true, data: userDoc.data() as UserData }
        : { success: false, data: null }
    } catch (error) {
      console.error('Error getting document', error)
      return { success: false, data: null }
    }
  }

  async createUser(userData: UserData) {
    try {
      await setDoc(doc(this.collectionRef, userData.uid), {
        ...userData,
        createdAt: serverTimestamp(),
      })
      return { success: true }
    } catch (error) {
      console.error('Error creating user', error)
      return { success: false }
    }
  }

  async updateUser(id: string, fields: Partial<Omit<UserData, 'uid' | 'email'>>) {
    try {
      await updateDoc(doc(this.collectionRef, id), { ...fields })
      return { success: true }
    } catch (error) {
      console.error('Error updating user', error)
      return { success: false }
    }
  }

  async deleteUser(id: string) {
    try {
      await deleteDoc(doc(this.collectionRef, id))
      return { success: true }
    } catch (error) {
      console.error('Error deleting user', error)
      return { success: false }
    }
  }
}

export default UserDao
