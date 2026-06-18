import { db } from '../firebase'

export interface RoomData {
    id: string
    name: string
    ownerId: string
    participants: string[]
}

class RoomDao {
    private col = db.collection('rooms')

    async getRoomById(id: string) {
        try {
            const snap = await this.col.doc(id).get()
            return snap.exists
                ? { success: true, data: snap.data() as RoomData }
                : { success: false, data: null }
        } catch { return { success: false, data: null } }
    }

    async getRoomsByOwner(ownerId: string) {
        try {
            const snap = await this.col.where('ownerId', '==', ownerId).orderBy('createdAt', 'desc').get()
            const data = snap.docs.map(d => d.data() as RoomData)
            return { success: true, data }
        } catch { return { success: false, data: [] } }
    }

    async createRoom(room: RoomData) {
        try {
            await this.col.doc(room.id).set({ ...room, createdAt: new Date() })
            return { success: true }
        } catch { return { success: false } }
    }

    async updateRoom(id: string, fields: Partial<Omit<RoomData, 'id' | 'ownerId'>>) {
        try {
            await this.col.doc(id).update({ ...fields })
            return { success: true }
        } catch { return { success: false } }
    }

    async deleteRoom(id: string) {
        try {
            // Borrar subcolección de mensajes antes de borrar la sala
            const msgs = await this.col.doc(id).collection('messages').listDocuments()
            if (msgs.length > 0) {
                const batch = db.batch()
                msgs.forEach(ref => batch.delete(ref))
                await batch.commit()
            }
            await this.col.doc(id).delete()
            return { success: true }
        } catch { return { success: false } }
    }
}

export default RoomDao