import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useScroll, useTransform, useInView } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'
import { 
  MessageSquare, 
  Compass, 
  Send, 
  MapPin, 
  Cpu, 
  Navigation2, 
  ArrowRight,
  ShieldCheck,
  Zap,
  Layers,
  MousePointerClick,
  BrainCircuit,
  MapPinned,
  Quote,
  HelpCircle,
  Plus,
  Minus,
  Mail,
  CheckCircle2,
  Users,
  Globe,
  Star,
  Sparkles
} from 'lucide-react'

// Các thành phần trang trí nền
const BackgroundOrbs = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
    <motion.div 
      animate={{ 
        x: [0, 100, 0], 
        y: [0, 50, 0],
        scale: [1, 1.2, 1] 
      }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]"
    />
    <motion.div 
      animate={{ 
        x: [0, -80, 0], 
        y: [0, 120, 0],
        scale: [1, 1.3, 1] 
      }}
      transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[150px]"
    />
  </div>
)

const FAQItem = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <motion.div 
      layout
      className="border-b border-white/5 py-5"
    >
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center text-left group"
      >
        <h4 className="text-base font-bold text-slate-200 group-hover:text-blue-400 transition-colors">{question}</h4>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          className="text-slate-500"
        >
          {isOpen ? <Minus size={18} className="text-blue-500" /> : <Plus size={18} />}
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <p className="pt-3 text-sm text-slate-400 leading-relaxed">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const scrollRef = useRef(null)
  const { scrollYProgress } = useScroll()
  
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0])
  const heroScale = useTransform(scrollYProgress, [0, 0.2], [1, 0.9])

  useEffect(() => {
    if (user?.role === 'Admin' || user?.role == 0) {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const testimonials = [
    { text: "MapAI đã thay đổi hoàn toàn cách tôi khám phá thành phố. Chỉ cần hỏi và đi!", author: "Hoàng Minh", role: "Food Reviewer", avatar: "HM", color: "from-blue-500 to-cyan-500" },
    { text: "Tính năng chỉ đường AI thực sự thông minh, tránh kẹt xe và đưa tôi qua cung đường đẹp.", author: "Thanh Trúc", role: "Digital Nomad", avatar: "TT", color: "from-indigo-500 to-purple-500" },
    { text: "Giao diện 3D tuyệt đẹp, AI hiểu ý tôi dù tôi hỏi những câu rất mơ hồ.", author: "Anh Tuấn", role: "Travel Blogger", avatar: "AT", color: "from-emerald-500 to-teal-500" },
    { text: "Tôi tìm thấy những quán ẩn mình mà ngay cả dân địa phương cũng ít biết.", author: "Lan Hương", role: "Photographer", avatar: "LH", color: "from-rose-500 to-orange-500" },
    { text: "Một công cụ không thể thiếu cho mỗi chuyến đi cuối tuần tại Đà Nẵng.", author: "Quốc Bảo", role: "Student", avatar: "QB", color: "from-amber-500 to-yellow-500" },
    { text: "Độ chính xác về thời gian thực khiến tôi cực kỳ yên tâm khi di chuyển.", author: "Minh Thư", role: "Office Worker", avatar: "MT", color: "from-blue-600 to-indigo-600" },
  ]

  return (
    <div className="bg-slate-950 text-slate-200 overflow-x-hidden selection:bg-blue-500/30 relative">
      <BackgroundOrbs />
      
      {/* Hero Section */}
      <motion.main 
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative pt-12 pb-16 px-6 md:px-12 flex flex-col items-center z-10"
      >
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-4xl mx-auto"
        >
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 mb-8 backdrop-blur-md shadow-[0_0_20px_rgba(59,130,246,0.1)] cursor-default"
          >
            <Sparkles size={12} className="text-blue-400 animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-blue-400">Next Gen AI Mapping Engine</span>
          </motion.div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-6 leading-[1] tracking-tighter text-white">
            Đà Nẵng <br />
            <motion.span 
              animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
              transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
              className="bg-gradient-to-r from-blue-400 via-indigo-500 to-violet-600 bg-[length:200%_auto] bg-clip-text text-transparent italic"
            >
              Thông minh
            </motion.span>
          </h1>

          <p className="text-base md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
            Cuộc cách mạng bản đồ số. Trò chuyện trực tiếp với AI để điều khiển bản đồ, tìm kiếm địa điểm và lên kế hoạch hành trình hoàn hảo.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-20">
            <motion.button 
              whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(59, 130, 246, 0.4)" }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/map")}
              className="w-full sm:w-auto px-10 py-4 bg-blue-600 text-white text-sm font-black rounded-xl flex items-center justify-center gap-2 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500"></div>
              <span className="relative z-10">Khám phá bản đồ offline</span>
              <MessageSquare className="w-4 h-4 group-hover:rotate-12 transition-transform" />
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.05, background: "rgba(255,255,255,0.08)" }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/explore")}
              className="w-full sm:w-auto px-10 py-4 bg-white/5 text-white text-sm font-black rounded-xl border border-white/10 backdrop-blur-md flex items-center justify-center gap-2 group"
            >
              <span>Khám phá Đà Nẵng</span>
              <Compass className="w-4 h-4 group-hover:text-blue-400 transition-colors" />
            </motion.button>
          </div>

          {/* Interactive Preview */}
          <motion.div 
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="relative group"
          >
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
            <div className="relative bg-slate-900/90 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
              <div className="px-8 py-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500/50"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500/50"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500/50"></div>
                </div>
                <div className="px-4 py-1.5 rounded-full bg-slate-950/50 border border-white/10 flex items-center gap-2">
                  <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Neural Engine v2.0</span>
                </div>
              </div>
              
              <div className="grid lg:grid-cols-3 h-[400px]">
                <div className="col-span-1 border-r border-white/5 p-6 flex flex-col gap-4 text-left bg-slate-950/20">
                  <div className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-2xl rounded-tl-none">
                    <p className="text-[11px] text-blue-100 font-bold">Chào mừng! Bạn muốn khám phá nơi nào tại Đà Nẵng hôm nay?</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl rounded-tr-none self-end border border-white/10">
                    <p className="text-[11px] text-slate-300 font-bold flex items-center gap-2 italic">
                      <Zap size={10} className="text-yellow-500" /> Điểm ngắm hoàng hôn đẹp nhất?
                    </p>
                  </div>
                  <div className="mt-auto relative">
                    <div className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-[10px] text-slate-500">Đang phân tích tọa độ...</div>
                  </div>
                </div>
                <div className="col-span-2 relative bg-slate-800/30">
                   <div className="absolute inset-0 bg-[url('https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/108.23,16.06,12.5/1200x800?access_token=pk.eyJ1IjoiZ2VtaW5pLWNsaSIsImEiOiJjbHRyeHBwYmcwMTFqMmtvNHZqOXp2OWV3In0.fake')] bg-cover bg-center opacity-60" />
                   <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent"></div>
                   <motion.div 
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                   >
                     <MapPin className="text-blue-500 w-8 h-8 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                   </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </motion.main>

      {/* Trust Bar */}
      <section className="py-12 border-y border-white/5 bg-white/2 backdrop-blur-md relative z-10">
        <div className="max-w-7xl mx-auto px-6 overflow-hidden">
          <p className="text-center text-[8px] font-black uppercase tracking-[0.4em] text-slate-600 mb-8">Đối tác chiến lược</p>
          <div className="flex flex-wrap justify-center items-center gap-10 md:gap-16 opacity-30">
            {['Danang Tourism', 'SmartCity Hub', 'NeuralMaps', 'V-Travel', 'TechCorp'].map((brand) => (
              <span key={brand} className="text-lg font-black italic tracking-tighter text-white hover:text-blue-400 transition-colors cursor-default">{brand}</span>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-24 px-6 md:px-12 max-w-6xl mx-auto relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            className="max-w-xl text-left"
          >
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-4 uppercase">Đơn giản & Thông minh</h2>
            <p className="text-slate-400 font-bold text-sm leading-relaxed">Chúng tôi tối ưu hóa mọi trải nghiệm để bạn chỉ cần tập trung khám phá thành phố.</p>
          </motion.div>
          <div className="flex gap-3">
            {[1, 2, 3].map(n => (
              <motion.div 
                key={n} 
                whileInView={{ scale: [1, 1.2, 1] }}
                transition={{ delay: n * 0.1 }}
                className={`w-10 h-10 rounded-full border ${n === 3 ? 'border-blue-500 text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'border-white/10 text-white/20'} flex items-center justify-center text-xs font-black`}
              >
                0{n}
              </motion.div>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: <MousePointerClick size={24} />, title: "1. Đặt câu hỏi", desc: "Sử dụng ngôn ngữ tự nhiên như đang trò chuyện với một người bạn địa phương.", step: "INPUT" },
            { icon: <BrainCircuit size={24} />, title: "2. Phân tích AI", desc: "Neural Engine xử lý hàng triệu điểm dữ liệu thời gian thực để lọc kết quả tối ưu.", step: "PROCESS" },
            { icon: <MapPinned size={24} />, title: "3. Trải nghiệm", desc: "Mọi thứ hiển thị sống động trên bản đồ 3D cùng lộ trình di chuyển hoàn hảo.", step: "NAVIGATE" }
          ].map((item, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ y: -5 }}
              className="relative p-8 bg-slate-900/40 border border-white/5 rounded-3xl group transition-all"
            >
              <div className="absolute top-0 right-8 -translate-y-1/2 px-3 py-0.5 bg-blue-600 rounded-full text-[8px] font-black tracking-widest text-white shadow-lg">{item.step}</div>
              <div className="w-12 h-12 bg-white/5 text-blue-500 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                {item.icon}
              </div>
              <h3 className="text-lg font-black text-white mb-2 tracking-tight uppercase">{item.title}</h3>
              <p className="text-xs text-slate-400 font-bold leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 md:px-12 max-w-6xl mx-auto relative z-10">
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4 uppercase">Công nghệ lõi</h2>
          <div className="h-1 w-16 bg-blue-600 mx-auto rounded-full"></div>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: <Cpu size={32} />, title: "Neural Logic", desc: "Hệ thống hiểu ngữ cảnh và cảm xúc đằng sau mỗi yêu cầu tìm kiếm của bạn.", color: "blue" },
            { icon: <Navigation2 size={32} />, title: "Dynamic Sync", desc: "Đồng bộ hóa tức thì dữ liệu giao thông, sự kiện và thời tiết trên toàn Đà Nẵng.", color: "indigo" },
            { icon: <ShieldCheck size={32} />, title: "Privacy First", desc: "Mã hóa đầu cuối mọi thông tin cá nhân và lịch sử di chuyển của người dùng.", color: "purple" }
          ].map((feature, idx) => (
            <motion.div 
              key={idx}
              whileHover={{ scale: 1.02 }}
              className="p-10 rounded-[2.5rem] bg-slate-900/40 border border-white/5 hover:border-blue-500/20 transition-all group overflow-hidden relative"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl group-hover:bg-blue-600/10 transition-all" />
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-8 text-blue-500 shadow-inner group-hover:text-white group-hover:bg-blue-600 transition-all">
                {feature.icon}
              </div>
              <h3 className="text-xl font-black text-white mb-4 tracking-tight uppercase">{feature.title}</h3>
              <p className="text-xs text-slate-400 font-bold leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 bg-blue-600 relative overflow-hidden z-10">
        <motion.div 
          animate={{ x: [0, 50, 0], y: [0, 30, 0] }}
          transition={{ duration: 10, repeat: Infinity }}
          className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-white/10 rounded-full blur-3xl"
        />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { icon: <Users size={20} />, value: "100k+", label: "ACTIVE USERS" },
              { icon: <Globe size={20} />, value: "500+", label: "HOT SPOTS" },
              { icon: <Star size={20} />, value: "4.9/5", label: "USER RATING" },
              { icon: <Zap size={20} />, value: "99.9%", label: "ACCURACY" }
            ].map((stat, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.1 }}
              >
                <div className="text-white/40 mb-2 flex justify-center">{stat.icon}</div>
                <p className="text-4xl md:text-5xl font-black text-white mb-1 tracking-tighter">{stat.value}</p>
                <p className="text-[8px] font-black uppercase tracking-[0.3em] text-blue-100/60">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* "Flying" Testimonials Section */}
      <section className="py-24 relative overflow-hidden z-10">
        <div className="text-center mb-16 px-6">
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-4 uppercase">Cộng đồng tin cậy</h2>
          <p className="text-slate-500 font-bold text-sm">Hàng ngàn người đang thay đổi cách họ di chuyển mỗi ngày.</p>
        </div>

        {/* Marquee Row 1 */}
        <div className="flex gap-6 overflow-hidden py-4 select-none group">
          <motion.div 
            animate={{ x: [0, -1035] }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="flex gap-6 flex-nowrap"
          >
            {[...testimonials, ...testimonials].map((item, idx) => (
              <motion.div 
                key={idx}
                whileHover={{ scale: 1.05, y: -5, borderColor: "rgba(59, 130, 246, 0.4)" }}
                className="w-[320px] shrink-0 p-8 bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-3xl relative overflow-hidden group/card shadow-2xl"
              >
                <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${item.color} opacity-5 blur-2xl group-hover/card:opacity-20 transition-opacity`} />
                <Quote className="absolute top-6 right-6 text-white/5 w-12 h-12" />
                <p className="text-sm font-bold text-slate-300 italic mb-8 relative z-10 leading-relaxed">"{item.text}"</p>
                <div className="flex items-center gap-3 relative z-10">
                  <div className={`w-10 h-10 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center text-xs font-black text-white shadow-lg`}>
                    {item.avatar}
                  </div>
                  <div>
                    <p className="text-xs font-black text-white uppercase">{item.author}</p>
                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{item.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Marquee Row 2 (Reverse) */}
        <div className="flex gap-6 overflow-hidden py-4 select-none mt-4">
          <motion.div 
            animate={{ x: [-1035, 0] }}
            transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
            className="flex gap-6 flex-nowrap"
          >
            {[...testimonials.reverse(), ...testimonials].map((item, idx) => (
              <motion.div 
                key={idx}
                whileHover={{ scale: 1.05, y: -5, borderColor: "rgba(59, 130, 246, 0.4)" }}
                className="w-[320px] shrink-0 p-8 bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-3xl relative overflow-hidden group/card shadow-2xl"
              >
                <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${item.color} opacity-5 blur-2xl group-hover/card:opacity-20 transition-opacity`} />
                <Quote className="absolute top-6 right-6 text-white/5 w-12 h-12" />
                <p className="text-sm font-bold text-slate-300 italic mb-8 relative z-10 leading-relaxed">"{item.text}"</p>
                <div className="flex items-center gap-3 relative z-10">
                  <div className={`w-10 h-10 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center text-xs font-black text-white shadow-lg`}>
                    {item.avatar}
                  </div>
                  <div>
                    <p className="text-xs font-black text-white uppercase">{item.author}</p>
                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{item.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6 md:px-12 bg-white/2 relative z-10">
        <div className="max-w-3xl mx-auto">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            className="text-3xl font-black text-white text-center mb-12 uppercase"
          >
            Thắc mắc phổ biến
          </motion.h2>
          <div className="space-y-1">
            <FAQItem question="MapAI lấy dữ liệu từ đâu?" answer="Chúng tôi kết hợp API từ các nền tảng bản đồ hàng đầu cùng dữ liệu thời gian thực từ mạng lưới cảm biến Smart City Đà Nẵng." />
            <FAQItem question="Dữ liệu di chuyển của tôi có an toàn?" answer="Tuyệt đối. Mọi lịch sử tìm kiếm được ẩn danh hóa và mã hóa 256-bit trước khi lưu trữ." />
            <FAQItem question="AI có hỗ trợ tiếng Anh không?" answer="Có, hệ thống hỗ trợ đa ngôn ngữ bao gồm Tiếng Việt, Tiếng Anh và Tiếng Nhật để phục vụ khách du lịch." />
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-24 px-6 md:px-12 relative z-10">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          className="max-w-5xl mx-auto rounded-[3rem] bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-950 p-12 md:p-20 text-center relative overflow-hidden shadow-[0_0_50px_rgba(59,130,246,0.3)]"
        >
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
          <div className="relative z-10">
            <h2 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tighter uppercase leading-none">Cùng định nghĩa <br /> lại bản đồ</h2>
            <p className="text-lg text-blue-100 mb-10 max-w-xl mx-auto font-medium opacity-90">Tham gia cộng đồng MapAI ngay hôm nay để nhận quyền truy cập các tính năng Beta mới nhất.</p>
            <form className="max-w-md mx-auto flex flex-col sm:flex-row gap-3 mb-8" onSubmit={(e) => e.preventDefault()}>
              <input type="email" placeholder="Email của bạn..." className="flex-grow px-6 py-4 bg-white/10 border border-white/20 rounded-xl text-sm text-white outline-none focus:bg-white/20 transition-all placeholder:text-blue-200/50 font-bold" />
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-white text-blue-900 text-sm font-black rounded-xl hover:shadow-xl transition-all"
              >
                Gia nhập
              </motion.button>
            </form>
            <div className="flex justify-center gap-6 text-[8px] font-black uppercase tracking-widest text-blue-200/50">
              <span className="flex items-center gap-1"><CheckCircle2 size={12}/> Quyền lợi đặc biệt</span>
              <span className="flex items-center gap-1"><CheckCircle2 size={12}/> Hủy bất cứ lúc nào</span>
            </div>
          </div>
        </motion.div>
      </section>

    </div>
  )
}

export default Home
