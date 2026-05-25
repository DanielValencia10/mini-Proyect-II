import { db } from '../firebase'

export interface UserData {
  uid: string
  email: string
  username: string
  nombres: string
  apellidos: string
  avatar?: string
}

type Result = Promise<{ success: boolean; data?: UserData | null }>

class UserDao {
  private collectionRef = db.collection('users')

  async getUserById(id: string): Result {
    try {
      const userDoc = await this.collectionRef.doc(id).get()
      return userDoc.exists
        ? { success: true, data: userDoc.data() as UserData }
        : { success: false, data: null }
    } catch (error) {
      console.error('Error getting user', error)
      return { success: false, data: null }
    }
  }

  async createUser(userData: UserData): Promise<{ success: boolean }> {
    try {
      await this.collectionRef.doc(userData.uid).set({
        ...userData,
        createdAt: new Date().toISOString(),
      })
      return { success: true }
    } catch (error) {
      console.error('Error creating user', error)
      return { success: false }
    }
  }

  async updateUser(id: string, fields: Partial<Omit<UserData, 'uid' | 'email'>>): Promise<{ success: boolean }> {
    try {
      await this.collectionRef.doc(id).update({ ...fields })
      return { success: true }
    } catch (error) {
      console.error('Error updating user', error)
      return { success: false }
    }
  }

  async deleteUser(id: string): Promise<{ success: boolean }> {
    try {
      await this.collectionRef.doc(id).delete()
      return { success: true }
    } catch (error) {
      console.error('Error deleting user', error)
      return { success: false }
    }
  }
}

export default UserDao
