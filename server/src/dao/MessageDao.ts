import { db } from '../firebase'

export interface MessageData {
  id?: string
  author: string
  text: string
  timestamp: number
}

class MessageDao {
  private chatCol(roomId: string) {
    return db.collection('messages').doc(roomId).collection('chat')
  }

  async saveMessage(roomId: string, msg: MessageData): Promise<{ success: boolean }> {
    try {
      await this.chatCol(roomId).add({
        ...msg,
        timestamp: Date.now(),
      })
      return { success: true }
    } catch (error) {
      console.error('Error saving message:', error)
      return { success: false }
    }
  }

  async getMessages(roomId: string, limit = 50): Promise<{ success: boolean; data: MessageData[] }> {
    try {
      const snap = await this.chatCol(roomId)
        .orderBy('timestamp', 'asc')
        .limitToLast(limit)
        .get()
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MessageData))
      return { success: true, data }
    } catch (error) {
      console.error('Error getting messages:', error)
      return { success: false, data: [] }
    }
  }
}

export default MessageDao
