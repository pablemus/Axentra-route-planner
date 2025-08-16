import axios from "axios";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { MdAssistant, MdClose } from "react-icons/md";
const api = process.env.NEXT_PUBLIC_API_URL;
export default function AssistantComponent(){
    const [visible, setVisible] = useState(false)
    const [mensaje, setMensaje] = useState('')
    const [isThinking, setIsThinking] = useState(false);
    const [mensajes, setMensajes] = useState([
    { text: "Hola! soy Navi! tu asistente personal, ¿qué puedo hacer por ti?", sender: "bot" },
  ]);
  const listRef = useRef(null);
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [mensajes, visible]);

    const handleSend = async () => {
    if (!mensaje.trim()) return;
    if (isThinking) return; 

    setMensajes((prev) => [...prev, { text: mensaje, sender: "user" }]);
    const inputCopia = mensaje;
    setMensaje("");

    setMensajes((prev) => [...prev, { text: "Pensando…", sender: "bot", thinking: true }]);
    setIsThinking(true);

    try {
      const res = await axios.post(`${api}/api/ai`, { mensaje: inputCopia });

      setMensajes((prev) => {
        const arr = [...prev];
        for (let i = arr.length - 1; i >= 0; i--) {
          if ((arr[i]).thinking) {
            arr[i] = { text: res.data, sender: "bot" };
            break;
          }
        }
        return arr;
      });
    } catch (err) {
      console.error(err);
      setMensajes((prev) => {
        const arr = [...prev];
        for (let i = arr.length - 1; i >= 0; i--) {
          if ((arr[i]).thinking) {
            arr[i] = { text: "Uy, hubo un error. Intenta de nuevo 🛠️", sender: "bot" };
            break;
          }
        }
        return arr;
      });
    } finally {
      setIsThinking(false);
    }
  };

  const ThinkingBubble = () => (
    <div className="self-start bg-gray-200 text-black px-3 py-2 rounded-xl max-w-[90%] inline-flex items-center gap-1">
      <span>Pensando</span>
      <motion.span
        initial={{ opacity: 0.2 }}
        animate={{ opacity: [0.2, 1, 0.2] }}
        transition={{ repeat: Infinity, duration: 1.2 }}
      >
        …
      </motion.span>
    </div>
  );

    return(
        <>

<AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="fixed bottom-0 left-0 z-[9999] flex p-4"
        >
          <div className="bg-white min-h-150 max-h-150 min-w-[320px] max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            {/* Header verde */}
            <div className="bg-green-700 text-white h-12 px-4 flex items-center justify-between rounded-t-2xl">
              <span className="font-semibold">Asistente</span>
              <button
                onClick={() => setVisible(false)}
                className="inline-flex items-center justify-center h-8 w-8 hover:opacity-90 active:scale-95 transition"
              >
                <MdClose size={20} />
              </button>
            </div>

            {/* Cuerpo */}
             <div ref={listRef} className="flex-1 p-4 space-y-2 overflow-y-auto">
                {mensajes.map((m, i) =>
                  m.thinking ? (
                    <ThinkingBubble key={`t-${i}`} />
                  ) : (
                    <div
                      key={i}
                      className={`px-3 py-2 rounded-xl max-w-[90%] ${
                        m.sender === "user"
                          ? "self-end bg-green-600 text-white ml-auto"
                          : "self-start bg-gray-200 text-black"
                      }`}
                    >
                      {m.text}
                    </div>
                  )
                )}
              </div>

            {/* Input */}
            <div className="border-t p-2 flex items-center gap-2">
              <input
                type="text"
                value={mensaje}
                placeholder="Escribe un mensaje..."
                className="flex-1 px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-600 placeholder-black border-gray-300 text-black"
                onChange={(e) => setMensaje(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSend();
                    
                  }
                }}
              />
              
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>


{!visible && (
  <motion.div
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    whileHover={{ scale: 1.1 }}
    transition={{ duration: 0.3 }}
    className="fixed bottom-5 left-2 z-[9999] flex bg-green-950 min-h-10 min-w-10 rounded-4xl justify-center"
  >
    <button onClick={() => setVisible(true)} className="text-black">
      <MdAssistant className="text-green-400" />
    </button>
  </motion.div>
)}


    </>
    );
}