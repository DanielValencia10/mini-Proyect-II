import React, { useState, useRef, useEffect } from 'react';
import { Video, VideoOff, Mic, MicOff, PhoneOff } from 'lucide-react';
import { useSocket } from '../../hooks/useSocket';
import { useWebRTC } from '../../hooks/useWebRTC';
import useAuthStore from '../../stores/useAuthStore';

interface CallPanelProps {
  roomId: string;
}

export const CallPanel: React.FC<CallPanelProps> = ({ roomId }) => {
  const { socket } = useSocket(roomId); // reutiliza el socket
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [inCall, setInCall] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const localVideoRef = useRef<HTMLVideoElement>(null);

const { userLogged } = useAuthStore();
const currentUserId = userLogged?.uid ?? '';

// Luego
const { remoteStreams, joinCall, leaveCall } = useWebRTC(roomId, localStream, socket, currentUserId);
  const startCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      setInCall(true);
    } catch (err) {
      console.error('Error al acceder a medios:', err);
    }
  };

  const stopCall = () => {
    localStream?.getTracks().forEach((track) => track.stop());
    setLocalStream(null);
    leaveCall();
    setInCall(false);
  };

  useEffect(() => {
    if (inCall && localStream) {
      joinCall();
    }
  }, [inCall, localStream, joinCall]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const toggleMic = () => {
    localStream?.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setMicEnabled((prev) => !prev);
  };
  const toggleVideo = () => {
    localStream?.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setVideoEnabled((prev) => !prev);
  };

  return (
    <div className="flex flex-col gap-4 p-4 border rounded-lg bg-gray-50">
      <h2 className="text-lg font-semibold">Videollamada</h2>
      {!inCall ? (
        <button onClick={startCall} className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
          <Video size={20} /> Unirse a la llamada
        </button>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <video ref={localVideoRef} autoPlay muted playsInline className="w-full rounded bg-black" />
              <span className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1 rounded">Tú</span>
            </div>
            {remoteStreams.map((rs) => (
              <RemoteVideo key={rs.userId} stream={rs.stream} userId={rs.userId} />
            ))}
          </div>
          <div className="flex gap-2 justify-center">
            <button onClick={toggleMic} className={`p-2 rounded ${micEnabled ? 'bg-gray-200' : 'bg-red-500 text-white'}`}>
              {micEnabled ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            <button onClick={toggleVideo} className={`p-2 rounded ${videoEnabled ? 'bg-gray-200' : 'bg-red-500 text-white'}`}>
              {videoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
            </button>
            <button onClick={stopCall} className="p-2 bg-red-600 text-white rounded hover:bg-red-700">
              <PhoneOff size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const RemoteVideo: React.FC<{ stream: MediaStream; userId: string }> = ({ stream, userId }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);
  return (
    <div className="relative">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={videoRef} autoPlay playsInline className="w-full rounded bg-black" />
      <span className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1 rounded">{userId}</span>
    </div>
  );
};